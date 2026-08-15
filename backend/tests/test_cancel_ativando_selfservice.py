"""Bug: cancelar ativacao self-service travada em status='ativando'.

Verifica que:
  - Endpoint POST /api/ativacoes-selfservice/{id}/cancelar aceita status='ativando'
  - Ativacao muda para 'cancelado'
  - GET lista retorna o registro com o novo status
"""
import os
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mvno_management")

TEST_ICCID = "89551700000000000BUG"
TEST_NOME = "TEST_BUG_PROCESSANDO"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "admin@mvno.com", "password": "admin123"},
               timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture()
def seeded_ativando(mongo_db):
    # Clean any leftover TEST records
    mongo_db.ativacoes_selfservice.delete_many({"iccid": TEST_ICCID})
    inserted = mongo_db.ativacoes_selfservice.insert_one({
        "cliente_nome": TEST_NOME,
        "status": "ativando",
        "iccid": TEST_ICCID,
        "created_at": datetime.now(timezone.utc),
        "chip_id": None,
        "billing_type": "PIX",
        "valor_final": 0.0,
    })
    aid = str(inserted.inserted_id)
    yield aid
    mongo_db.ativacoes_selfservice.delete_many({"iccid": TEST_ICCID})


def test_seed_appears_in_list(admin_session, seeded_ativando):
    r = admin_session.get(f"{BASE_URL}/api/ativacoes-selfservice?status=ativando", timeout=15)
    assert r.status_code == 200
    data = r.json()
    ids = [a.get("id") for a in data]
    assert seeded_ativando in ids, f"seeded ativando not in list ids={ids[:5]}"
    row = next(a for a in data if a["id"] == seeded_ativando)
    assert row["status"] == "ativando"


def test_cancel_ativando_status_transitions(admin_session, seeded_ativando, mongo_db):
    r = admin_session.post(
        f"{BASE_URL}/api/ativacoes-selfservice/{seeded_ativando}/cancelar",
        json={}, timeout=15,
    )
    assert r.status_code == 200, f"cancel failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("success") is True

    # Verify persistence in DB
    doc = mongo_db.ativacoes_selfservice.find_one({"_id": ObjectId(seeded_ativando)})
    assert doc is not None
    assert doc["status"] == "cancelado"

    # Verify via API listing (filter cancelado)
    r2 = admin_session.get(f"{BASE_URL}/api/ativacoes-selfservice?status=cancelado", timeout=15)
    assert r2.status_code == 200
    ids = [a.get("id") for a in r2.json()]
    assert seeded_ativando in ids


def test_cancel_ativo_is_blocked(admin_session, mongo_db):
    """Regressao: ativacoes com status='ativo' NAO podem ser canceladas."""
    mongo_db.ativacoes_selfservice.delete_many({"iccid": "89551700000000000ATV"})
    ins = mongo_db.ativacoes_selfservice.insert_one({
        "cliente_nome": "TEST_ATIVO_BLOCK",
        "status": "ativo",
        "iccid": "89551700000000000ATV",
        "created_at": datetime.now(timezone.utc),
        "chip_id": None,
        "billing_type": "PIX",
        "valor_final": 0.0,
    })
    aid = str(ins.inserted_id)
    try:
        r = admin_session.post(
            f"{BASE_URL}/api/ativacoes-selfservice/{aid}/cancelar",
            json={}, timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    finally:
        mongo_db.ativacoes_selfservice.delete_one({"_id": ObjectId(aid)})
