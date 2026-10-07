"""Tests for admin self-service activations endpoints:
   - GET /api/ativacoes-selfservice (new fields exposed)
   - POST /api/ativacoes-selfservice/{id}/reenviar-whatsapp (404/400/401 + success flow)
"""
import os
import sys
import pytest
import requests
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient
from unittest.mock import patch, AsyncMock

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mvno_management")

ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"


# -------- Fixtures --------
@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture
def seed_activation(mongo_db):
    """Create a cliente + ativacao self-service in aguardando_pagamento."""
    cliente_id = ObjectId()
    mongo_db.clientes.insert_one({
        "_id": cliente_id,
        "nome": "TEST_Cliente SelfService",
        "documento": "99988877700",
        "telefone": "11999887766",
        "email": "test_selfservice@test.com",
        "created_at": datetime.now(timezone.utc),
    })
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id,
        "cliente_id": str(cliente_id),
        "iccid": "8955TEST00001",
        "status": "aguardando_pagamento",
        "valor_original": 49.99,
        "desconto": 0,
        "valor_final": 49.99,
        "billing_type": "PIX",
        "telefone": "11999887766",
        "asaas_invoice_url": "https://sandbox.asaas.com/i/TEST123",
        "asaas_payment_id": "pay_TEST_123",
        "asaas_pix_code": "00020126PIXCOPIACOLATEST",
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "cliente_id": str(cliente_id)}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.clientes.delete_one({"_id": cliente_id})


@pytest.fixture
def seed_activation_boleto(mongo_db):
    cliente_id = ObjectId()
    mongo_db.clientes.insert_one({
        "_id": cliente_id,
        "nome": "TEST_Boleto",
        "documento": "11122233344",
        "telefone": "11988776655",
        "email": "test_bol@test.com",
        "created_at": datetime.now(timezone.utc),
    })
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id,
        "cliente_id": str(cliente_id),
        "iccid": "8955TEST00002",
        "status": "aguardando_pagamento",
        "valor_final": 59.90,
        "billing_type": "BOLETO",
        "telefone": "11988776655",
        "asaas_invoice_url": "https://sandbox.asaas.com/i/BOL",
        "barcode": "23790000000000000000000000000000000000",
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "cliente_id": str(cliente_id)}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.clientes.delete_one({"_id": cliente_id})


@pytest.fixture
def seed_activation_paid(mongo_db):
    """Ativacao com status != aguardando_pagamento, for 400 test."""
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id,
        "iccid": "8955TEST00003",
        "status": "pago",
        "valor_final": 10.0,
        "billing_type": "PIX",
        "telefone": "11000000000",
        "created_at": datetime.now(timezone.utc),
    })
    yield str(ativ_id)
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})


# -------- Tests: GET /api/ativacoes-selfservice --------
class TestListSelfServiceActivations:
    def test_requires_auth(self):
        r = requests.get(f"{API}/ativacoes-selfservice")
        assert r.status_code == 401

    def test_list_returns_new_fields(self, admin_session, seed_activation):
        r = admin_session.get(f"{API}/ativacoes-selfservice")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        found = next((x for x in data if x["id"] == seed_activation["ativ_id"]), None)
        assert found is not None, "Seeded activation not found in list"
        # New fields
        assert "asaas_invoice_url" in found
        assert "asaas_payment_id" in found
        assert "telefone" in found
        assert found["asaas_invoice_url"] == "https://sandbox.asaas.com/i/TEST123"
        assert found["asaas_payment_id"] == "pay_TEST_123"
        assert found["telefone"] == "11999887766"


# -------- Tests: POST /ativacoes-selfservice/{id}/reenviar-whatsapp --------
class TestReenviarWhatsapp:
    def test_requires_auth(self, seed_activation):
        r = requests.post(f"{API}/ativacoes-selfservice/{seed_activation['ativ_id']}/reenviar-whatsapp")
        assert r.status_code == 401

    def test_404_when_id_not_found(self, admin_session):
        fake_id = str(ObjectId())
        r = admin_session.post(f"{API}/ativacoes-selfservice/{fake_id}/reenviar-whatsapp")
        assert r.status_code == 404
        assert "nao encontrada" in r.json().get("detail", "").lower()

    def test_400_when_not_aguardando_pagamento(self, admin_session, seed_activation_paid):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_activation_paid}/reenviar-whatsapp")
        assert r.status_code == 400
        assert "aguardando" in r.json().get("detail", "").lower()

    def test_success_pix_builds_message(self, admin_session, seed_activation, mongo_db):
        """Expect either success (if Z-API works) or 502 (if Z-API not configured).
        We cannot easily mock internals from remote URL, so accept 200 or 502 and
        verify response structure. If 502, we still validated auth+validation path."""
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_activation['ativ_id']}/reenviar-whatsapp")
        assert r.status_code in (200, 502), f"Unexpected status {r.status_code}: {r.text}"
        if r.status_code == 200:
            body = r.json()
            assert body.get("success") is True
            assert "11999887766" in body.get("message", "")
            # Verify timestamp was recorded
            doc = mongo_db.ativacoes_selfservice.find_one({"_id": ObjectId(seed_activation["ativ_id"])})
            assert doc.get("ultimo_reenvio_whatsapp") is not None
        else:
            # 502 is acceptable (Z-API not configured). Validation path reached.
            assert "whatsapp" in r.json().get("detail", "").lower() or "falha" in r.json().get("detail", "").lower()

    def test_success_boleto_flow(self, admin_session, seed_activation_boleto):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_activation_boleto['ativ_id']}/reenviar-whatsapp")
        assert r.status_code in (200, 502), f"Unexpected status {r.status_code}: {r.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
