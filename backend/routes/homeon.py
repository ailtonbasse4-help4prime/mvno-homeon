"""Rastreamento de cliques nos planos do portfolio publico /homeon.

Grava cada clique em "Assinar pela Shopee" na colecao `homeon_clicks` para o
admin analisar qual plano converte mais.
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import hashlib

router = APIRouter(prefix="/homeon", tags=["homeon"])

_db = None
_require_admin = None

PLANOS_VALIDOS = {"start", "plus", "smart", "power", "ultra", "max", "hero"}


def init(db, require_admin):
    global _db, _require_admin
    _db = db
    _require_admin = require_admin


class ClickPayload(BaseModel):
    plano: str  # id do plano: start/plus/smart/power/ultra/max (ou "hero" pro card destaque)
    source: Optional[str] = None  # "card", "hero", "nav"


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _anon_id(request: Request) -> str:
    ip = _client_ip(request)
    ua = request.headers.get("user-agent", "")
    return hashlib.sha256(f"{ip}|{ua}".encode()).hexdigest()[:16]


@router.post("/click")
async def register_click(payload: ClickPayload, request: Request):
    """Registra um clique em 'Assinar pela Shopee' (publico, sem auth)."""
    plano = (payload.plano or "").lower().strip()
    if plano not in PLANOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Plano invalido")
    doc = {
        "plano": plano,
        "source": (payload.source or "card")[:20],
        "anon_id": _anon_id(request),
        "ip": _client_ip(request),
        "user_agent": request.headers.get("user-agent", "")[:300],
        "referrer": request.headers.get("referer", "")[:300],
        "timestamp": datetime.now(timezone.utc),
    }
    await _db.homeon_clicks.insert_one(doc)
    return {"ok": True}


async def get_stats_data():
    """Estatisticas de cliques (usado pelo wrapper admin em server.py)."""
    total = await _db.homeon_clicks.count_documents({})
    unique_ids = await _db.homeon_clicks.distinct("anon_id")
    unique = len(unique_ids)

    now = datetime.now(timezone.utc)
    last_24h = await _db.homeon_clicks.count_documents({"timestamp": {"$gte": now - timedelta(hours=24)}})
    last_7d = await _db.homeon_clicks.count_documents({"timestamp": {"$gte": now - timedelta(days=7)}})
    last_30d = await _db.homeon_clicks.count_documents({"timestamp": {"$gte": now - timedelta(days=30)}})

    # Cliques agrupados por plano
    pipeline = [
        {"$group": {
            "_id": "$plano",
            "count": {"$sum": 1},
            "unique": {"$addToSet": "$anon_id"},
        }},
        {"$sort": {"count": -1}},
    ]
    por_plano_raw = await _db.homeon_clicks.aggregate(pipeline).to_list(20)
    por_plano = [{"plano": p["_id"], "count": p["count"], "unique": len(p["unique"])} for p in por_plano_raw]

    # Ultimos 30 cliques
    ultimos = await _db.homeon_clicks.find({}, {"_id": 0}).sort("timestamp", -1).limit(30).to_list(30)
    for u in ultimos:
        if isinstance(u.get("timestamp"), datetime):
            u["timestamp"] = u["timestamp"].isoformat()

    # Cliques por dia (ultimos 14 dias)
    since = now - timedelta(days=14)
    by_day_raw = await _db.homeon_clicks.aggregate([
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]).to_list(30)
    by_day = [{"date": d["_id"], "count": d["count"]} for d in by_day_raw]

    return {
        "total": total,
        "unique_visitors": unique,
        "last_24h": last_24h,
        "last_7d": last_7d,
        "last_30d": last_30d,
        "por_plano": por_plano,
        "ultimos": ultimos,
        "by_day": by_day,
    }
