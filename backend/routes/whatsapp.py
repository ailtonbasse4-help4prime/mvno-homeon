"""Rotas de WhatsApp via Z-API: configuracao, envio individual e em lote de cobrancas."""
import asyncio
import random
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

_ctx = {}


def init(db, get_current_user, require_admin, create_log):
    _ctx["db"] = db
    _ctx["get_current_user"] = get_current_user
    _ctx["require_admin"] = require_admin
    _ctx["create_log"] = create_log


# ============================================================
# CONFIG
# ============================================================
class ZapiConfigUpdate(BaseModel):
    instance_id: str
    token: str
    client_token: str


class TemplateUpdate(BaseModel):
    template: str


@router.get("/config")
async def get_config(request: Request):
    await _ctx["require_admin"](request)
    db = _ctx["db"]
    cfg = await db.config.find_one({"key": "zapi"}) or {}
    tpl = await db.config.find_one({"key": "zapi_template"}) or {}
    # Mascara as chaves para nao expor totalmente
    def mask(s):
        if not s or len(s) < 8:
            return ""
        return s[:4] + "*" * (len(s) - 8) + s[-4:]
    return {
        "configured": bool(cfg.get("instance_id") and cfg.get("token") and cfg.get("client_token")),
        "instance_id_masked": mask(cfg.get("instance_id") or ""),
        "token_masked": mask(cfg.get("token") or ""),
        "client_token_masked": mask(cfg.get("client_token") or ""),
        "template": tpl.get("template", _DEFAULT_TEMPLATE),
        "rate_limit_per_hour": (await db.config.find_one({"key": "zapi_rate"}) or {}).get("limit", 30),
    }


@router.post("/config")
async def save_config(data: ZapiConfigUpdate, request: Request):
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    from services.zapi_service import zapi_service
    await zapi_service.save_config(db, data.instance_id.strip(), data.token.strip(), data.client_token.strip())
    await _ctx["create_log"]("whatsapp", "Config Z-API salva", user["id"], user["name"])
    return {"success": True, "configured": zapi_service.is_configured()}


@router.get("/status")
async def status_zapi(request: Request):
    """Verifica se a instancia esta conectada (QR Code escaneado)."""
    await _ctx["require_admin"](request)
    from services.zapi_service import zapi_service
    if not zapi_service.is_configured():
        await zapi_service.load_config(_ctx["db"])
    return await zapi_service.status_instance()


# ============================================================
# TEMPLATE
# ============================================================
_DEFAULT_TEMPLATE = (
    "Olá {nome}! 👋\n\n"
    "Sua fatura HomeOn está disponível:\n"
    "💰 Valor: R$ {valor}\n"
    "📅 Vencimento: {data}\n\n"
    "🔗 Pague aqui: {link}\n\n"
    "📎 O boleto em PDF também está anexado abaixo.\n\n"
    "Qualquer dúvida estamos por aqui!\n"
    "HomeOn Internet"
)


