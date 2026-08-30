"""
Modulo QR Lotes - geracao e gestao de lotes de etiquetas QR para chips.

Enderecos:
  - GET  /api/public/chip/{iccid}/status         : Landing publica (status do chip)
  - GET  /api/qr-lotes                           : Lista lotes (admin)
  - POST /api/qr-lotes/preview                   : Preview de quantos chips o filtro seleciona
  - POST /api/qr-lotes                           : Cria novo lote
  - GET  /api/qr-lotes/{id}                      : Detalhes de um lote
  - GET  /api/qr-lotes/{id}/pdf                  : Baixa PDF do lote (formato via query)
  - POST /api/qr-lotes/{id}/marcar-impresso      : Marca lote como impresso
  - POST /api/qr-lotes/{id}/reimprimir/{iccid}   : Reimprime uma unica etiqueta
  - GET  /api/qr-lotes/calibracao/pdf            : PDF de calibracao
"""
import os
import logging
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.qr_label_service import build_qr_pdf, build_calibration_pdf, LAYOUTS

logger = logging.getLogger(__name__)
router = APIRouter(tags=["qr-lotes"])

_ctx = {}


def init(db, get_current_user, require_admin, create_log, site_url: Optional[str] = None):
    _ctx["db"] = db
    _ctx["get_current_user"] = get_current_user
    _ctx["require_admin"] = require_admin
    _ctx["create_log"] = create_log
    _ctx["site_url"] = site_url or os.environ.get("SITE_URL") or ""


# ---------- Helpers ----------
async def _next_lote_numero() -> str:
    """Gera o proximo numero de lote sequencial (L001, L002...). Nunca reinicia."""
    db = _ctx["db"]
    doc = await db.counters.find_one_and_update(
        {"_id": "qr_lote_seq"},
        {"$inc": {"value": 1}},
        upsert=True,
        return_document=True,
    )
    if not doc:
        doc = await db.counters.find_one({"_id": "qr_lote_seq"})
    n = doc.get("value", 1) if doc else 1
    return f"L{n:03d}"


def _lote_to_public(lote: dict) -> dict:
    """Serializa um lote para JSON (converte ObjectId em string)."""
    if not lote:
        return None
    out = dict(lote)
    out["_id"] = str(out["_id"])
    return out


async def _build_chip_query(filtros: dict) -> dict:
    """Constroi query MongoDB (sobre db.chips) a partir dos filtros de criacao de lote."""
    query = {}
    if filtros.get("revendedor_id"):
        # revendedor_id em db.chips e string (não ObjectId)
        query["revendedor_id"] = filtros["revendedor_id"]
    if filtros.get("status"):
        query["status"] = filtros["status"]
    if filtros.get("apenas_sem_lote"):
        query["qr_lote_id"] = {"$in": [None, False]}
    if filtros.get("iccids"):
        query["iccid"] = {"$in": filtros["iccids"]}
    return query


# ---------- LANDING PUBLICA ----------
@router.get("/public/chip/{iccid}/status")
async def public_chip_status(iccid: str):
    """
    Endpoint publico consumido pela landing /chip/{iccid}.
    Retorna o minimo de info sobre o chip para orientar o cliente.
    """
    db = _ctx["db"]
    iccid = iccid.strip()
    if not iccid or not iccid.isdigit() or len(iccid) < 15 or len(iccid) > 22:
        raise HTTPException(status_code=400, detail="ICCID invalido")

    chip = await db.chips.find_one({"iccid": iccid})
    linha = await db.linhas.find_one({"iccid": iccid})

    if not chip and not linha:
        raise HTTPException(status_code=404, detail="Chip nao encontrado")

    # Determina o estado: linhas (pos-ativacao) tem prioridade; senao usa chips
    status = None
    msisdn = None
    if linha:
        status = linha.get("status")
        msisdn = linha.get("msisdn") or linha.get("numero")
    if not status and chip:
        status = chip.get("status")
        msisdn = msisdn or chip.get("msisdn")

    # Normaliza pro consumidor da landing
    # chips: "disponivel", "reservado", "ativado", "bloqueado", "cancelado"
    # linhas: "ativo", "ativando", "bloqueado", "cancelado"
    if status in ("ativo", "ativado"):
        estado = "ativo"
    elif status in ("ativando", "processando", "reservado"):
        estado = "ativando"
    elif status in ("bloqueado", "suspenso"):
        estado = "bloqueado"
    elif status in ("cancelado", "removido"):
        estado = "cancelado"
    else:
        estado = "nao_ativado"

    return {
        "iccid": iccid,
        "estado": estado,
        "msisdn": msisdn if estado == "ativo" else None,
    }


