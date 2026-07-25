"""
Automacao de bloqueio/desbloqueio por inadimplencia (Ta Telecom).

Estrategia:
- Worker background verifica a cada hora se e a hora configurada para o job (default 23h)
- No job de bloqueio: varre cobrancas com vencimento <= hoje-dias_tolerancia e sem pagamento
- Bloqueia total na Ta Telecom
- Job de aviso: envia WhatsApp 1 dia antes do bloqueio
- Desbloqueio automatico via webhook Asaas (chamado a partir do server.py)

Persistencia:
- Config: db.config com key "automacao_bloqueio"
- Whitelist: db.automacao_bloqueio_whitelist
- Historico: db.logs (categoria "automacao_bloqueio")
- Flag na linha bloqueada: linhas.bloqueio_automatico = {ativo: true, data, motivo}
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from bson import ObjectId
import asyncio
import logging
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/automacao/bloqueio", tags=["automacao"])

# Injecoes (setadas via init())
_db = None
_get_current_user = None
_require_admin = None
_create_log = None
_operadora_service = None
_zapi_service = None
_sync_asaas_fn = None
_asaas_service = None

DEFAULT_CONFIG = {
    "ativo": False,
    "hora_bloqueio": 14,           # bloqueia as 14h BRT (D-2 da expiracao Ta)
    "hora_aviso": 9,               # envia lembrete D-3 as 9h BRT
    "hora_alerta_d0": 12,          # envia alerta D-0 (vence hoje) as 12h BRT
    "aviso_dia_anterior": True,    # WhatsApp 3 dias antes do bloqueio HOMEON
    "aviso_dia_vencimento": True,  # WhatsApp no dia do bloqueio (D-0) — vence hoje
    "motivo_bloqueio": 15,         # codigo Ta Telecom para bloqueio total
    "desbloqueio_automatico": True,
    "sync_asaas_antes_bloqueio": True,  # SALVAGUARDA: sincroniza status com Asaas antes do job de bloqueio
    "notificar_admin": True,
    # Textos profissionais (anti-banimento WhatsApp: tom cordial, sem CAPS, sem emojis em excesso)
    "mensagem_aviso": (
        "Ola, {nome}. Aqui e da HomeOn Internet.\n\n"
        "Passando um lembrete: sua linha {msisdn} tem renovacao prevista para {data_bloqueio}. "
        "Para manter o servico ativo, o boleto no valor de R$ {valor} venceu em {vencimento} e ainda consta em aberto.\n\n"
        "Link para pagamento: {link}\n\n"
        "Qualquer duvida, estamos a disposicao."
    ),
    "mensagem_alerta_d0": (
        "Ola, {nome}.\n\n"
        "Sua linha {msisdn} sera suspensa hoje caso o boleto em aberto nao seja quitado. Valor: R$ {valor}.\n\n"
        "Pagamento: {link}\n\n"
        "Apos a confirmacao, a reativacao e automatica em ate 15 minutos."
    ),
    "mensagem_bloqueado": (
        "Ola, {nome}. Sua linha {msisdn} foi temporariamente suspensa por inadimplencia.\n\n"
        "Para reativar imediatamente, quite o boleto: {link}\n\n"
        "Apos a confirmacao, a linha volta a funcionar em ate 15 minutos."
    ),
    "mensagem_desbloqueado": "Ola {nome}, seu pagamento foi confirmado! Sua linha ja esta reativada.",
    # NOVO: controles independentes por job (podem ser desligados individualmente sem desligar automacao inteira)
    "enviar_lembrete_d3": True,
    "enviar_alerta_d0": True,
    "executar_bloqueio_auto": True,
}


def init(db, get_current_user, require_admin, create_log, operadora_service, zapi_service, sync_asaas_fn=None, asaas_service=None):
    global _db, _get_current_user, _require_admin, _create_log, _operadora_service, _zapi_service, _sync_asaas_fn, _asaas_service
    _db = db
    _get_current_user = get_current_user
    _require_admin = require_admin
    _create_log = create_log
    _operadora_service = operadora_service
    _zapi_service = zapi_service
    _sync_asaas_fn = sync_asaas_fn
    _asaas_service = asaas_service


# ==================== CONFIG ====================

async def _get_config() -> dict:
    doc = await _db.config.find_one({"key": "automacao_bloqueio"})
    if not doc:
        return {**DEFAULT_CONFIG}
    return {**DEFAULT_CONFIG, **(doc.get("value") or {})}


async def _save_config(cfg: dict, user_id: Optional[str] = None):
    await _db.config.update_one(
        {"key": "automacao_bloqueio"},
        {"$set": {"key": "automacao_bloqueio", "value": cfg, "updated_at": datetime.now(timezone.utc), "updated_by": user_id}},
        upsert=True,
    )


class ConfigUpdate(BaseModel):
    ativo: Optional[bool] = None
    hora_bloqueio: Optional[int] = None
    hora_aviso: Optional[int] = None
    hora_alerta_d0: Optional[int] = None
    aviso_dia_anterior: Optional[bool] = None
    aviso_dia_vencimento: Optional[bool] = None
    motivo_bloqueio: Optional[int] = None
    desbloqueio_automatico: Optional[bool] = None
    notificar_admin: Optional[bool] = None
    mensagem_aviso: Optional[str] = None
    mensagem_alerta_d0: Optional[str] = None
    mensagem_bloqueado: Optional[str] = None
    mensagem_desbloqueado: Optional[str] = None
    enviar_lembrete_d3: Optional[bool] = None
    enviar_alerta_d0: Optional[bool] = None
    executar_bloqueio_auto: Optional[bool] = None


@router.get("/config")
async def get_config(request: Request):
    await _require_admin(request)
    return await _get_config()


@router.put("/config")
async def update_config(data: ConfigUpdate, request: Request):
    user = await _require_admin(request)
    cfg = await _get_config()
    for k, v in data.dict(exclude_none=True).items():
        cfg[k] = v
    if cfg.get("hora_bloqueio") is not None and not (0 <= cfg["hora_bloqueio"] <= 23):
        raise HTTPException(status_code=400, detail="hora_bloqueio deve ser 0-23")
    if cfg.get("hora_aviso") is not None and not (0 <= cfg["hora_aviso"] <= 23):
        raise HTTPException(status_code=400, detail="hora_aviso deve ser 0-23")
    if cfg.get("hora_alerta_d0") is not None and not (0 <= cfg["hora_alerta_d0"] <= 23):
        raise HTTPException(status_code=400, detail="hora_alerta_d0 deve ser 0-23")
    await _save_config(cfg, user["id"])
    await _create_log("automacao_bloqueio", f"Config atualizada: ativo={cfg.get('ativo')}", user["id"], user["name"])
    return cfg


# ==================== WHITELIST ====================

@router.get("/whitelist")
async def list_whitelist(request: Request):
    await _require_admin(request)
    docs = await _db.automacao_bloqueio_whitelist.find().to_list(1000)
    result = []
    for d in docs:
        cliente = None
        try:
            cliente = await _db.clientes.find_one({"_id": ObjectId(d["cliente_id"])})
        except Exception:
            pass
        result.append({
            "id": str(d["_id"]),
            "cliente_id": d["cliente_id"],
            "cliente_nome": cliente.get("nome") if cliente else None,
            "documento": cliente.get("documento") if cliente else None,
            "motivo": d.get("motivo"),
            "added_by": d.get("added_by"),
            "added_at": d.get("added_at"),
        })
    # Ordenar alfabeticamente por nome
    result.sort(key=lambda x: (x.get("cliente_nome") or "").lower())
    return result


class WhitelistAddLote(BaseModel):
    cliente_ids: List[str]
    motivo: Optional[str] = None


@router.post("/whitelist/lote")
async def add_whitelist_lote(data: WhitelistAddLote, request: Request):
    """Adiciona multiplos clientes a whitelist em lote."""
    user = await _require_admin(request)
    if not data.cliente_ids:
        raise HTTPException(status_code=400, detail="Lista de cliente_ids vazia")

    adicionados = 0
    ja_existiam = 0
    erros = []
    for cid in data.cliente_ids:
        try:
            cliente = await _db.clientes.find_one({"_id": ObjectId(cid)})
            if not cliente:
                erros.append({"cliente_id": cid, "erro": "cliente nao encontrado"})
                continue
            existe = await _db.automacao_bloqueio_whitelist.find_one({"cliente_id": cid})
            if existe:
                ja_existiam += 1
                continue
            doc = {
                "cliente_id": cid,
                "motivo": data.motivo,
                "added_by": user["id"],
                "added_by_name": user["name"],
                "added_at": datetime.now(timezone.utc),
            }
            await _db.automacao_bloqueio_whitelist.insert_one(doc)
            adicionados += 1
        except Exception as e:
            erros.append({"cliente_id": cid, "erro": str(e)})

    await _create_log(
        "automacao_bloqueio",
        f"Whitelist em lote: {adicionados} adicionados, {ja_existiam} ja existiam, {len(erros)} erros",
        user["id"], user["name"],
    )
    return {
        "success": True,
        "adicionados": adicionados,
        "ja_existiam": ja_existiam,
        "erros": erros,
        "total_processados": len(data.cliente_ids),
    }


class WhitelistAdd(BaseModel):
    cliente_id: str
    motivo: Optional[str] = None


@router.post("/whitelist")
async def add_whitelist(data: WhitelistAdd, request: Request):
    user = await _require_admin(request)
    try:
        cliente = await _db.clientes.find_one({"_id": ObjectId(data.cliente_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="cliente_id invalido")
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")
    existe = await _db.automacao_bloqueio_whitelist.find_one({"cliente_id": data.cliente_id})
    if existe:
        raise HTTPException(status_code=400, detail="Cliente ja esta na whitelist")
    doc = {
        "cliente_id": data.cliente_id,
        "motivo": data.motivo,
        "added_by": user["id"],
        "added_by_name": user["name"],
        "added_at": datetime.now(timezone.utc),
    }
    r = await _db.automacao_bloqueio_whitelist.insert_one(doc)
    await _create_log("automacao_bloqueio", f"Cliente {cliente.get('nome')} adicionado a whitelist", user["id"], user["name"])
    return {"success": True, "id": str(r.inserted_id)}


@router.delete("/whitelist/{cliente_id}")
async def remove_whitelist(cliente_id: str, request: Request):
    user = await _require_admin(request)
    r = await _db.automacao_bloqueio_whitelist.delete_one({"cliente_id": cliente_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente nao esta na whitelist")
    await _create_log("automacao_bloqueio", f"Cliente {cliente_id} removido da whitelist", user["id"], user["name"])
    return {"success": True}


# ==================== SIMULACAO / EXECUCAO ====================

async def _find_cobrancas_para_bloquear(dias_tolerancia: int = 0) -> List[dict]:
    """
    LOGICA v2 (2026-07): usa `linhas.data_expiracao_ta` como UNICA fonte de verdade.
    Regra: bloquear quando hoje >= data_expiracao_ta - 2 dias (ou seja, 2 dias antes da Ta cobrar novo ciclo).
    Equivale a: data_expiracao_ta <= hoje + 2.
    Alem disso, so bloqueia se cliente NAO tiver pago o ciclo atual (verificado em _build_simulacao).

    IMPORTANTE: nao ha fallback legacy. Se linha nao tem `data_expiracao_ta` sincronizado,
    ela NUNCA sera bloqueada por esta rotina — comportamento seguro (fail-safe).
    """
    hoje = datetime.now(timezone.utc).date()
    return await _find_via_expiracao_ta(hoje, dias_tolerancia)


def _is_valid_iso_date(s) -> bool:
    if not isinstance(s, str) or len(s) < 10:
        return False
    try:
        datetime.strptime(s[:10], "%Y-%m-%d")
        return True
    except Exception:
        return False


async def _find_via_expiracao_ta(hoje, dias_tolerancia: int) -> List[dict]:
    """Algoritmo v2: bloqueia D-2 da expiracao Ta.
    Filtro: data_expiracao_ta <= hoje + 2 dias (equivalente a hoje >= data_expiracao_ta - 2).
    dias_tolerancia adiciona dias EXTRAS de graca (empurra o bloqueio para depois).
    """
    limite_dt = hoje + timedelta(days=2 - dias_tolerancia)
    alvo = limite_dt.isoformat()
    linhas = await _db.linhas.find({
        "status": "ativo",
        "data_expiracao_ta": {"$lte": alvo, "$ne": None},
    }).to_list(5000)

    fake_cobrancas = []
    for l in linhas:
        cid = l.get("cliente_id")
        if not cid:
            continue
        exp = l.get("data_expiracao_ta")
        # Validacao STRICT: so aceita YYYY-MM-DD para evitar comparacoes lexicograficas erradas
        if not _is_valid_iso_date(exp):
            logger.warning(f"Linha {l['_id']} tem data_expiracao_ta invalida: {exp!r} — ignorada")
            continue
        # Recheck em Python (defesa contra dados corrompidos no DB)
        exp_normalized = exp[:10]
        if exp_normalized > alvo:
            continue
        fake_cobrancas.append({
            "_id": l["_id"],
            "cliente_id": cid,
            "vencimento": exp_normalized,
            "valor": 0,
            "linha_id": str(l["_id"]),
            "origem": "expiracao_ta",
            "data_expiracao_ta": exp_normalized,
        })
    logger.info(f"[auto-bloqueio v2] hoje={hoje.isoformat()} alvo(<=)={alvo} candidatos={len(fake_cobrancas)}")
    return fake_cobrancas


# ==================== SYNC DATA EXPIRACAO TA ====================

async def _extrair_data_expiracao(raw_data: dict) -> Optional[str]:
    """Extrai data de expiracao do plano do payload da Ta. Tenta multiplos nomes de campo."""
    if not raw_data or not isinstance(raw_data, dict):
        return None
    campos = [
        "data_expiracao", "expiration_date", "plan_expiration", "expira_em",
        "expiresAt", "expiration", "expires", "valid_until", "validade",
        "prox_recarga", "next_recharge", "planExpiration", "expiration_plan",
        "dataExpiracao", "endDate", "end_date",
    ]
    # Busca no root
    for c in campos:
        if c in raw_data and raw_data[c]:
            return _normalize_date(raw_data[c])
    # Busca em subobjetos (plano, subscription)
    for sub in ("plan", "plano", "subscription", "assinatura", "details"):
        if sub in raw_data and isinstance(raw_data[sub], dict):
            for c in campos:
                if c in raw_data[sub] and raw_data[sub][c]:
                    return _normalize_date(raw_data[sub][c])
    return None


def _normalize_date(v) -> Optional[str]:
    """Converte varias formas de data para YYYY-MM-DD."""
    if not v:
        return None
    s = str(v).strip()
    if not s:
        return None
    # DD/MM/YYYY -> YYYY-MM-DD
    if "/" in s:
        try:
            parts = s.split("/")
            if len(parts) == 3:
                d, m, y = parts
                if len(y) == 4 and len(m) <= 2 and len(d) <= 2:
                    return f"{y}-{int(m):02d}-{int(d):02d}"
        except Exception:
            pass
    # ISO com T
    if "T" in s:
        return s.split("T")[0]
    # Se ja tem formato YYYY-MM-DD
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return None


@router.post("/sincronizar-expiracao-ta")
async def sincronizar_expiracao_ta(request: Request):
    """Consulta a API Ta para cada linha ativa e salva data_expiracao_ta no banco."""
    user = await _require_admin(request)
    if not _operadora_service or not getattr(_operadora_service, "is_configured", True):
        raise HTTPException(status_code=400, detail="Operadora nao configurada")

    linhas = await _db.linhas.find({"status": "ativo"}).to_list(5000)
    updated = 0
    sem_expiracao = 0
    erros = []
    for l in linhas:
        try:
            chip_id = l.get("chip_id")
            if not chip_id:
                continue
            chip = await _db.chips.find_one({"_id": ObjectId(chip_id)})
            iccid = chip.get("iccid") if chip else None
            if not iccid:
                continue
            resp = await _operadora_service.consultar_linha(
                iccid=iccid, db=_db, user_id=user["id"], user_name=user["name"],
            )
            if not getattr(resp, "success", False):
                erros.append({"linha_id": str(l["_id"]), "iccid": iccid, "erro": getattr(resp, "message", "falha")})
                continue
            raw = getattr(resp, "data", None) or {}
            data_expiracao = await _extrair_data_expiracao(raw)
            if not data_expiracao:
                sem_expiracao += 1
                continue
            await _db.linhas.update_one(
                {"_id": l["_id"]},
                {"$set": {"data_expiracao_ta": data_expiracao, "data_expiracao_ta_sync_em": datetime.now(timezone.utc)}},
            )
            updated += 1
            # Delay leve para nao estourar rate limit
            import asyncio as _asyncio
            await _asyncio.sleep(0.15)
        except Exception as e:
            erros.append({"linha_id": str(l["_id"]), "erro": str(e)})

    await _create_log(
        "automacao_bloqueio",
        f"Sync expiracao Ta: {updated} atualizadas, {sem_expiracao} sem campo, {len(erros)} erros de {len(linhas)}",
        user["id"], user["name"],
    )
    return {"total_linhas": len(linhas), "atualizadas": updated, "sem_expiracao": sem_expiracao, "erros": erros}


# ==================== DESBLOQUEIO DE CONFIANCA ====================

class DesbloqueioConfiancaRequest(BaseModel):
    dias: int = 2  # prazo em dias
    motivo: Optional[str] = None


@router.post("/linhas/{linha_id}/desbloqueio-confianca")
async def desbloqueio_confianca(linha_id: str, data: DesbloqueioConfiancaRequest, request: Request):
    """Admin desbloqueia temporariamente uma linha. Se boleto nao for pago ate expira_em, sistema re-bloqueia."""
    user = await _require_admin(request)
    if data.dias < 1 or data.dias > 30:
        raise HTTPException(status_code=400, detail="Prazo deve estar entre 1 e 30 dias")
    try:
        linha = await _db.linhas.find_one({"_id": ObjectId(linha_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="linha_id invalido")
    if not linha:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")

    chip_id = linha.get("chip_id")
    if not chip_id:
        raise HTTPException(status_code=400, detail="Linha sem chip vinculado")
    chip = await _db.chips.find_one({"_id": ObjectId(chip_id)})
    if not chip:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")

    # Chama desbloqueio na Ta
    try:
        resp = await _operadora_service.desbloquear(iccid=chip["iccid"], db=_db, user_id=user["id"], user_name=user["name"])
        if not resp.success:
            raise HTTPException(status_code=400, detail=f"Ta Telecom: {resp.message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Ta: {e}")

    expira_em = datetime.now(timezone.utc) + timedelta(days=data.dias)
    await _db.linhas.update_one(
        {"_id": ObjectId(linha_id)},
        {"$set": {
            "status": "ativo",
            "bloqueio_automatico.ativo": False,
            "desbloqueio_confianca": {
                "ativo": True,
                "concedido_em": datetime.now(timezone.utc),
                "concedido_por": user["id"],
                "concedido_por_nome": user["name"],
                "expira_em": expira_em,
                "dias": data.dias,
                "motivo": data.motivo,
            },
        }},
    )
    await _db.chips.update_one({"_id": ObjectId(chip_id)}, {"$set": {"status": "ativado"}})
    await _create_log(
        "automacao_bloqueio",
        f"Desbloqueio de confianca linha {linha_id} por {data.dias} dias (motivo: {data.motivo or 'nao informado'})",
        user["id"], user["name"],
    )
    return {
        "success": True,
        "linha_id": linha_id,
        "expira_em": expira_em.isoformat(),
        "dias": data.dias,
    }


@router.get("/desbloqueios-confianca")
async def list_desbloqueios_confianca(request: Request):
    """Lista desbloqueios de confianca ATIVOS (nao expirados)."""
    await _require_admin(request)
    agora = datetime.now(timezone.utc)
    linhas = await _db.linhas.find({
        "desbloqueio_confianca.ativo": True,
        "desbloqueio_confianca.expira_em": {"$gte": agora},
    }).to_list(500)
    result = []
    for l in linhas:
        cliente = None
        if l.get("cliente_id"):
            try:
                cliente = await _db.clientes.find_one({"_id": ObjectId(l["cliente_id"])})
            except Exception:
                pass
        dc = l.get("desbloqueio_confianca", {}) or {}
        result.append({
            "linha_id": str(l["_id"]),
            "cliente_nome": cliente.get("nome") if cliente else None,
            "msisdn": l.get("msisdn") or l.get("numero"),
            "concedido_em": dc.get("concedido_em"),
            "concedido_por_nome": dc.get("concedido_por_nome"),
            "expira_em": dc.get("expira_em"),
            "dias": dc.get("dias"),
            "motivo": dc.get("motivo"),
        })
    result.sort(key=lambda x: x.get("expira_em") or datetime.max.replace(tzinfo=timezone.utc))
    return result


async def _executar_reblock_confianca_expirada():
    """Worker: re-bloqueia linhas com desbloqueio de confianca expirado (E ainda inadimplentes)."""
    agora = datetime.now(timezone.utc)
    linhas = await _db.linhas.find({
        "status": "ativo",
        "desbloqueio_confianca.ativo": True,
        "desbloqueio_confianca.expira_em": {"$lte": agora},
    }).to_list(500)

    rebloqueadas = 0
    for l in linhas:
        cliente_id = str(l.get("cliente_id") or "")
        if not cliente_id:
            continue
        # Verificacao: ainda esta inadimplente?
        hoje = agora.date().isoformat()
        cob_pendente = await _db.cobrancas.find_one({
            "cliente_id": cliente_id,
            "vencimento": {"$lte": hoje},
            "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]},
        })
        if not cob_pendente:
            # Cliente pagou - apenas desativa a flag (nao precisa re-bloquear)
            await _db.linhas.update_one({"_id": l["_id"]}, {"$set": {"desbloqueio_confianca.ativo": False}})
            continue

        # Ainda em atraso -> re-bloquear
        try:
            chip = await _db.chips.find_one({"_id": ObjectId(l["chip_id"])}) if l.get("chip_id") else None
            if not chip:
                continue
            result = await _operadora_service.bloquear_total(
                iccid=chip["iccid"], reason=15, db=_db, user_id="sistema", user_name="Automacao",
            )
            if result.success:
                await _db.linhas.update_one(
                    {"_id": l["_id"]},
                    {"$set": {
                        "status": "bloqueado",
                        "desbloqueio_confianca.ativo": False,
                        "desbloqueio_confianca.reblocked_em": agora,
                        "bloqueio_automatico": {"ativo": True, "data": agora, "motivo": "confianca_expirada"},
                    }},
                )
                await _db.chips.update_one({"_id": chip["_id"]}, {"$set": {"status": "bloqueado"}})
                rebloqueadas += 1
        except Exception as e:
            logger.warning(f"Re-bloqueio confianca falhou linha {l['_id']}: {e}")

    if rebloqueadas > 0:
        await _create_log("automacao_bloqueio", f"Re-bloqueio confianca expirada: {rebloqueadas} linhas", None, "Automacao")
    return rebloqueadas


async def _get_whitelist_set() -> set:
    docs = await _db.automacao_bloqueio_whitelist.find({}, {"cliente_id": 1}).to_list(5000)
    return {d["cliente_id"] for d in docs}


async def _cliente_ja_pagou_no_mes(cliente_id: str, vencimento: str, origem: str = "cobranca") -> bool:
    """
    Verifica se o cliente esta "em dia" para o CICLO ATUAL.

    - origem="expiracao_ta" (rota v2, bloqueio por expiracao Ta): a janela do ciclo
      e [vencimento - 30d, vencimento]. Considera em dia se pagou algo nessa janela.
      Isso e crucial: quem pagou o ciclo anterior mas NAO pagou o atual sera bloqueado.
    - origem="cobranca" (rota antiga): mantem janela mensal e 60 dias corridos
      (retrocompatibilidade — nao usada mais no fluxo principal).
    """
    if not vencimento:
        return False
    paid_statuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]

    # ============ ROTA V2 (expiracao_ta): janela de 30 dias do ciclo Ta ============
    if origem == "expiracao_ta":
        try:
            venc_dt = datetime.strptime(vencimento[:10], "%Y-%m-%d").date()
        except Exception:
            return False
        # Janela: [venc - 30d, venc + 3d] (3 dias de graca pos-vencimento p/ pagamentos tardios)
        ciclo_inicio = (venc_dt - timedelta(days=30)).isoformat()
        ciclo_fim = (venc_dt + timedelta(days=3)).isoformat()

        # (1) LOCAL: cobranca paga com vencimento dentro do ciclo atual
        paga_ciclo = await _db.cobrancas.find_one({
            "cliente_id": str(cliente_id),
            "vencimento": {"$gte": ciclo_inicio, "$lte": ciclo_fim},
            "status": {"$in": paid_statuses},
        })
        if paga_ciclo:
            return True

        # (2) LOCAL: paid_at dentro do ciclo atual (cobranca de outro periodo mas paga no ciclo)
        limite_dt = datetime.now(timezone.utc) - timedelta(days=30)
        paga_recente = await _db.cobrancas.find_one({
            "cliente_id": str(cliente_id),
            "status": {"$in": paid_statuses},
            "$or": [
                {"paid_at": {"$gte": limite_dt}},
                {"paid_at": {"$gte": limite_dt.isoformat()}},
            ],
        })
        if paga_recente:
            return True

        # (3) ASAAS: pagamento confirmado nos ultimos 30 dias
        if _asaas_service and getattr(_asaas_service, "is_configured", False):
            try:
                cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
                asaas_customer_id = cliente.get("asaas_customer_id") if cliente else None
                if asaas_customer_id:
                    for st in ("RECEIVED", "CONFIRMED"):
                        result = await _asaas_service.list_payments(
                            customer_id=asaas_customer_id, limit=20, status=st,
                        )
                        pagamentos = result.get("data", []) if isinstance(result, dict) else []
                        limite_30d = (datetime.now(timezone.utc) - timedelta(days=30)).date()
                        for p in pagamentos:
                            pd_raw = p.get("paymentDate") or p.get("confirmedDate") or p.get("clientPaymentDate")
                            if not pd_raw:
                                continue
                            try:
                                pd = datetime.strptime(pd_raw[:10], "%Y-%m-%d").date()
                                if pd >= limite_30d:
                                    return True
                            except Exception:
                                pass
            except Exception as e:
                logger.warning(f"Falha ao consultar historico Asaas cliente {cliente_id}: {e}")

        return False

    # ============ ROTA LEGACY (origem=cobranca): comportamento antigo ============
    # (1) mesma janela mensal
    try:
        ano, mes, _ = vencimento.split("-")
        import calendar
        last_day = calendar.monthrange(int(ano), int(mes))[1]
        inicio_mes = f"{ano}-{mes}-01"
        fim_mes = f"{ano}-{mes}-{last_day:02d}"
        paga = await _db.cobrancas.find_one({
            "cliente_id": str(cliente_id),
            "vencimento": {"$gte": inicio_mes, "$lte": fim_mes},
            "status": {"$in": paid_statuses},
        })
        if paga:
            return True
    except Exception:
        pass

    # (2) pagou cobranca com vencimento >= vencimento pendente (adiantou futura)
    paga_futura = await _db.cobrancas.find_one({
        "cliente_id": str(cliente_id),
        "vencimento": {"$gte": vencimento},
        "status": {"$in": paid_statuses},
    })
    if paga_futura:
        return True

    # (3) pagou algo nos ultimos 60 dias corridos (paid_at recente)
    limite_dt = datetime.now(timezone.utc) - timedelta(days=60)
    paga_recente = await _db.cobrancas.find_one({
        "cliente_id": str(cliente_id),
        "status": {"$in": paid_statuses},
        "$or": [
            {"paid_at": {"$gte": limite_dt}},
            {"paid_at": {"$gte": limite_dt.isoformat()}},
        ],
    })
    if paga_recente:
        return True

    # (4) FONTE DA VERDADE: consulta Asaas por pagamentos do cliente
    if _asaas_service and getattr(_asaas_service, "is_configured", False):
        try:
            cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
            asaas_customer_id = cliente.get("asaas_customer_id") if cliente else None
            if asaas_customer_id:
                for st in ("RECEIVED", "CONFIRMED"):
                    result = await _asaas_service.list_payments(
                        customer_id=asaas_customer_id, limit=20, status=st,
                    )
                    pagamentos = result.get("data", []) if isinstance(result, dict) else []
                    limite_60d = (datetime.now(timezone.utc) - timedelta(days=60)).date()
                    for p in pagamentos:
                        pd_raw = p.get("paymentDate") or p.get("confirmedDate") or p.get("clientPaymentDate")
                        if not pd_raw:
                            continue
                        try:
                            pd = datetime.strptime(pd_raw[:10], "%Y-%m-%d").date()
                            if pd >= limite_60d:
                                return True
                        except Exception:
                            pass
        except Exception as e:
            logger.warning(f"Falha ao consultar historico Asaas cliente {cliente_id}: {e}")

    return False


@router.get("/diagnosticar/{cliente_id}")
async def diagnosticar_cliente(cliente_id: str, request: Request):
    """Retorna diagnostico completo do cliente: cobrancas, status, motivo pelo qual
    aparece (ou nao) na lista de bloqueio. Ferramenta para o admin auditar casos duvidosos."""
    await _require_admin(request)
    try:
        cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="cliente_id invalido")
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    # Todas as cobrancas do cliente (ultimos 12 meses + futuras)
    cobrancas = await _db.cobrancas.find({"cliente_id": cliente_id}).sort("vencimento", -1).to_list(50)

    # Whitelist?
    wl = await _db.automacao_bloqueio_whitelist.find_one({"cliente_id": cliente_id})

    # Linhas do cliente
    linhas = await _db.linhas.find({"cliente_id": cliente_id}).to_list(20)

    # Detectar quais cobrancas estao "vencidas e nao pagas" (candidatas a bloqueio)
    hoje = datetime.now(timezone.utc).date().isoformat()
    candidatas_bloqueio = []
    for c in cobrancas:
        v = c.get("vencimento")
        st = c.get("status")
        if v and v <= hoje and st not in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
            em_dia = await _cliente_ja_pagou_no_mes(cliente_id, v)
            candidatas_bloqueio.append({
                "cobranca_id": str(c["_id"]),
                "vencimento": v,
                "status": st,
                "valor": c.get("valor"),
                "descricao": c.get("descricao"),
                "paga_no_asaas": None,  # nao consulta aqui (custoso)
                "cliente_em_dia_local": em_dia,
                "seria_bloqueada": (not em_dia) and (not wl),
            })

    return {
        "cliente": {
            "id": str(cliente["_id"]),
            "nome": cliente.get("nome"),
            "documento": cliente.get("documento"),
            "telefone": cliente.get("telefone"),
        },
        "na_whitelist": bool(wl),
        "motivo_whitelist": wl.get("motivo") if wl else None,
        "total_cobrancas": len(cobrancas),
        "cobrancas": [
            {
                "id": str(c["_id"]),
                "vencimento": c.get("vencimento"),
                "status": c.get("status"),
                "valor": c.get("valor"),
                "descricao": c.get("descricao"),
                "paid_at": str(c.get("paid_at")) if c.get("paid_at") else None,
                "asaas_payment_id": c.get("asaas_payment_id"),
            }
            for c in cobrancas
        ],
        "linhas": [
            {"id": str(l["_id"]), "msisdn": l.get("msisdn") or l.get("numero"), "status": l.get("status")}
            for l in linhas
        ],
        "candidatas_bloqueio": candidatas_bloqueio,
        "resumo": {
            "seria_bloqueado": any(x["seria_bloqueada"] for x in candidatas_bloqueio),
            "motivo": "whitelist" if wl else (
                "cliente_em_dia (pagou recente/futura/mesmo_mes)" if candidatas_bloqueio and all(x["cliente_em_dia_local"] for x in candidatas_bloqueio)
                else "seria_bloqueado_por_inadimplencia" if candidatas_bloqueio
                else "sem_cobrancas_vencidas"
            ),
        },
    }


async def _verificar_pagamento_final_asaas(cobranca_id: str) -> dict:
    """
    DUPLA-CHECAGEM CRITICA (anti-bloqueio-indevido).
    Consulta o pagamento diretamente no Asaas antes de bloquear.
    Retorna dict com {pode_bloquear: bool, motivo: str, status: str}
    Se qualquer duvida -> pode_bloquear=False (fail-safe: nao bloqueia em caso de erro).
    """
    if not _asaas_service or not getattr(_asaas_service, "is_configured", False):
        # Asaas nao configurado -> nao arriscar
        return {"pode_bloquear": False, "motivo": "asaas_nao_configurado", "status": None}

    try:
        cob = await _db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    except Exception:
        return {"pode_bloquear": False, "motivo": "cobranca_id_invalido", "status": None}
    if not cob:
        return {"pode_bloquear": False, "motivo": "cobranca_nao_encontrada", "status": None}

    payment_id = cob.get("asaas_payment_id")
    if not payment_id:
        # Sem payment_id no Asaas (cobranca puramente local) - usa status local
        st = cob.get("status")
        if st in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
            return {"pode_bloquear": False, "motivo": "ja_paga_local", "status": st}
        return {"pode_bloquear": True, "motivo": "sem_asaas_id_status_pendente", "status": st}

    # Tentar consultar Asaas com retry (429 rate limit)
    import asyncio as _asyncio
    for tentativa in range(3):
        try:
            payment_data = await _asaas_service.get_payment(payment_id)
            status_asaas = payment_data.get("status") if payment_data else None
            if not status_asaas:
                return {"pode_bloquear": False, "motivo": "resposta_asaas_vazia", "status": None}
            # Atualiza local ja aproveitando a consulta
            if status_asaas != cob.get("status"):
                update_fields = {"status": status_asaas}
                if status_asaas in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
                    update_fields["paid_at"] = payment_data.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
                await _db.cobrancas.update_one({"_id": cob["_id"]}, {"$set": update_fields})
            if status_asaas in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
                return {"pode_bloquear": False, "motivo": "pago_no_asaas", "status": status_asaas}
            return {"pode_bloquear": True, "motivo": "confirmado_pendente_asaas", "status": status_asaas}
        except Exception as e:
            err_msg = str(e)
            # Rate limit -> retry com backoff
            if "429" in err_msg and tentativa < 2:
                await _asyncio.sleep(2 * (tentativa + 1))
                continue
            logger.warning(f"Falha consulta final Asaas cobranca={cobranca_id} tentativa={tentativa+1}: {err_msg}")
            # Fail-safe: nao bloquear em caso de erro
            return {"pode_bloquear": False, "motivo": f"erro_asaas: {err_msg[:100]}", "status": None}

    return {"pode_bloquear": False, "motivo": "esgotou_tentativas", "status": None}


async def _build_simulacao(dias_tolerancia: int = 0) -> List[dict]:
    cobrancas = await _find_cobrancas_para_bloquear(dias_tolerancia)
    whitelist = await _get_whitelist_set()

    resultado = []
    # Agrupar por cliente para evitar bloquear 2x
    processados = set()
    for cob in cobrancas:
        cliente_id = str(cob.get("cliente_id") or "")
        if not cliente_id or cliente_id in processados:
            continue

        # Ja pagou algum boleto do ciclo? Skip
        origem = cob.get("origem", "cobranca")
        if await _cliente_ja_pagou_no_mes(cliente_id, cob.get("vencimento", ""), origem=origem):
            continue

        cliente = None
        try:
            cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
        except Exception:
            continue
        if not cliente:
            continue

        # Buscar linhas ativas do cliente
        linhas_ativas = await _db.linhas.find({
            "cliente_id": cliente_id,
            "status": {"$in": ["ativo"]},
        }).to_list(50)
        if not linhas_ativas:
            continue  # nao ha linha ativa para bloquear

        na_whitelist = cliente_id in whitelist
        resultado.append({
            "cliente_id": cliente_id,
            "cliente_nome": cliente.get("nome"),
            "documento": cliente.get("documento"),
            "telefone": cliente.get("telefone"),
            "cobranca_id": str(cob["_id"]),
            "valor": cob.get("valor"),
            "vencimento": cob.get("vencimento"),
            "descricao": cob.get("descricao"),
            "origem": cob.get("origem", "cobranca"),
            "data_expiracao_ta": cob.get("data_expiracao_ta"),
            "linhas_afetadas": [{"linha_id": str(l["_id"]), "msisdn": l.get("msisdn") or l.get("numero"), "data_expiracao_ta": l.get("data_expiracao_ta")} for l in linhas_ativas],
            "na_whitelist": na_whitelist,
            "acao": "SKIP_WHITELIST" if na_whitelist else "BLOQUEAR",
        })
        processados.add(cliente_id)
    return resultado


@router.get("/painel")
async def painel_bloqueio(request: Request):
    """
    Painel central: retorna todas as linhas ATIVAS + BLOQUEADAS com informacoes
    consolidadas para alimentar a tabela de controle da tela.

    Situacoes (badges):
      - em_dia: pagou o ciclo atual E expira em > +5 dias
      - avisar: bloqueio HOMEON entre +1 e +5 dias E nao pagou
      - vence_hoje: bloqueio HOMEON = hoje E nao pagou
      - vencido: bloqueio HOMEON <= hoje-1 E nao pagou (pronto pra bloquear)
      - bloqueado: linha ja esta com status "bloqueado"
      - confianca: possui desbloqueio_confianca_ate >= hoje
      - vip: cliente esta na whitelist
      - sem_expiracao: linha ativa sem data_expiracao_ta sincronizada
    """
    await _require_admin(request)
    hoje = datetime.now(timezone.utc).date()

    # Carrega whitelist
    wl_docs = await _db.automacao_bloqueio_whitelist.find().to_list(5000)
    whitelist = {d["cliente_id"] for d in wl_docs}

    # Carrega todas as linhas relevantes (ativo + bloqueado)
    linhas = await _db.linhas.find({"status": {"$in": ["ativo", "bloqueado"]}}).to_list(10000)

    resultado = []
    kpi_ativas = 0
    kpi_a_vencer_7d = 0
    kpi_vence_hoje = 0
    kpi_bloqueadas = 0
    kpi_sem_expiracao = 0

    # Cache de clientes por id
    cliente_cache = {}

    for l in linhas:
        cliente_id = l.get("cliente_id")
        if not cliente_id:
            continue

        # Cliente
        if cliente_id in cliente_cache:
            cliente = cliente_cache[cliente_id]
        else:
            try:
                cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)}, {"nome": 1, "documento": 1, "telefone": 1})
            except Exception:
                cliente = None
            cliente_cache[cliente_id] = cliente

        if not cliente:
            continue

        status_linha = l.get("status", "ativo")
        exp_ta = l.get("data_expiracao_ta")
        exp_ta_valid = _is_valid_iso_date(exp_ta)
        exp_ta_str = exp_ta[:10] if exp_ta_valid else None

        # Bloqueio HOMEON = exp_ta - 2 dias
        bloqueio_homeon = None
        dias_ate_bloqueio = None
        if exp_ta_valid:
            try:
                exp_dt = datetime.strptime(exp_ta_str, "%Y-%m-%d").date()
                bloq_dt = exp_dt - timedelta(days=2)
                bloqueio_homeon = bloq_dt.isoformat()
                dias_ate_bloqueio = (bloq_dt - hoje).days
            except Exception:
                pass

        # Boleto vigente: pega a cobranca ABERTA mais proxima (menor vencimento >= algum threshold)
        # Preferimos: PENDING/OVERDUE mais antigo; se nao houver, o pago mais recente
        cob_aberta = await _db.cobrancas.find({
            "cliente_id": str(cliente_id),
            "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "CANCELLED", "REFUNDED"]},
        }).sort("vencimento", 1).limit(1).to_list(1)

        boleto = None
        boleto_status = None
        if cob_aberta:
            c = cob_aberta[0]
            venc = c.get("vencimento")
            venc_dt = None
            if venc:
                try:
                    venc_dt = datetime.strptime(venc[:10], "%Y-%m-%d").date()
                except Exception:
                    pass
            boleto = {
                "id": str(c.get("_id")),
                "valor": c.get("valor"),
                "vencimento": venc,
                "descricao": c.get("descricao"),
                "asaas_status": c.get("status"),
                "asaas_payment_id": c.get("asaas_payment_id"),
                "asaas_invoice_url": c.get("asaas_invoice_url") or c.get("invoice_url") or c.get("bank_slip_url"),
            }
            if venc_dt and venc_dt < hoje:
                boleto_status = "vencido"
            else:
                boleto_status = "pendente"
        else:
            # Verifica se ha cobranca paga no ciclo
            if exp_ta_valid:
                paga_ciclo = await _db.cobrancas.find_one({
                    "cliente_id": str(cliente_id),
                    "status": {"$in": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]},
                })
                if paga_ciclo:
                    boleto_status = "pago"

        # Desbloqueio de confianca ativo?
        confianca_ate = l.get("desbloqueio_confianca_ate")
        confianca_ativo = False
        if confianca_ate:
            try:
                ca_dt = datetime.strptime(confianca_ate[:10], "%Y-%m-%d").date()
                confianca_ativo = ca_dt >= hoje
            except Exception:
                pass

        # === Determinar SITUACAO ===
        situacao = None
        na_whitelist = str(cliente_id) in whitelist

        if status_linha == "bloqueado":
            situacao = "bloqueado"
            kpi_bloqueadas += 1
        elif na_whitelist:
            situacao = "vip"
        elif confianca_ativo:
            situacao = "confianca"
        elif not exp_ta_valid:
            situacao = "sem_expiracao"
            kpi_sem_expiracao += 1
        elif dias_ate_bloqueio is not None:
            pago_ciclo = boleto_status == "pago"
            if dias_ate_bloqueio < 0 and not pago_ciclo:
                situacao = "vencido"
            elif dias_ate_bloqueio == 0 and not pago_ciclo:
                situacao = "vence_hoje"
                kpi_vence_hoje += 1
            elif 1 <= dias_ate_bloqueio <= 5 and not pago_ciclo:
                situacao = "avisar"
                kpi_a_vencer_7d += 1
            elif dias_ate_bloqueio > 5 or pago_ciclo:
                situacao = "em_dia"
            else:
                situacao = "avisar"

        if status_linha == "ativo":
            kpi_ativas += 1
        if dias_ate_bloqueio is not None and 0 <= dias_ate_bloqueio <= 7:
            if situacao not in ("bloqueado", "vip", "confianca"):
                kpi_a_vencer_7d += 0  # ja contado acima

        # Verifica se ja enviou lembrete D-3 para este ciclo
        lembrete_d3_enviado = False
        if exp_ta_valid:
            log_l = await _db.automacao_lembretes_log.find_one({
                "cliente_id": str(cliente_id),
                "tipo": "d3",
                "ciclo_ref": exp_ta_str,
            })
            lembrete_d3_enviado = bool(log_l)

        resultado.append({
            "linha_id": str(l["_id"]),
            "cliente_id": str(cliente_id),
            "cliente_nome": cliente.get("nome"),
            "documento": cliente.get("documento"),
            "telefone": cliente.get("telefone"),
            "msisdn": l.get("msisdn") or l.get("numero"),
            "status_linha": status_linha,
            "data_expiracao_ta": exp_ta_str,
            "bloqueio_homeon": bloqueio_homeon,
            "dias_ate_bloqueio": dias_ate_bloqueio,
            "boleto": boleto,
            "boleto_status": boleto_status,
            "situacao": situacao,
            "na_whitelist": na_whitelist,
            "desbloqueio_confianca_ate": confianca_ate if confianca_ativo else None,
            "lembrete_d3_enviado": lembrete_d3_enviado,
        })

    # KPIs
    kpis = {
        "total": len(resultado),
        "ativas": kpi_ativas,
        "bloqueadas": kpi_bloqueadas,
        "vence_hoje": kpi_vence_hoje,
        "a_vencer_7d": kpi_a_vencer_7d,
        "sem_expiracao": kpi_sem_expiracao,
    }

    return {"itens": resultado, "kpis": kpis, "hoje": hoje.isoformat()}


@router.get("/simular")
async def simular_bloqueio(request: Request, dias_tolerancia: int = 0):
    """Mostra quem seria bloqueado se rodasse agora (dry run)."""
    await _require_admin(request)
    itens = await _build_simulacao(dias_tolerancia)
    total = len(itens)
    a_bloquear = sum(1 for i in itens if i["acao"] == "BLOQUEAR")
    return {
        "total": total,
        "a_bloquear": a_bloquear,
        "skip_whitelist": total - a_bloquear,
        "itens": itens,
    }


class ExecutarRequest(BaseModel):
    dry_run: bool = False
    dias_tolerancia: int = 0


@router.post("/executar")
async def executar_bloqueio(data: ExecutarRequest, request: Request):
    """Executa job de bloqueio manualmente. Se dry_run, apenas simula sem chamar a Ta Telecom."""
    user = await _require_admin(request)
    resultado = await _executar_job_bloqueio(dias_tolerancia=data.dias_tolerancia, dry_run=data.dry_run, disparado_por=user)
    return resultado


async def _executar_job_bloqueio(dias_tolerancia: int = 0, dry_run: bool = False, disparado_por: Optional[dict] = None) -> dict:
    """Core do job: percorre inadimplentes e bloqueia. Retorna resumo."""
    cfg = await _get_config()
    motivo = cfg.get("motivo_bloqueio", 15)

    # SALVAGUARDA: sincroniza status com Asaas antes de decidir quem bloquear
    # (skip em dry_run: dry_run e apenas simulacao rapida sem chamadas ao Asaas)
    sync_result = None
    if not dry_run and cfg.get("sync_asaas_antes_bloqueio", True) and _sync_asaas_fn:
        try:
            sync_result = await _sync_asaas_fn()
            logger.info(f"Sync Asaas pre-bloqueio: {sync_result}")
        except Exception as e:
            logger.error(f"Falha ao sincronizar com Asaas antes do bloqueio: {e}")
            sync_result = {"error": str(e)}

    itens = await _build_simulacao(dias_tolerancia)

    bloqueadas = 0
    puladas_whitelist = 0
    erros = []
    detalhes = []
    pulados_pagamento_asaas = 0
    pagamentos_verificados = 0

    for item in itens:
        if item["na_whitelist"]:
            puladas_whitelist += 1
            continue

        # DUPLA-CHECAGEM INDIVIDUAL: consulta o Asaas naquele pagamento especifico
        # Fail-safe: em caso de erro NAO bloqueia (evita bloqueio indevido)
        if not dry_run:
            verificacao = await _verificar_pagamento_final_asaas(item["cobranca_id"])
            pagamentos_verificados += 1
            if not verificacao["pode_bloquear"]:
                pulados_pagamento_asaas += 1
                detalhes.append({
                    "cliente_nome": item.get("cliente_nome"),
                    "cobranca_id": item["cobranca_id"],
                    "acao": "PULADO",
                    "motivo": verificacao["motivo"],
                    "status_asaas": verificacao.get("status"),
                })
                logger.info(f"Bloqueio pulado (fail-safe): cliente={item.get('cliente_nome')} motivo={verificacao['motivo']}")
                continue

        for l_info in item["linhas_afetadas"]:
            linha_id = l_info["linha_id"]
            try:
                linha = await _db.linhas.find_one({"_id": ObjectId(linha_id)})
                if not linha:
                    continue
                chip = await _db.chips.find_one({"_id": ObjectId(linha["chip_id"])}) if linha.get("chip_id") else None
                if not chip:
                    erros.append({"linha_id": linha_id, "erro": "chip nao encontrado"})
                    continue

                if not dry_run:
                    disparado_id = (disparado_por or {}).get("id", "sistema")
                    disparado_name = (disparado_por or {}).get("name", "Automacao")
                    result = await _operadora_service.bloquear_total(
                        iccid=chip["iccid"], reason=motivo, db=_db,
                        user_id=disparado_id, user_name=disparado_name,
                    )
                    if result.success:
                        await _db.linhas.update_one(
                            {"_id": ObjectId(linha_id)},
                            {"$set": {
                                "status": "bloqueado",
                                "bloqueio_automatico": {
                                    "ativo": True,
                                    "data": datetime.now(timezone.utc),
                                    "motivo": "inadimplencia",
                                    "cobranca_id": item["cobranca_id"],
                                },
                            }},
                        )
                        await _db.chips.update_one(
                            {"_id": ObjectId(linha["chip_id"])},
                            {"$set": {"status": "bloqueado"}},
                        )
                        bloqueadas += 1

                        # Enviar WhatsApp de aviso de bloqueio (best effort)
                        try:
                            telefone = item.get("telefone")
                            if telefone and cfg.get("notificar_admin"):
                                msg = (cfg.get("mensagem_bloqueado") or "").format(
                                    nome=item.get("cliente_nome") or "",
                                    valor=f"{item.get('valor', 0):.2f}",
                                    vencimento=item.get("vencimento") or "",
                                )
                                await _zapi_service.send_text(phone=telefone, message=msg)
                        except Exception as e:
                            logger.warning(f"Falha ao enviar WhatsApp bloqueio {linha_id}: {e}")
                    else:
                        erros.append({"linha_id": linha_id, "erro": result.message or "falha bloqueio"})
                else:
                    bloqueadas += 1  # em dry_run, apenas conta

                detalhes.append({
                    "linha_id": linha_id,
                    "cliente_nome": item.get("cliente_nome"),
                    "msisdn": l_info.get("msisdn"),
                    "vencimento": item.get("vencimento"),
                    "valor": item.get("valor"),
                    "dry_run": dry_run,
                })
            except Exception as e:
                logger.error(f"Erro bloqueio automatico linha {linha_id}: {e}")
                erros.append({"linha_id": linha_id, "erro": str(e)})

    resumo = {
        "success": True,
        "dry_run": dry_run,
        "total_inadimplentes": len(itens),
        "bloqueadas": bloqueadas,
        "puladas_whitelist": puladas_whitelist,
        "pulados_pagamento_asaas": pulados_pagamento_asaas,
        "pagamentos_verificados_asaas": pagamentos_verificados,
        "erros": erros,
        "detalhes": detalhes,
        "sync_asaas": sync_result,
        "executado_em": datetime.now(timezone.utc).isoformat(),
    }

    if not dry_run:
        await _create_log(
            "automacao_bloqueio",
            f"Job de bloqueio: {bloqueadas} bloqueadas, {puladas_whitelist} whitelist, {pulados_pagamento_asaas} pulados por pagamento/erro Asaas (fail-safe), {len(erros)} erros",
            (disparado_por or {}).get("id"),
            (disparado_por or {}).get("name", "Automacao"),
        )
    return resumo


async def _construir_link_boleto(cob: dict) -> str:
    """Retorna o melhor link disponivel de pagamento para a cobranca."""
    for k in ("asaas_invoice_url", "invoice_url", "bank_slip_url", "pix_qr_code_image", "pix_copy_paste"):
        v = cob.get(k)
        if v:
            return v
    return "https://mvno.homeonapp.com.br/portal"


async def _linhas_por_situacao(situacoes: List[str]) -> List[dict]:
    """
    Retorna linhas ativas cuja situacao esteja em `situacoes` (avisar/vence_hoje/vencido).
    Reutiliza a mesma logica do endpoint /painel mas de forma simplificada.
    """
    hoje = datetime.now(timezone.utc).date()
    wl_docs = await _db.automacao_bloqueio_whitelist.find().to_list(5000)
    whitelist = {d["cliente_id"] for d in wl_docs}

    linhas = await _db.linhas.find({"status": "ativo", "data_expiracao_ta": {"$ne": None}}).to_list(10000)
    out = []
    for l in linhas:
        cid = str(l.get("cliente_id") or "")
        if not cid or cid in whitelist:
            continue
        exp = l.get("data_expiracao_ta")
        if not _is_valid_iso_date(exp):
            continue
        try:
            exp_dt = datetime.strptime(exp[:10], "%Y-%m-%d").date()
        except Exception:
            continue
        dias = (exp_dt - timedelta(days=2) - hoje).days

        # Descobrir situacao
        situacao = None
        if dias < 0:
            situacao = "vencido"
        elif dias == 0:
            situacao = "vence_hoje"
        elif 1 <= dias <= 5:
            situacao = "avisar"
        else:
            continue

        if situacao not in situacoes:
            continue

        # Confirma que nao pagou o ciclo
        if await _cliente_ja_pagou_no_mes(cid, exp[:10], origem="expiracao_ta"):
            continue

        # Confianca ativa? Skip
        ca = l.get("desbloqueio_confianca_ate")
        if ca and _is_valid_iso_date(ca):
            try:
                if datetime.strptime(ca[:10], "%Y-%m-%d").date() >= hoje:
                    continue
            except Exception:
                pass

        out.append({
            "linha": l,
            "situacao": situacao,
            "data_expiracao_ta": exp[:10],
            "bloqueio_homeon": (exp_dt - timedelta(days=2)).isoformat(),
            "dias_ate_bloqueio": dias,
        })
    return out


async def _enviar_lembrete_para_cliente(cliente: dict, cob: Optional[dict], linha_info: dict, tipo: str, cfg: dict) -> dict:
    """Envia um lembrete WhatsApp (tipo=d3 ou d0) para um cliente com dedup automatica.

    Regras:
      - d3: dedup por (cliente, ciclo_ref=data_expiracao_ta) — envia UMA vez por ciclo.
      - d0: sempre envia (mensagem de urgencia).
    """
    if not _zapi_service:
        return {"ok": False, "erro": "zapi_service nao configurado"}
    telefone = cliente.get("telefone")
    if not telefone:
        return {"ok": False, "erro": "sem telefone"}

    ciclo_ref = linha_info.get("data_expiracao_ta")
    cliente_id = str(cliente.get("_id"))

    # Dedup para D-3
    if tipo == "d3":
        exists = await _db.automacao_lembretes_log.find_one({
            "cliente_id": cliente_id,
            "tipo": "d3",
            "ciclo_ref": ciclo_ref,
        })
        if exists:
            return {"ok": False, "erro": "ja_enviado_no_ciclo", "skipped": True}

    # Escolhe template
    template = cfg.get("mensagem_aviso") if tipo == "d3" else cfg.get("mensagem_alerta_d0")
    if not template:
        return {"ok": False, "erro": "template ausente"}

    msg = template.format(
        nome=cliente.get("nome") or "",
        msisdn=linha_info.get("msisdn") or "",
        valor=f"{(cob or {}).get('valor', 0):.2f}",
        vencimento=(cob or {}).get("vencimento") or "",
        data_bloqueio=linha_info.get("bloqueio_homeon") or "",
        data_expiracao=linha_info.get("data_expiracao_ta") or "",
        link=await _construir_link_boleto(cob or {}),
    )

    try:
        await _zapi_service.send_text(phone=telefone, message=msg)
    except Exception as e:
        return {"ok": False, "erro": str(e)}

    # Registra no log de dedup
    if tipo == "d3":
        try:
            await _db.automacao_lembretes_log.insert_one({
                "cliente_id": cliente_id,
                "tipo": "d3",
                "ciclo_ref": ciclo_ref,
                "enviado_em": datetime.now(timezone.utc),
                "msisdn": linha_info.get("msisdn"),
            })
        except Exception as e:
            logger.warning(f"Falha ao gravar log dedup lembrete: {e}")

    return {"ok": True}


async def _executar_job_aviso() -> dict:
    """
    Job D-3: envia WhatsApp 3 dias antes do bloqueio HOMEON (= exp_ta - 2 dias).
    Ou seja: envia quando dias_ate_bloqueio_homeon == 3.
    Dedup: 1x por cliente por ciclo Ta (usa data_expiracao_ta como ciclo_ref).
    """
    cfg = await _get_config()
    if not cfg.get("enviar_lembrete_d3", True):
        return {"skipped": True, "motivo": "enviar_lembrete_d3 desativado"}

    candidatos = await _linhas_por_situacao(["avisar"])
    # Filtrar so os que estao a EXATAMENTE 3 dias do bloqueio (nao inunda a cada dia)
    candidatos = [c for c in candidatos if c["dias_ate_bloqueio"] == 3]

    enviados = 0
    skipped = 0
    erros = []
    processados = set()

    for cand in candidatos:
        l = cand["linha"]
        cid = str(l.get("cliente_id"))
        if cid in processados:
            continue
        processados.add(cid)

        cliente = await _db.clientes.find_one({"_id": ObjectId(cid)})
        if not cliente:
            continue

        # Boleto vigente
        cob = await _db.cobrancas.find_one({
            "cliente_id": cid,
            "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "CANCELLED", "REFUNDED"]},
        }, sort=[("vencimento", 1)])

        linha_info = {
            "msisdn": l.get("msisdn") or l.get("numero"),
            "data_expiracao_ta": cand["data_expiracao_ta"],
            "bloqueio_homeon": cand["bloqueio_homeon"],
        }
        r = await _enviar_lembrete_para_cliente(cliente, cob, linha_info, "d3", cfg)
        if r.get("ok"):
            enviados += 1
        elif r.get("skipped"):
            skipped += 1
        else:
            erros.append({"cliente_id": cid, "erro": r.get("erro")})

    await _create_log("automacao_bloqueio", f"Job D-3: {enviados} enviados, {skipped} dedup, {len(erros)} erros", None, "Automacao")
    return {"tipo": "d3", "enviados": enviados, "skipped_dedup": skipped, "erros": erros, "candidatos": len(candidatos)}


async def _executar_job_alerta_d0() -> dict:
    """
    Job D-0: envia WhatsApp no dia do bloqueio HOMEON (situacao=vence_hoje).
    Sem dedup — se o cron rodar 2x (edge case), enviara 2x (comportamento intencional para urgencia).
    """
    cfg = await _get_config()
    if not cfg.get("enviar_alerta_d0", True):
        return {"skipped": True, "motivo": "enviar_alerta_d0 desativado"}

    candidatos = await _linhas_por_situacao(["vence_hoje"])
    enviados = 0
    erros = []
    processados = set()

    for cand in candidatos:
        l = cand["linha"]
        cid = str(l.get("cliente_id"))
        if cid in processados:
            continue
        processados.add(cid)

        cliente = await _db.clientes.find_one({"_id": ObjectId(cid)})
        if not cliente:
            continue

        cob = await _db.cobrancas.find_one({
            "cliente_id": cid,
            "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "CANCELLED", "REFUNDED"]},
        }, sort=[("vencimento", 1)])

        linha_info = {
            "msisdn": l.get("msisdn") or l.get("numero"),
            "data_expiracao_ta": cand["data_expiracao_ta"],
            "bloqueio_homeon": cand["bloqueio_homeon"],
        }
        r = await _enviar_lembrete_para_cliente(cliente, cob, linha_info, "d0", cfg)
        if r.get("ok"):
            enviados += 1
        else:
            erros.append({"cliente_id": cid, "erro": r.get("erro")})

    await _create_log("automacao_bloqueio", f"Job D-0: {enviados} alertas 'vence hoje' enviados, {len(erros)} erros", None, "Automacao")
    return {"tipo": "d0", "enviados": enviados, "erros": erros, "candidatos": len(candidatos)}


# ==================== ENDPOINTS DE LEMBRETE MANUAL ====================

class EnviarLembreteRequest(BaseModel):
    linha_ids: List[str]
    tipo: str = "d3"  # d3 ou d0


@router.post("/enviar-lembrete")
async def enviar_lembrete_massa(data: EnviarLembreteRequest, request: Request):
    """Envia lembrete manual para uma lista de linhas (respeita dedup em d3)."""
    user = await _require_admin(request)
    cfg = await _get_config()
    if data.tipo not in ("d3", "d0"):
        raise HTTPException(status_code=400, detail="tipo deve ser 'd3' ou 'd0'")

    enviados = 0
    skipped = 0
    erros = []

    for lid in data.linha_ids:
        try:
            l = await _db.linhas.find_one({"_id": ObjectId(lid)})
            if not l:
                erros.append({"linha_id": lid, "erro": "linha nao encontrada"})
                continue
            cid = str(l.get("cliente_id") or "")
            cliente = await _db.clientes.find_one({"_id": ObjectId(cid)}) if cid else None
            if not cliente:
                erros.append({"linha_id": lid, "erro": "cliente nao encontrado"})
                continue

            exp = l.get("data_expiracao_ta")
            if not _is_valid_iso_date(exp):
                erros.append({"linha_id": lid, "erro": "linha sem data_expiracao_ta"})
                continue
            exp_str = exp[:10]
            exp_dt = datetime.strptime(exp_str, "%Y-%m-%d").date()

            cob = await _db.cobrancas.find_one({
                "cliente_id": cid,
                "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "CANCELLED", "REFUNDED"]},
            }, sort=[("vencimento", 1)])

            linha_info = {
                "msisdn": l.get("msisdn") or l.get("numero"),
                "data_expiracao_ta": exp_str,
                "bloqueio_homeon": (exp_dt - timedelta(days=2)).isoformat(),
            }
            r = await _enviar_lembrete_para_cliente(cliente, cob, linha_info, data.tipo, cfg)
            if r.get("ok"):
                enviados += 1
            elif r.get("skipped"):
                skipped += 1
            else:
                erros.append({"linha_id": lid, "erro": r.get("erro")})
        except Exception as e:
            erros.append({"linha_id": lid, "erro": str(e)})

    await _create_log("automacao_bloqueio", f"Envio manual de lembrete {data.tipo}: {enviados} enviados, {skipped} dedup, {len(erros)} erros", user["id"], user["name"])
    return {"tipo": data.tipo, "enviados": enviados, "skipped_dedup": skipped, "erros": erros, "total": len(data.linha_ids)}


@router.post("/executar-lembrete-d3")
async def executar_lembrete_d3(request: Request):
    """Dispara manualmente o job D-3 (mesma logica que o cron)."""
    user = await _require_admin(request)
    r = await _executar_job_aviso()
    await _create_log("automacao_bloqueio", f"Job D-3 disparado manualmente por {user['name']}", user["id"], user["name"])
    return r


@router.post("/executar-alerta-d0")
async def executar_alerta_d0(request: Request):
    """Dispara manualmente o job D-0 (mesma logica que o cron)."""
    user = await _require_admin(request)
    r = await _executar_job_alerta_d0()
    await _create_log("automacao_bloqueio", f"Job D-0 disparado manualmente por {user['name']}", user["id"], user["name"])
    return r





# ==================== DESBLOQUEIO AUTOMATICO ====================

async def desbloquear_por_pagamento(cobranca: dict):
    """Chamado quando webhook Asaas confirma pagamento.
    Desbloqueia todas as linhas do cliente que foram bloqueadas pela automacao."""
    cfg = await _get_config()
    if not cfg.get("desbloqueio_automatico", True):
        return {"skipped": True, "motivo": "desbloqueio_automatico desativado"}

    cliente_id = str(cobranca.get("cliente_id") or "")
    if not cliente_id:
        return {"skipped": True, "motivo": "sem cliente_id"}

    linhas_bloqueadas = await _db.linhas.find({
        "cliente_id": cliente_id,
        "status": "bloqueado",
        "bloqueio_automatico.ativo": True,
    }).to_list(50)

    if not linhas_bloqueadas:
        return {"skipped": True, "motivo": "nenhuma linha bloqueada automaticamente"}

    desbloqueadas = 0
    erros = []
    cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})

    for linha in linhas_bloqueadas:
        try:
            chip = await _db.chips.find_one({"_id": ObjectId(linha["chip_id"])}) if linha.get("chip_id") else None
            if not chip:
                continue
            result = await _operadora_service.desbloquear(
                iccid=chip["iccid"], db=_db, user_id="sistema", user_name="Automacao",
            )
            if result.success:
                await _db.linhas.update_one(
                    {"_id": linha["_id"]},
                    {"$set": {"status": "ativo", "bloqueio_automatico.ativo": False, "bloqueio_automatico.desbloqueado_em": datetime.now(timezone.utc)}},
                )
                await _db.chips.update_one(
                    {"_id": ObjectId(linha["chip_id"])},
                    {"$set": {"status": "ativado"}},
                )
                desbloqueadas += 1

                # Enviar WhatsApp de confirmacao (best effort)
                try:
                    if cliente and cliente.get("telefone"):
                        msg = (cfg.get("mensagem_desbloqueado") or "").format(
                            nome=cliente.get("nome") or "",
                            valor=f"{cobranca.get('valor', 0):.2f}",
                            vencimento=cobranca.get("vencimento") or "",
                        )
                        await _zapi_service.send_text(phone=cliente["telefone"], message=msg)
                except Exception as e:
                    logger.warning(f"WhatsApp desbloqueio falhou: {e}")
            else:
                erros.append({"linha_id": str(linha["_id"]), "erro": result.message})
        except Exception as e:
            logger.error(f"Erro desbloqueio automatico linha {linha.get('_id')}: {e}")
            erros.append({"linha_id": str(linha.get("_id")), "erro": str(e)})

    await _create_log(
        "automacao_bloqueio",
        f"Desbloqueio automatico apos pagamento: {desbloqueadas} linhas do cliente {cliente.get('nome') if cliente else cliente_id}",
        None, "Automacao",
    )
    return {"desbloqueadas": desbloqueadas, "erros": erros}


# ==================== HISTORICO ====================

@router.get("/historico")
async def get_historico(request: Request, limit: int = 100):
    await _require_admin(request)
    docs = await _db.logs.find({"categoria": "automacao_bloqueio"}).sort("data", -1).limit(limit).to_list(limit)
    return [
        {
            "id": str(d["_id"]),
            "descricao": d.get("descricao"),
            "user_name": d.get("user_name"),
            "data": d.get("data"),
        }
        for d in docs
    ]


# ==================== WORKER BACKGROUND ====================

_worker_state = {"last_bloqueio_hour": None, "last_aviso_hour": None}


async def _worker_loop():
    """Loop infinito que verifica de hora em hora se e a hora certa para rodar os jobs."""
    logger.info("Worker de automacao de bloqueio iniciado")
    while True:
        try:
            await asyncio.sleep(60 * 5)  # verifica a cada 5 minutos
            cfg = await _get_config()
            if not cfg.get("ativo", False):
                continue

            agora = datetime.now(timezone.utc)
            # Converter para hora local (Brasil = UTC-3)
            hora_br = (agora.hour - 3) % 24
            data_br_str = (agora - timedelta(hours=3)).strftime("%Y-%m-%d")

            # Job D-3 (lembrete 3 dias antes)
            hora_aviso = cfg.get("hora_aviso", 9)
            marker_aviso = f"{data_br_str}-d3"
            if hora_br == hora_aviso and cfg.get("enviar_lembrete_d3", True) and _worker_state.get("last_aviso_hour") != marker_aviso:
                logger.info(f"Executando job D-3 (lembrete WhatsApp) ({hora_br}h BRT)")
                try:
                    await _executar_job_aviso()
                    _worker_state["last_aviso_hour"] = marker_aviso
                except Exception as e:
                    logger.error(f"Job D-3 falhou: {e}", exc_info=True)

            # Job D-0 (alerta vence hoje)
            hora_d0 = cfg.get("hora_alerta_d0", 12)
            marker_d0 = f"{data_br_str}-d0"
            if hora_br == hora_d0 and cfg.get("enviar_alerta_d0", True) and _worker_state.get("last_d0_hour") != marker_d0:
                logger.info(f"Executando job D-0 (alerta vence hoje) ({hora_br}h BRT)")
                try:
                    await _executar_job_alerta_d0()
                    _worker_state["last_d0_hour"] = marker_d0
                except Exception as e:
                    logger.error(f"Job D-0 falhou: {e}", exc_info=True)

            # Job de bloqueio (D-2 da expiracao Ta)
            hora_bloqueio = cfg.get("hora_bloqueio", 14)
            marker_bloqueio = f"{data_br_str}-bloq"
            if hora_br == hora_bloqueio and cfg.get("executar_bloqueio_auto", True) and _worker_state.get("last_bloqueio_hour") != marker_bloqueio:
                logger.info(f"Executando job de bloqueio automatico ({hora_br}h BRT)")
                try:
                    await _executar_job_bloqueio(dias_tolerancia=0, dry_run=False, disparado_por={"id": "sistema", "name": "Automacao"})
                    _worker_state["last_bloqueio_hour"] = marker_bloqueio
                except Exception as e:
                    logger.error(f"Job de bloqueio falhou: {e}", exc_info=True)

            # Re-bloqueio de confianca expirada (a cada hora)
            try:
                await _executar_reblock_confianca_expirada()
            except Exception as e:
                logger.error(f"Re-bloqueio confianca falhou: {e}", exc_info=True)

        except asyncio.CancelledError:
            logger.info("Worker de automacao cancelado")
            break
        except Exception as e:
            logger.error(f"Erro no worker de automacao: {e}", exc_info=True)


def start_worker():
    """Deve ser chamado no startup do app."""
    asyncio.create_task(_worker_loop())
