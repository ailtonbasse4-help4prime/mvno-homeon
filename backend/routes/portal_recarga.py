"""
Recarga/Renovacao PIX via Portal do Cliente.

Fluxo:
 1) GET /portal/ofertas-disponiveis?linha_id=xxx  -> lista ofertas ativas + oferta atual da linha
 2) POST /portal/recarga/iniciar {linha_id, oferta_id} -> cria cobranca PIX Asaas (reaproveita pendente se mesma oferta) e retorna QR/pix_copy_paste
 3) GET /portal/recarga/{cobranca_id}/status -> polling p/ o front

Ao pagamento confirmado (via webhook Asaas ja existente), o server chama
`aplicar_recarga_pos_pagamento()` daqui, que executa `operadora_service.alterar_plano`
na Ta Telecom e atualiza data_expiracao_ta = hoje + 30d.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
import logging
import jwt as _jwt
import os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portal", tags=["portal-recarga"])

# Injecoes
_db = None
_asaas_service = None
_operadora_service = None
_create_log = None
_secret_key = None


def init(db, asaas_service, operadora_service, create_log, secret_key: str):
    global _db, _asaas_service, _operadora_service, _create_log, _secret_key
    _db = db
    _asaas_service = asaas_service
    _operadora_service = operadora_service
    _create_log = create_log
    _secret_key = secret_key


async def _get_portal_cliente(request: Request) -> dict:
    """Valida o token do portal e retorna o cliente doc."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Nao autenticado")
    token = auth[7:]
    try:
        payload = _jwt.decode(token, _secret_key, algorithms=["HS256"])
        if payload.get("type") != "portal":
            raise HTTPException(status_code=401, detail="Token invalido")
        cliente_id = payload.get("sub") or payload.get("cliente_id")
        cliente = await _db.clientes.find_one({"_id": ObjectId(cliente_id)})
        if not cliente:
            raise HTTPException(status_code=401, detail="Cliente nao encontrado")
        return cliente
    except _jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token invalido ou expirado")