@router.post("/template")
async def save_template(data: TemplateUpdate, request: Request):
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    await db.config.update_one(
        {"key": "zapi_template"},
        {"$set": {"key": "zapi_template", "template": data.template, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await _ctx["create_log"]("whatsapp", "Template Z-API atualizado", user["id"], user["name"])
    return {"success": True}


def _render_template(template: str, cobranca: dict, cliente: dict) -> str:
    """Substitui placeholders {nome}, {valor}, {data}, {link}, {pix}, {primeiro_nome}."""
    nome = cliente.get("nome") or "Cliente"
    primeiro_nome = nome.split()[0] if nome else "Cliente"
    valor = cobranca.get("valor") or 0
    valor_str = f"{float(valor):.2f}".replace(".", ",")
    venc = cobranca.get("vencimento") or ""
    if venc:
        try:
            venc = datetime.fromisoformat(str(venc)[:10]).strftime("%d/%m/%Y")
        except Exception:
            venc = str(venc)[:10]
    link = cobranca.get("invoice_url") or cobranca.get("bank_slip_url") or cobranca.get("link") or ""
    pix = cobranca.get("pix_copia_cola") or ""
    return (template
            .replace("{primeiro_nome}", primeiro_nome)
            .replace("{nome}", nome)
            .replace("{valor}", valor_str)
            .replace("{data}", venc)
            .replace("{vencimento}", venc)
            .replace("{link}", link)
            .replace("{pix}", pix))


# ============================================================
# ENVIO INDIVIDUAL
# ============================================================
class EnvioIndividual(BaseModel):
    cobranca_id: str
    template: Optional[str] = None  # opcional, usa o salvo se nao passado


async def _enviar_cobranca_completa(zapi_service, cobranca: dict, cliente: dict, template: str) -> dict:
    """Envia mensagem de texto + PDF do boleto (se houver). Retorna dict consolidado.

    Estrategia:
      1. Sempre envia o texto principal (template renderizado)
      2. Se tem `asaas_bankslip_url` (PDF do boleto), envia como documento PDF
    """
    telefone = cliente.get("telefone") or cliente.get("celular") or ""
    mensagem = _render_template(template, cobranca, cliente)

    # 1. Envia texto
    text_resp = await zapi_service.send_text(telefone, mensagem)
    result = {
        "success": text_resp.get("success", False),
        "text_message_id": text_resp.get("message_id"),
        "phone_normalized": text_resp.get("phone_normalized"),
        "error": text_resp.get("error"),
    }

    # 2. Se texto OK e tem PDF do boleto, anexa
    pdf_url = cobranca.get("asaas_bankslip_url") or ""
    if result["success"] and pdf_url:
        cliente_nome = (cliente.get("nome") or "cliente").strip().split()[0]
        venc = (cobranca.get("vencimento") or "")[:10]
        file_name = f"boleto-{cliente_nome}-{venc}.pdf".replace(" ", "_")
        await asyncio.sleep(1.5)  # pequena pausa entre texto e PDF
        pdf_resp = await zapi_service.send_document_pdf(
            telefone, pdf_url, file_name=file_name
        )
        result["pdf_sent"] = pdf_resp.get("success", False)
        result["pdf_message_id"] = pdf_resp.get("message_id")
        if not pdf_resp.get("success"):
            result["pdf_error"] = pdf_resp.get("error")
    else:
        result["pdf_sent"] = False
        if not pdf_url and result["success"]:
            result["pdf_error"] = "Sem URL do PDF do boleto"

    result["mensagem"] = mensagem
    return result


@router.post("/enviar-cobranca")
async def enviar_cobranca_individual(data: EnvioIndividual, request: Request):
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    from services.zapi_service import zapi_service
    if not zapi_service.is_configured():
        await zapi_service.load_config(db)
    if not zapi_service.is_configured():
        raise HTTPException(status_code=400, detail="Z-API nao configurado")

    if not ObjectId.is_valid(data.cobranca_id):
        raise HTTPException(status_code=400, detail="ID invalido")
    cobranca = await db.cobrancas.find_one({"_id": ObjectId(data.cobranca_id)})
    if not cobranca:
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")

    cliente_id = cobranca.get("cliente_id")
    cliente = None
    if cliente_id and ObjectId.is_valid(cliente_id):
        cliente = await db.clientes.find_one({"_id": ObjectId(cliente_id)})
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente nao encontrado")

    telefone = cliente.get("telefone") or cliente.get("celular") or ""
    if not telefone:
        raise HTTPException(status_code=400, detail="Cliente sem telefone cadastrado")

    template = data.template
    if not template:
        tpl_doc = await db.config.find_one({"key": "zapi_template"})
        template = (tpl_doc or {}).get("template") or _DEFAULT_TEMPLATE

    resp = await _enviar_cobranca_completa(zapi_service, cobranca, cliente, template)

    # Log do envio
    await db.zapi_envios.insert_one({
        "cobranca_id": data.cobranca_id,
        "cliente_id": cliente_id,
        "cliente_nome": cliente.get("nome"),
        "telefone": telefone,
        "telefone_normalizado": resp.get("phone_normalized"),
        "mensagem": resp.get("mensagem"),
        "success": resp.get("success", False),
        "pdf_sent": resp.get("pdf_sent", False),
        "pdf_error": resp.get("pdf_error"),
        "error": resp.get("error"),
        "message_id": resp.get("text_message_id"),
        "pdf_message_id": resp.get("pdf_message_id"),
        "tipo": "individual",
        "user_id": user["id"],
        "timestamp": datetime.now(timezone.utc),
    })
    return resp


# ============================================================
# ENVIO EM LOTE
# ============================================================
class EnvioLoteRequest(BaseModel):
    cobranca_ids: List[str]
    template: Optional[str] = None
    delay_min_seconds: int = 5
    delay_max_seconds: int = 8


@router.post("/enviar-lote")
async def enviar_lote(data: EnvioLoteRequest, request: Request):
    """Dispara envio em lote em background. Retorna job_id pra acompanhar."""
    user = await _ctx["require_admin"](request)
    db = _ctx["db"]
    from services.zapi_service import zapi_service
    if not zapi_service.is_configured():
        await zapi_service.load_config(db)
    if not zapi_service.is_configured():
        raise HTTPException(status_code=400, detail="Z-API nao configurado")

    if not data.cobranca_ids:
        raise HTTPException(status_code=400, detail="Lista de cobrancas vazia")

    # Verifica se ja tem job rodando
    existing = await db.zapi_jobs.find_one({"status": "running"})
    if existing:
        return {
            "status": "already_running",
            "message": "Ja existe um envio em andamento",
            "job_id": existing["job_id"],
        }

    job_id = f"zapi-lote-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    await db.zapi_jobs.insert_one({
        "job_id": job_id,
        "status": "running",
        "iniciado_em": datetime.now(timezone.utc),
        "total": len(data.cobranca_ids),
        "enviadas": 0,
        "erros": 0,
        "user_id": user["id"],
    })

    template = data.template
    if not template:
        tpl_doc = await db.config.find_one({"key": "zapi_template"})
        template = (tpl_doc or {}).get("template") or _DEFAULT_TEMPLATE

    asyncio.create_task(_run_lote_bg(
        job_id=job_id,
        cobranca_ids=data.cobranca_ids,
        template=template,
        delay_min=max(2, data.delay_min_seconds),
        delay_max=max(data.delay_min_seconds + 1, data.delay_max_seconds),
        user_id=user["id"],
        user_name=user["name"],
    ))

    return {"status": "started", "job_id": job_id, "total": len(data.cobranca_ids)}


async def _run_lote_bg(job_id: str, cobranca_ids: list, template: str,
                       delay_min: int, delay_max: int, user_id: str, user_name: str):
    db = _ctx["db"]
    from services.zapi_service import zapi_service
    enviadas = 0
    erros = 0
    detalhes = []

    try:
        for idx, cid in enumerate(cobranca_ids):
            # Permite cancelar via flag no job
            job = await db.zapi_jobs.find_one({"job_id": job_id})
            if job and job.get("cancel_requested"):
                await db.zapi_jobs.update_one({"job_id": job_id}, {"$set": {
                    "status": "cancelled",
                    "finalizado_em": datetime.now(timezone.utc),
                    "enviadas": enviadas, "erros": erros,
                }})
                return

            if not ObjectId.is_valid(cid):
                erros += 1
                detalhes.append({"cobranca_id": cid, "error": "ID invalido"})
                continue

            cobranca = await db.cobrancas.find_one({"_id": ObjectId(cid)})
            if not cobranca:
                erros += 1
                detalhes.append({"cobranca_id": cid, "error": "Cobranca nao encontrada"})
                continue

            cliente_id = cobranca.get("cliente_id")
            cliente = None
            if cliente_id and ObjectId.is_valid(cliente_id):
                cliente = await db.clientes.find_one({"_id": ObjectId(cliente_id)})
            if not cliente:
                erros += 1
                detalhes.append({"cobranca_id": cid, "error": "Cliente nao encontrado"})
                continue

            telefone = cliente.get("telefone") or cliente.get("celular") or ""
            if not telefone:
                erros += 1
                detalhes.append({"cobranca_id": cid, "cliente": cliente.get("nome"), "error": "Sem telefone"})
                await db.zapi_envios.insert_one({
                    "cobranca_id": cid, "cliente_id": cliente_id, "cliente_nome": cliente.get("nome"),
                    "telefone": "", "success": False, "error": "Sem telefone",
                    "tipo": "lote", "job_id": job_id, "user_id": user_id,
                    "timestamp": datetime.now(timezone.utc),
                })
                continue

            mensagem = _render_template(template, cobranca, cliente)
            resp = await _enviar_cobranca_completa(zapi_service, cobranca, cliente, template)

            await db.zapi_envios.insert_one({
                "cobranca_id": cid, "cliente_id": cliente_id, "cliente_nome": cliente.get("nome"),
                "telefone": telefone, "telefone_normalizado": resp.get("phone_normalized"),
                "mensagem": mensagem,
                "success": resp.get("success", False),
                "pdf_sent": resp.get("pdf_sent", False),
                "pdf_error": resp.get("pdf_error"),
                "error": resp.get("error"),
                "message_id": resp.get("text_message_id"),
                "pdf_message_id": resp.get("pdf_message_id"),
                "tipo": "lote", "job_id": job_id, "user_id": user_id,
                "timestamp": datetime.now(timezone.utc),
            })

            if resp.get("success"):
                enviadas += 1
            else:
                erros += 1
                detalhes.append({"cobranca_id": cid, "cliente": cliente.get("nome"), "error": resp.get("error")})

            # Atualiza progresso a cada 3 envios
            if (idx + 1) % 3 == 0 or idx == len(cobranca_ids) - 1:
                await db.zapi_jobs.update_one({"job_id": job_id}, {"$set": {
                    "processadas": idx + 1, "enviadas": enviadas, "erros": erros,
                }})

            # Delay aleatorio anti-banimento (exceto na ultima)
            if idx < len(cobranca_ids) - 1:
                await asyncio.sleep(random.uniform(delay_min, delay_max))

        await db.zapi_jobs.update_one({"job_id": job_id}, {"$set": {
            "status": "completed",
            "finalizado_em": datetime.now(timezone.utc),
            "enviadas": enviadas, "erros": erros,
            "erros_detalhes": detalhes[:50],
        }})
        await _ctx["create_log"]("whatsapp", f"Lote Z-API: {enviadas}/{len(cobranca_ids)} enviadas", user_id, user_name)
    except Exception as e:
        logger.exception("Erro no lote Z-API")
        await db.zapi_jobs.update_one({"job_id": job_id}, {"$set": {
            "status": "error",
            "finalizado_em": datetime.now(timezone.utc),
            "error_message": str(e)[:500],
            "enviadas": enviadas, "erros": erros,
        }})


@router.get("/job-status")
async def job_status(request: Request, job_id: Optional[str] = None):
    await _ctx["require_admin"](request)
    db = _ctx["db"]
    if job_id:
        job = await db.zapi_jobs.find_one({"job_id": job_id})
    else:
        job = await db.zapi_jobs.find_one({}, sort=[("iniciado_em", -1)])
    if not job:
        return {"status": "never_run"}
    return {
        "job_id": job.get("job_id"),
        "status": job.get("status"),
        "total": job.get("total", 0),
        "processadas": job.get("processadas", 0),
        "enviadas": job.get("enviadas", 0),
        "erros": job.get("erros", 0),
        "iniciado_em": job.get("iniciado_em").isoformat() if job.get("iniciado_em") else None,
        "finalizado_em": job.get("finalizado_em").isoformat() if job.get("finalizado_em") else None,
        "error_message": job.get("error_message"),
        "erros_detalhes": job.get("erros_detalhes", [])[:20],
    }


@router.post("/cancelar-job")
async def cancelar_job(request: Request, job_id: str):
    await _ctx["require_admin"](request)
    db = _ctx["db"]
    await db.zapi_jobs.update_one({"job_id": job_id, "status": "running"},
                                  {"$set": {"cancel_requested": True}})
    return {"success": True}


# ============================================================
# HISTORICO
# ============================================================
@router.get("/historico")
async def historico(request: Request, limit: int = 200):
    await _ctx["require_admin"](request)
    db = _ctx["db"]
    docs = await db.zapi_envios.find({}).sort("timestamp", -1).limit(min(limit, 1000)).to_list(min(limit, 1000))
    result = []
    for d in docs:
        result.append({
            "id": str(d["_id"]),
            "cobranca_id": d.get("cobranca_id"),
            "cliente_nome": d.get("cliente_nome"),
            "telefone": d.get("telefone"),
            "mensagem": (d.get("mensagem") or "")[:200],
            "success": d.get("success", False),
            "error": d.get("error"),
            "tipo": d.get("tipo"),
            "job_id": d.get("job_id"),
            "timestamp": d.get("timestamp").isoformat() if d.get("timestamp") else None,
        })
    return result
