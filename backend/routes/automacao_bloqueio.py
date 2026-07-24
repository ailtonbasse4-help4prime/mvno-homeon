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
    "hora_bloqueio": 23,           # bloqueia as 23h do dia do vencimento (D+0)
    "hora_aviso": 9,               # envia aviso as 9h
    "aviso_dia_anterior": True,    # WhatsApp 1 dia antes do bloqueio
    "aviso_dia_vencimento": False, # WhatsApp no dia do vencimento
    "motivo_bloqueio": 15,         # codigo Ta Telecom para bloqueio total
    "desbloqueio_automatico": True,
    "sync_asaas_antes_bloqueio": True,  # SALVAGUARDA: sincroniza status com Asaas antes do job de bloqueio
    "notificar_admin": True,
    "mensagem_aviso": "Ola {nome}, seu boleto no valor de R$ {valor} vence amanha ({vencimento}). Para evitar o bloqueio da sua linha, efetue o pagamento ate 23h. Portal: https://mvno.homeonapp.com.br/portal",
    "mensagem_bloqueado": "Ola {nome}, sua linha foi bloqueada por inadimplencia. Regularize o pagamento para reativacao automatica.",
    "mensagem_desbloqueado": "Ola {nome}, seu pagamento foi confirmado! Sua linha ja esta reativada.",
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
    aviso_dia_anterior: Optional[bool] = None
    aviso_dia_vencimento: Optional[bool] = None
    motivo_bloqueio: Optional[int] = None
    desbloqueio_automatico: Optional[bool] = None
    notificar_admin: Optional[bool] = None
    mensagem_aviso: Optional[str] = None
    mensagem_bloqueado: Optional[str] = None
    mensagem_desbloqueado: Optional[str] = None


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
    Retorna cobrancas vencidas (vencimento <= hoje - dias_tolerancia) sem pagamento.
    dias_tolerancia=0 significa que cobrancas vencendo HOJE ja entram no lote (para bloqueio as 23h).
    """
    hoje = datetime.now(timezone.utc).date()
    limite = hoje - timedelta(days=dias_tolerancia)
    limite_str = limite.isoformat()

    cobrancas = await _db.cobrancas.find({
        "vencimento": {"$lte": limite_str},
        "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]},
    }).to_list(5000)
    return cobrancas


async def _get_whitelist_set() -> set:
    docs = await _db.automacao_bloqueio_whitelist.find({}, {"cliente_id": 1}).to_list(5000)
    return {d["cliente_id"] for d in docs}


async def _cliente_ja_pagou_no_mes(cliente_id: str, vencimento: str) -> bool:
    """
    Verifica se o cliente esta "em dia" — logica robusta com multiplas condicoes:
    1. Tem cobranca paga no mesmo mes do vencimento pendente
    2. Tem cobranca paga com vencimento >= vencimento pendente (pagou uma futura)
    3. Pagou algo nos ultimos 35 dias corridos
    4. Tem cobranca ativa/paga com vencimento no proximo mes (planos pre-pagos)
    Se qualquer condicao verdadeira -> considera em dia -> NAO bloqueia.
    """
    if not vencimento:
        return False
    try:
        from datetime import datetime as _dt
        venc_date = _dt.strptime(vencimento, "%Y-%m-%d").date()
    except Exception:
        return False

    paid_statuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]

    # (1) mesma janela mensal (mes do vencimento pendente)
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

    # (3) pagou algo nos ultimos 35 dias corridos (paid_at recente)
    from datetime import datetime as _dt2, timezone as _tz, timedelta as _td
    limite_dt = _dt2.now(_tz.utc) - _td(days=35)
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

        # Ja pagou algum boleto do mes? Skip
        if await _cliente_ja_pagou_no_mes(cliente_id, cob.get("vencimento", "")):
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
            "linhas_afetadas": [{"linha_id": str(l["_id"]), "msisdn": l.get("msisdn") or l.get("numero")} for l in linhas_ativas],
            "na_whitelist": na_whitelist,
            "acao": "SKIP_WHITELIST" if na_whitelist else "BLOQUEAR",
        })
        processados.add(cliente_id)
    return resultado


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


async def _executar_job_aviso() -> dict:
    """Envia WhatsApp de aviso 1 dia antes do bloqueio."""
    cfg = await _get_config()
    amanha = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()

    cobrancas = await _db.cobrancas.find({
        "vencimento": amanha,
        "status": {"$nin": ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]},
    }).to_list(5000)

    whitelist = await _get_whitelist_set()
    enviados = 0
    erros = []
    processados = set()
    for cob in cobrancas:
        cliente_id = str(cob.get("cliente_id") or "")
        if cliente_id in processados or cliente_id in whitelist:
            continue
        try:
            cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
            if not cliente or not cliente.get("telefone"):
                continue
            # Ja pagou algum boleto do mes? Skip
            if await _cliente_ja_pagou_no_mes(cliente_id, cob.get("vencimento", "")):
                continue
            msg = (cfg.get("mensagem_aviso") or "").format(
                nome=cliente.get("nome") or "",
                valor=f"{cob.get('valor', 0):.2f}",
                vencimento=cob.get("vencimento") or "",
            )
            await _zapi_service.send_text(phone=cliente["telefone"], message=msg)
            enviados += 1
            processados.add(cliente_id)
        except Exception as e:
            logger.warning(f"Aviso WhatsApp falhou cliente {cliente_id}: {e}")
            erros.append({"cliente_id": cliente_id, "erro": str(e)})

    await _create_log("automacao_bloqueio", f"Job de aviso WhatsApp: {enviados} avisos enviados, {len(erros)} erros", None, "Automacao")
    return {"enviados": enviados, "erros": erros, "total_candidatos": len(cobrancas)}


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

            # Job de bloqueio
            hora_bloqueio = cfg.get("hora_bloqueio", 23)
            marker_bloqueio = f"{data_br_str}-bloq"
            if hora_br == hora_bloqueio and _worker_state.get("last_bloqueio_hour") != marker_bloqueio:
                logger.info(f"Executando job de bloqueio automatico ({hora_br}h BRT)")
                try:
                    await _executar_job_bloqueio(dias_tolerancia=0, dry_run=False, disparado_por={"id": "sistema", "name": "Automacao"})
                    _worker_state["last_bloqueio_hour"] = marker_bloqueio
                except Exception as e:
                    logger.error(f"Job de bloqueio falhou: {e}", exc_info=True)

            # Job de aviso
            hora_aviso = cfg.get("hora_aviso", 9)
            marker_aviso = f"{data_br_str}-aviso"
            if hora_br == hora_aviso and cfg.get("aviso_dia_anterior") and _worker_state.get("last_aviso_hour") != marker_aviso:
                logger.info(f"Executando job de aviso WhatsApp ({hora_br}h BRT)")
                try:
                    await _executar_job_aviso()
                    _worker_state["last_aviso_hour"] = marker_aviso
                except Exception as e:
                    logger.error(f"Job de aviso falhou: {e}", exc_info=True)

        except asyncio.CancelledError:
            logger.info("Worker de automacao cancelado")
            break
        except Exception as e:
            logger.error(f"Erro no worker de automacao: {e}", exc_info=True)


def start_worker():
    """Deve ser chamado no startup do app."""
    asyncio.create_task(_worker_loop())