async def _get_linha_do_cliente(linha_id: str, cliente_id: str) -> dict:
    """Valida que a linha pertence ao cliente."""
    try:
        linha = await _db.linhas.find_one({"_id": ObjectId(linha_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="linha_id invalido")
    if not linha or str(linha.get("cliente_id")) != str(cliente_id):
        raise HTTPException(status_code=404, detail="Linha nao encontrada")
    return linha


# ==================== ENDPOINTS ====================

@router.get("/ofertas-disponiveis")
async def ofertas_disponiveis(request: Request, linha_id: str):
    """Lista ofertas ativas (categoria movel) + destaca a oferta atual da linha."""
    cliente = await _get_portal_cliente(request)
    linha = await _get_linha_do_cliente(linha_id, str(cliente["_id"]))

    ofertas = await _db.ofertas.find({"ativo": True, "categoria": "movel"}).sort("valor", 1).to_list(200)

    plano_ids = list({o.get("plano_id") for o in ofertas if o.get("plano_id")})
    plano_docs = []
    if plano_ids:
        valid = [ObjectId(p) for p in plano_ids if ObjectId.is_valid(p)]
        if valid:
            plano_docs = await _db.planos.find({"_id": {"$in": valid}}).to_list(len(valid))
    planos_map = {str(p["_id"]): p for p in plano_docs}

    oferta_atual_id = linha.get("oferta_id")
    plano_atual_id = linha.get("plano_id")

    items = []
    for o in ofertas:
        pl = planos_map.get(str(o.get("plano_id", "")))
        items.append({
            "id": str(o["_id"]),
            "nome": o.get("nome"),
            "descricao": o.get("descricao"),
            "valor": o.get("valor"),
            "plano_id": str(o.get("plano_id")) if o.get("plano_id") else None,
            "plano_nome": pl.get("nome") if pl else None,
            "franquia": pl.get("franquia") if pl else None,
            "plan_code": pl.get("plan_code") if pl else None,
            "atual": str(o["_id"]) == str(oferta_atual_id),
        })

    return {
        "linha": {
            "id": str(linha["_id"]),
            "numero": linha.get("msisdn") or linha.get("numero"),
            "status": linha.get("status"),
            "oferta_atual_id": str(oferta_atual_id) if oferta_atual_id else None,
            "plano_atual_id": str(plano_atual_id) if plano_atual_id else None,
        },
        "ofertas": items,
    }


class RecargaIniciarRequest(BaseModel):
    linha_id: str
    oferta_id: str


@router.post("/recarga/iniciar")
async def recarga_iniciar(data: RecargaIniciarRequest, request: Request):
    """
    Cria cobranca PIX Asaas para recarga. Se ja existe uma cobranca PIX PENDING
    do MESMO linha+oferta nas ultimas 24h, reaproveita.
    """
    cliente = await _get_portal_cliente(request)
    cliente_id = str(cliente["_id"])
    linha = await _get_linha_do_cliente(data.linha_id, cliente_id)

    try:
        oferta = await _db.ofertas.find_one({"_id": ObjectId(data.oferta_id), "ativo": True})
    except Exception:
        raise HTTPException(status_code=400, detail="oferta_id invalido")
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta nao encontrada ou inativa")

    plano = None
    if oferta.get("plano_id") and ObjectId.is_valid(oferta["plano_id"]):
        plano = await _db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
    if not plano or not plano.get("plan_code"):
        raise HTTPException(status_code=400, detail="Plano nao possui plan_code Ta Telecom")

    external_ref = f"recarga:{data.linha_id}:{data.oferta_id}"

    # Reaproveita PENDING recente
    limite_dt = datetime.now(timezone.utc) - timedelta(hours=24)
    existente = await _db.cobrancas.find_one({
        "cliente_id": cliente_id,
        "external_reference": external_ref,
        "status": {"$in": ["PENDING", "AWAITING_PAYMENT"]},
        "$or": [
            {"created_at": {"$gte": limite_dt}},
            {"created_at": {"$gte": limite_dt.isoformat()}},
        ],
    }, sort=[("created_at", -1)])

    if existente and existente.get("asaas_payment_id"):
        # Confere status real no Asaas
        try:
            pay = await _asaas_service.get_payment(existente["asaas_payment_id"])
            if pay.get("status") in ("PENDING", "AWAITING_PAYMENT"):
                pix = await _asaas_service.get_pix_qrcode(existente["asaas_payment_id"])
                return {
                    "cobranca_id": str(existente["_id"]),
                    "asaas_payment_id": existente["asaas_payment_id"],
                    "valor": existente.get("valor"),
                    "status": pay.get("status"),
                    "pix_qr_image": pix.get("encodedImage"),
                    "pix_copy_paste": pix.get("payload"),
                    "invoice_url": pay.get("invoiceUrl"),
                    "reaproveitada": True,
                }
        except Exception as e:
            logger.warning(f"Falha ao reaproveitar cobranca {existente.get('_id')}: {e}")

    # Cria nova cobranca no Asaas
    if not _asaas_service or not getattr(_asaas_service, "is_configured", False):
        raise HTTPException(status_code=503, detail="Asaas nao configurado")

    asaas_customer_id = cliente.get("asaas_customer_id")
    if not asaas_customer_id:
        # Cria customer no Asaas on-the-fly
        try:
            customer = await _asaas_service.get_or_create_customer(
                name=cliente.get("nome") or "Cliente",
                cpf_cnpj=cliente.get("documento") or "",
                email=cliente.get("email"),
                phone=cliente.get("telefone"),
            )
            asaas_customer_id = customer.get("id")
            await _db.clientes.update_one(
                {"_id": cliente["_id"]},
                {"$set": {"asaas_customer_id": asaas_customer_id}},
            )
        except Exception as e:
            logger.error(f"Falha ao criar customer Asaas: {e}")
            raise HTTPException(status_code=500, detail="Falha ao registrar cliente no Asaas")

    hoje = datetime.now(timezone.utc).date()
    due_date = (hoje + timedelta(days=1)).isoformat()  # vence amanha (PIX pode ser pago agora)
    numero = linha.get("msisdn") or linha.get("numero") or ""
    descricao = f"Recarga {plano.get('nome') or oferta.get('nome')} - Linha {numero}"

    try:
        payment = await _asaas_service.create_payment(
            customer_id=asaas_customer_id,
            billing_type="PIX",
            value=float(oferta.get("valor") or 0),
            due_date=due_date,
            description=descricao,
            external_reference=external_ref,
        )
    except Exception as e:
        logger.error(f"Falha ao criar cobranca Asaas: {e}")
        raise HTTPException(status_code=500, detail=f"Falha ao gerar PIX: {e}")

    payment_id = payment.get("id")
    invoice_url = payment.get("invoiceUrl")

    # Busca dados do PIX
    pix_image = None
    pix_payload = None
    try:
        pix = await _asaas_service.get_pix_qrcode(payment_id)
        pix_image = pix.get("encodedImage")
        pix_payload = pix.get("payload")
    except Exception as e:
        logger.warning(f"Falha ao buscar QR PIX {payment_id}: {e}")

    now = datetime.now(timezone.utc)
    doc = {
        "cliente_id": cliente_id,
        "linha_id": data.linha_id,
        "oferta_id": data.oferta_id,
        "plano_id": str(plano["_id"]),
        "valor": float(oferta.get("valor") or 0),
        "billing_type": "PIX",
        "status": payment.get("status", "PENDING"),
        "vencimento": due_date,
        "descricao": descricao,
        "asaas_payment_id": payment_id,
        "asaas_invoice_url": invoice_url,
        "asaas_pix_code": pix_payload,
        "asaas_pix_image_base64": pix_image,
        "external_reference": external_ref,
        "tipo": "recarga_portal",
        "created_at": now,
    }
    r = await _db.cobrancas.insert_one(doc)

    if _create_log:
        try:
            await _create_log(
                "portal_recarga",
                f"Recarga iniciada linha={numero} oferta={oferta.get('nome')} valor={oferta.get('valor')}",
                None, f"Cliente:{cliente.get('nome')}",
            )
        except Exception:
            pass

    return {
        "cobranca_id": str(r.inserted_id),
        "asaas_payment_id": payment_id,
        "valor": doc["valor"],
        "status": doc["status"],
        "pix_qr_image": pix_image,
        "pix_copy_paste": pix_payload,
        "invoice_url": invoice_url,
        "reaproveitada": False,
    }


@router.get("/recarga/{cobranca_id}/status")
async def recarga_status(cobranca_id: str, request: Request):
    """Polling do status pelo front. Sincroniza com Asaas em tempo real."""
    cliente = await _get_portal_cliente(request)
    try:
        cob = await _db.cobrancas.find_one({"_id": ObjectId(cobranca_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="cobranca_id invalido")
    if not cob or str(cob.get("cliente_id")) != str(cliente["_id"]):
        raise HTTPException(status_code=404, detail="Cobranca nao encontrada")

    status = cob.get("status", "PENDING")
    # Se ainda pendente, checa Asaas
    if cob.get("asaas_payment_id") and status not in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
        try:
            pay = await _asaas_service.get_payment(cob["asaas_payment_id"])
            new_status = pay.get("status")
            if new_status and new_status != status:
                upd = {"status": new_status}
                if new_status in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"):
                    upd["paid_at"] = pay.get("confirmedDate") or datetime.now(timezone.utc).isoformat()
                await _db.cobrancas.update_one({"_id": cob["_id"]}, {"$set": upd})
                status = new_status
        except Exception as e:
            logger.warning(f"Portal recarga status: erro sync Asaas: {e}")

    aplicada = bool(cob.get("recarga_aplicada"))
    return {
        "cobranca_id": cobranca_id,
        "status": status,
        "paga": status in ("CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"),
        "recarga_aplicada": aplicada,
        "recarga_erro": cob.get("recarga_erro"),
        "nova_expiracao_ta": cob.get("nova_expiracao_ta"),
    }


# ==================== APLICACAO POS-PAGAMENTO ====================

async def aplicar_recarga_pos_pagamento(cobranca: dict) -> dict:
    """
    Chamado pelo webhook Asaas quando um payment CONFIRMED/RECEIVED tem
    external_reference "recarga:<linha_id>:<oferta_id>".
    Executa alterar_plano na Ta Telecom e atualiza data_expiracao_ta.
    """
    external_ref = cobranca.get("external_reference") or ""
    if not external_ref.startswith("recarga:"):
        return {"skipped": True, "motivo": "nao_e_recarga_portal"}

    if cobranca.get("recarga_aplicada"):
        return {"skipped": True, "motivo": "ja_aplicada"}

    try:
        _, linha_id, oferta_id = external_ref.split(":", 2)
    except Exception:
        return {"skipped": True, "motivo": "external_reference_malformado"}

    try:
        linha = await _db.linhas.find_one({"_id": ObjectId(linha_id)})
    except Exception:
        return {"error": "linha_id_invalido"}
    if not linha:
        return {"error": "linha_nao_encontrada"}

    try:
        oferta = await _db.ofertas.find_one({"_id": ObjectId(oferta_id)})
    except Exception:
        return {"error": "oferta_id_invalida"}
    if not oferta:
        return {"error": "oferta_nao_encontrada"}

    plano = None
    if oferta.get("plano_id") and ObjectId.is_valid(oferta["plano_id"]):
        plano = await _db.planos.find_one({"_id": ObjectId(oferta["plano_id"])})
    plan_code = plano.get("plan_code") if plano else None
    if not plan_code:
        await _db.cobrancas.update_one(
            {"_id": cobranca["_id"]},
            {"$set": {"recarga_erro": "plano_sem_plan_code"}},
        )
        return {"error": "plano_sem_plan_code"}

    chip = None
    if linha.get("chip_id"):
        try:
            chip = await _db.chips.find_one({"_id": ObjectId(linha["chip_id"])})
        except Exception:
            chip = None
    iccid = chip.get("iccid") if chip else None
    if not iccid:
        await _db.cobrancas.update_one(
            {"_id": cobranca["_id"]},
            {"$set": {"recarga_erro": "linha_sem_iccid"}},
        )
        return {"error": "linha_sem_iccid"}

    # Aplica plano na Ta Telecom (recarga)
    try:
        resp = await _operadora_service.alterar_plano(
            iccid=iccid, plan_code=plan_code, db=_db,
            user_id="sistema", user_name="Recarga Portal",
        )
        if not getattr(resp, "success", False):
            msg = getattr(resp, "message", "falha_ta_telecom")
            await _db.cobrancas.update_one(
                {"_id": cobranca["_id"]},
                {"$set": {"recarga_erro": msg[:200]}},
            )
            return {"error": "ta_telecom_falhou", "message": msg}
    except Exception as e:
        await _db.cobrancas.update_one(
            {"_id": cobranca["_id"]},
            {"$set": {"recarga_erro": str(e)[:200]}},
        )
        return {"error": "excecao_ta", "message": str(e)}

    # Se estava bloqueada, tenta desbloquear
    if linha.get("status") == "bloqueado":
        try:
            desb = await _operadora_service.desbloquear(
                iccid=iccid, db=_db, user_id="sistema", user_name="Recarga Portal",
            )
            if getattr(desb, "success", False):
                await _db.chips.update_one({"_id": chip["_id"]}, {"$set": {"status": "ativado"}})
        except Exception as e:
            logger.warning(f"Recarga: falha ao desbloquear ICCID {iccid}: {e}")

    nova_expiracao = (datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat()

    await _db.linhas.update_one(
        {"_id": linha["_id"]},
        {"$set": {
            "status": "ativo",
            "plano_id": str(plano["_id"]),
            "oferta_id": str(oferta["_id"]),
            "data_expiracao_ta": nova_expiracao,
            "expirar_dados": nova_expiracao,
            "proxima_recarga": nova_expiracao,
            "ultima_recarga_em": datetime.now(timezone.utc),
            "bloqueio_automatico.ativo": False,
        }},
    )

    await _db.cobrancas.update_one(
        {"_id": cobranca["_id"]},
        {"$set": {
            "recarga_aplicada": True,
            "recarga_aplicada_em": datetime.now(timezone.utc),
            "nova_expiracao_ta": nova_expiracao,
            "recarga_erro": None,
        }},
    )

    if _create_log:
        try:
            await _create_log(
                "portal_recarga",
                f"Recarga aplicada: linha={iccid} plano={plano.get('nome')} nova_expiracao={nova_expiracao}",
                None, "Recarga Portal",
            )
        except Exception:
            pass

    return {
        "success": True,
        "linha_id": str(linha["_id"]),
        "iccid": iccid,
        "plan_code": plan_code,
        "nova_expiracao_ta": nova_expiracao,
    }
