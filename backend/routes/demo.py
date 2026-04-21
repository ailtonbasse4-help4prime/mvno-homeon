"""Modulo DEMO - Rastreamento de acessos a pagina de demonstracao publica.

Esta rota NAO toca em dados de producao. Apenas registra acessos na colecao
`demo_accesses` para o admin acompanhar quantas pessoas visitaram a demo.
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import hashlib

router = APIRouter(prefix="/demo", tags=["demo"])

# Injetado em setup
_db = None
_require_admin = None


def init(db, require_admin):
    global _db, _require_admin
    _db = db
    _require_admin = require_admin


class AccessPayload(BaseModel):
    path: Optional[str] = None  # rota dentro da demo (ex: /demo/operacional)
    referrer: Optional[str] = None


def _client_ip(request: Request) -> str:
    # Confia em X-Forwarded-For se houver (Nginx/proxy)
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _anon_id(request: Request) -> str:
    """Gera um identificador pseudoanonimo (hash de IP+UA) para contar visitantes unicos."""
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")
    return hashlib.sha256(f"{ip}|{ua}".encode()).hexdigest()[:16]


@router.post("/access")
async def register_access(payload: AccessPayload, request: Request):
    """Registra um acesso a pagina demo (publico, sem auth)."""
    doc = {
        "anon_id": _anon_id(request),
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:300],
        "referrer": (payload.referrer or request.headers.get("referer") or "")[:300],
        "path": (payload.path or "")[:120],
        "timestamp": datetime.now(timezone.utc),
    }
    await _db.demo_accesses.insert_one(doc)
    return {"ok": True}


@router.get("/stats")
async def demo_stats(_user=Depends(lambda: None)):
    """Estatisticas de acessos. Protegido por admin via dependency injection externa."""
    if _require_admin is None:
        raise HTTPException(status_code=500, detail="Admin dep nao inicializado")
    # Workaround: validamos admin aqui diretamente via dependency
    # (Fastapi nao aceita Depends dinamico bem, entao usamos o helper abaixo)
    raise HTTPException(status_code=500, detail="Use /stats-admin")


@router.get("/stats-admin")
async def demo_stats_admin(current_user=Depends(lambda: None)):
    """Estatisticas detalhadas (admin only). Registrado via wrapper em server.py."""
    # Implementado via wrapper em server.py que injeta o require_admin
    raise HTTPException(status_code=501, detail="Use endpoint registrado em server")


async def get_stats_data():
    """Funcao interna usada pelo wrapper para pegar stats."""
    total = await _db.demo_accesses.count_documents({})
    unique_ids = await _db.demo_accesses.distinct("anon_id")
    unique = len(unique_ids)

    now = datetime.now(timezone.utc)
    last_24h = await _db.demo_accesses.count_documents({"timestamp": {"$gte": now - timedelta(hours=24)}})
    last_7d = await _db.demo_accesses.count_documents({"timestamp": {"$gte": now - timedelta(days=7)}})
    last_30d = await _db.demo_accesses.count_documents({"timestamp": {"$gte": now - timedelta(days=30)}})

    # Ultimos 20 acessos
    ultimos = await _db.demo_accesses.find({}, {"_id": 0}).sort("timestamp", -1).limit(20).to_list(20)
    for u in ultimos:
        if isinstance(u.get("timestamp"), datetime):
            u["timestamp"] = u["timestamp"].isoformat()

    # Top paginas
    pipeline = [
        {"$group": {"_id": "$path", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_pages_raw = await _db.demo_accesses.aggregate(pipeline).to_list(10)
    top_pages = [{"path": p["_id"] or "(raiz)", "count": p["count"]} for p in top_pages_raw]

    # Acessos por dia (ultimos 14 dias)
    since = now - timedelta(days=14)
    by_day_raw = await _db.demo_accesses.aggregate([
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1},
            "unique": {"$addToSet": "$anon_id"},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(30)
    by_day = [{"date": d["_id"], "count": d["count"], "unique": len(d["unique"])} for d in by_day_raw]

    # Leads capturados
    leads = await _db.demo_leads.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    for ld in leads:
        if isinstance(ld.get("timestamp"), datetime):
            ld["timestamp"] = ld["timestamp"].isoformat()
    total_leads = len(leads)

    return {
        "total": total,
        "unique_visitors": unique,
        "last_24h": last_24h,
        "last_7d": last_7d,
        "last_30d": last_30d,
        "ultimos": ultimos,
        "top_pages": top_pages,
        "by_day": by_day,
        "total_leads": total_leads,
        "leads": leads,
    }


class LeadPayload(BaseModel):
    nome: str
    whatsapp: str
    interesse: Optional[str] = None  # qual diferencial acionou o modal (ex: "self-service")


@router.post("/lead")
async def register_lead(payload: LeadPayload, request: Request):
    """Registra um lead (pessoa interessada em contrato) sem exigir auth."""
    nome = (payload.nome or "").strip()[:120]
    whatsapp = "".join(ch for ch in (payload.whatsapp or "") if ch.isdigit())[:15]
    if not nome or len(whatsapp) < 10:
        raise HTTPException(status_code=400, detail="Nome e WhatsApp validos sao obrigatorios")
    doc = {
        "nome": nome,
        "whatsapp": whatsapp,
        "interesse": (payload.interesse or "")[:40],
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:300],
        "referrer": request.headers.get("referer", "")[:300],
        "timestamp": datetime.now(timezone.utc),
    }
    await _db.demo_leads.insert_one(doc)
    return {"ok": True}