# ---------- CRIACAO / LISTAGEM ----------
class LoteFiltroInput(BaseModel):
    revendedor_id: Optional[str] = None
    status: Optional[str] = None  # ex: "disponivel"
    apenas_sem_lote: bool = True
    iccids: Optional[List[str]] = None
    limite: Optional[int] = Field(default=None, ge=1, le=5000)


class CriarLoteInput(LoteFiltroInput):
    pass


@router.post("/qr-lotes/preview")
async def preview_lote(input: LoteFiltroInput):
    """Retorna quantos chips o filtro selecionaria e amostra dos primeiros."""
    _ctx["require_admin"]  # dependency wired via server.py principal
    db = _ctx["db"]
    query = await _build_chip_query(input.dict(exclude_none=True))
    total = await db.chips.count_documents(query)
    limite = input.limite or 5000
    if limite < total:
        limite_uso = limite
    else:
        limite_uso = total
    amostra = await db.chips.find(query, {"iccid": 1, "status": 1, "revendedor_id": 1}).limit(min(10, limite_uso)).to_list(10)
    for a in amostra:
        a["_id"] = str(a["_id"])
        if a.get("revendedor_id") and isinstance(a["revendedor_id"], ObjectId):
            a["revendedor_id"] = str(a["revendedor_id"])
    return {"total": total, "limite_aplicado": limite_uso, "amostra": amostra}


@router.post("/qr-lotes")
async def criar_lote(input: CriarLoteInput):
    """Cria um novo lote e vincula os chips selecionados a ele."""
    db = _ctx["db"]
    create_log = _ctx["create_log"]

    query = await _build_chip_query(input.dict(exclude_none=True))
    projection = {"iccid": 1, "revendedor_id": 1, "status": 1}
    cursor = db.chips.find(query, projection)
    if input.limite:
        cursor = cursor.limit(input.limite)
    docs = await cursor.to_list(input.limite or 5000)
    if not docs:
        raise HTTPException(status_code=400, detail="Nenhum chip corresponde ao filtro")

    chips = []
    for d in docs:
        iccid = d.get("iccid")
        if not iccid:
            continue
        chips.append({"iccid": iccid, "reimpresso_em": None, "reimpresso_por": None})

    if not chips:
        raise HTTPException(status_code=400, detail="Chips selecionados nao tem ICCID valido")

    numero = await _next_lote_numero()
    revendedor_id = input.revendedor_id

    lote_doc = {
        "numero": numero,
        "quantidade": len(chips),
        "status": "pendente",
        "chips": chips,
        "filtro_origem": input.dict(exclude_none=True),
        "revendedor_id": revendedor_id,  # armazenado como string (mesmo formato do db.chips)
        "criado_em": datetime.now(timezone.utc),
        "criado_por": None,
        "impresso_em": None,
        "impresso_por": None,
    }
    result = await db.qr_lotes.insert_one(lote_doc)
    lote_id = result.inserted_id

    # Vincula os chips ao lote (em db.chips)
    iccids = [c["iccid"] for c in chips]
    await db.chips.update_many(
        {"iccid": {"$in": iccids}},
        {"$set": {"qr_lote_id": str(lote_id), "qr_lote_numero": numero}},
    )
    await create_log("qr_lote", f"Lote {numero} criado com {len(chips)} chips", None, "admin")

    lote_doc["_id"] = lote_id
    return _lote_to_public(lote_doc)


@router.get("/qr-lotes")
async def listar_lotes(
    status: Optional[str] = Query(None),
    revendedor_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """Lista lotes com filtros basicos."""
    db = _ctx["db"]
    q = {}
    if status:
        q["status"] = status
    if revendedor_id:
        q["revendedor_id"] = revendedor_id  # string
    cursor = db.qr_lotes.find(q).sort("criado_em", -1).skip(skip).limit(limit)
    lotes = await cursor.to_list(limit)
    total = await db.qr_lotes.count_documents(q)
    return {
        "total": total,
        "lotes": [_lote_to_public(l) for l in lotes],
    }


@router.get("/qr-lotes/{lote_id}")
async def detalhes_lote(lote_id: str):
    db = _ctx["db"]
    try:
        oid = ObjectId(lote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalido")
    lote = await db.qr_lotes.find_one({"_id": oid})
    if not lote:
        raise HTTPException(status_code=404, detail="Lote nao encontrado")
    return _lote_to_public(lote)


# ---------- IMPRESSAO ----------
@router.get("/qr-lotes/calibracao/pdf")
async def pdf_calibracao(formato: str = Query("pimaco_6081", regex="^(pimaco_6081|a4_grid)$")):
    """Gera folha de calibracao com marcas para testar alinhamento da impressora."""
    pdf = build_calibration_pdf(formato=formato)
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="calibracao_{formato}.pdf"'},
    )


@router.get("/qr-lotes/{lote_id}/pdf")
async def baixar_pdf_lote(
    lote_id: str,
    formato: str = Query("pimaco_6081", regex="^(pimaco_6081|a4_grid)$"),
    marcar_impresso: bool = Query(False),
):
    """Gera e retorna o PDF do lote no formato pedido."""
    db = _ctx["db"]
    try:
        oid = ObjectId(lote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalido")
    lote = await db.qr_lotes.find_one({"_id": oid})
    if not lote:
        raise HTTPException(status_code=404, detail="Lote nao encontrado")

    chips = lote.get("chips", [])
    base_url = _ctx.get("site_url") or ""

    pdf = build_qr_pdf(
        chips=chips,
        lote_numero=lote.get("numero", ""),
        base_url=base_url,
        formato=formato,
    )

    if marcar_impresso and lote.get("status") != "impresso":
        await db.qr_lotes.update_one(
            {"_id": oid},
            {"$set": {"status": "impresso", "impresso_em": datetime.now(timezone.utc)}},
        )
        await _ctx["create_log"]("qr_lote", f"Lote {lote.get('numero')} impresso via download", None, "admin")

    filename = f"lote_{lote.get('numero', 'X')}_{formato}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/qr-lotes/{lote_id}/marcar-impresso")
async def marcar_impresso(lote_id: str):
    """Marca o lote como impresso manualmente."""
    db = _ctx["db"]
    try:
        oid = ObjectId(lote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalido")
    result = await db.qr_lotes.update_one(
        {"_id": oid},
        {"$set": {"status": "impresso", "impresso_em": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lote nao encontrado")
    await _ctx["create_log"]("qr_lote", f"Lote {lote_id} marcado como impresso", None, "admin")
    return {"success": True}


@router.post("/qr-lotes/{lote_id}/reimprimir/{iccid}")
async def reimprimir_chip_do_lote(lote_id: str, iccid: str):
    """Gera um PDF com apenas 1 etiqueta (do chip informado) e loga a reimpressao."""
    db = _ctx["db"]
    try:
        oid = ObjectId(lote_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalido")
    lote = await db.qr_lotes.find_one({"_id": oid, "chips.iccid": iccid})
    if not lote:
        raise HTTPException(status_code=404, detail="Chip nao pertence a este lote")

    now = datetime.now(timezone.utc)
    await db.qr_lotes.update_one(
        {"_id": oid, "chips.iccid": iccid},
        {
            "$set": {
                "chips.$.reimpresso_em": now,
                "status": "parcialmente_reimpresso" if lote.get("status") == "impresso" else lote.get("status"),
            }
        },
    )
    await _ctx["create_log"]("qr_lote", f"Chip {iccid} reimpresso (lote {lote.get('numero')})", None, "admin")

    pdf = build_qr_pdf(
        chips=[{"iccid": iccid}],
        lote_numero=lote.get("numero", ""),
        base_url=_ctx.get("site_url") or "",
        formato="a4_grid",  # reimpressao unica usa grid com corte manual (mais seguro)
    )
    filename = f"reimpressao_{lote.get('numero','X')}_{iccid}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
