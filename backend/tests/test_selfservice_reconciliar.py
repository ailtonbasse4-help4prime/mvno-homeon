"""Tests for admin reconciliar self-service endpoint and worker:
   - POST /api/ativacoes-selfservice/{id}/reconciliar
   - _reconciliar_selfservice_orfaos worker
"""
import os
import sys
import asyncio
import pytest
import requests
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
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


def _mk_cliente(mongo_db, suffix):
    cid = ObjectId()
    mongo_db.clientes.insert_one({
        "_id": cid,
        "nome": f"TEST_Reconc_{suffix}",
        "documento": f"999000{suffix}",
        "telefone": "11999887766",
        "email": f"recon_{suffix}@test.com",
        "created_at": datetime.now(timezone.utc),
    })
    return cid


@pytest.fixture
def seed_happy(mongo_db):
    """Cliente + chip 'ativado' + ativacao 'aguardando_pagamento' matching iccid."""
    cid = _mk_cliente(mongo_db, "happy")
    iccid = "8955RECON00001"
    chip_id = ObjectId()
    mongo_db.chips.insert_one({
        "_id": chip_id,
        "iccid": iccid,
        "msisdn": "5511955667788",
        "status": "ativado",
        "cliente_id": str(cid),
        "created_at": datetime.now(timezone.utc),
    })
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id,
        "cliente_id": str(cid),
        "iccid": iccid,
        "status": "aguardando_pagamento",
        "valor_final": 49.99,
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "cliente_id": str(cid), "chip_id": str(chip_id), "iccid": iccid}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.chips.delete_one({"_id": chip_id})
    mongo_db.clientes.delete_one({"_id": cid})


@pytest.fixture
def seed_chip_reservado(mongo_db):
    cid = _mk_cliente(mongo_db, "res")
    iccid = "8955RECON00002"
    chip_id = ObjectId()
    mongo_db.chips.insert_one({
        "_id": chip_id, "iccid": iccid, "status": "reservado",
        "cliente_id": str(cid), "created_at": datetime.now(timezone.utc),
    })
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id, "cliente_id": str(cid), "iccid": iccid,
        "status": "aguardando_pagamento", "valor_final": 49.99,
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "chip_id": str(chip_id), "cliente_id": str(cid)}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.chips.delete_one({"_id": chip_id})
    mongo_db.clientes.delete_one({"_id": cid})


@pytest.fixture
def seed_no_iccid(mongo_db):
    cid = _mk_cliente(mongo_db, "noic")
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id, "cliente_id": str(cid), "iccid": None,
        "status": "aguardando_pagamento", "valor_final": 49.99,
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "cliente_id": str(cid)}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.clientes.delete_one({"_id": cid})


@pytest.fixture
def seed_ativo(mongo_db):
    cid = _mk_cliente(mongo_db, "ativo")
    ativ_id = ObjectId()
    mongo_db.ativacoes_selfservice.insert_one({
        "_id": ativ_id, "cliente_id": str(cid), "iccid": "8955RECON00003",
        "status": "ativo", "valor_final": 49.99,
        "created_at": datetime.now(timezone.utc),
    })
    yield {"ativ_id": str(ativ_id), "cliente_id": str(cid)}
    mongo_db.ativacoes_selfservice.delete_one({"_id": ativ_id})
    mongo_db.clientes.delete_one({"_id": cid})


# -------- Endpoint tests --------
class TestReconciliarEndpoint:
    def test_requires_auth(self, seed_happy):
        r = requests.post(f"{API}/ativacoes-selfservice/{seed_happy['ativ_id']}/reconciliar")
        assert r.status_code == 401, f"Expected 401 got {r.status_code}: {r.text}"

    def test_404_inexistent(self, admin_session):
        fake_id = str(ObjectId())
        r = admin_session.post(f"{API}/ativacoes-selfservice/{fake_id}/reconciliar")
        assert r.status_code == 404, f"Expected 404 got {r.status_code}: {r.text}"

    def test_returns_success_false_when_already_ativo(self, admin_session, seed_ativo):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_ativo['ativ_id']}/reconciliar")
        assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is False
        assert "ativo" in body.get("message", "").lower()

    def test_400_no_iccid(self, admin_session, seed_no_iccid):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_no_iccid['ativ_id']}/reconciliar")
        assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
        assert "ICCID" in r.text or "iccid" in r.text.lower()

    def test_400_chip_not_ativado(self, admin_session, seed_chip_reservado):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_chip_reservado['ativ_id']}/reconciliar")
        assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text}"
        assert "ativado" in r.text.lower()

    def test_happy_path(self, admin_session, seed_happy, mongo_db):
        r = admin_session.post(f"{API}/ativacoes-selfservice/{seed_happy['ativ_id']}/reconciliar")
        assert r.status_code == 200, f"Expected 200 got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert "5511955667788" in body.get("message", "")

        # Verify DB persistence
        doc = mongo_db.ativacoes_selfservice.find_one({"_id": ObjectId(seed_happy["ativ_id"])})
        assert doc["status"] == "ativo"
        assert doc["msisdn"] == "5511955667788"
        assert doc.get("ativado_em") is not None
        assert doc.get("reconciliado_em") is not None
        assert doc.get("nota_reconciliacao")


# -------- Worker test --------
class TestWorkerReconciliar:
    def test_worker_reconciles_orfaos(self, mongo_db):
        """Call _reconciliar_selfservice_orfaos() directly and verify behaviour."""
        # Seed: 1 orfao (chip ativado + ativacao aguardando), 1 nao-orfao (chip reservado)
        cid1 = _mk_cliente(mongo_db, "wk1")
        cid2 = _mk_cliente(mongo_db, "wk2")
        iccid1, iccid2 = "8955WORKER0001", "8955WORKER0002"
        chip1_id, chip2_id = ObjectId(), ObjectId()
        ativ1_id, ativ2_id = ObjectId(), ObjectId()
        try:
            mongo_db.chips.insert_one({
                "_id": chip1_id, "iccid": iccid1, "msisdn": "5511900000001",
                "status": "ativado", "cliente_id": str(cid1),
            })
            mongo_db.chips.insert_one({
                "_id": chip2_id, "iccid": iccid2, "status": "reservado",
                "cliente_id": str(cid2),
            })
            mongo_db.ativacoes_selfservice.insert_one({
                "_id": ativ1_id, "cliente_id": str(cid1), "iccid": iccid1,
                "status": "aguardando_pagamento", "valor_final": 49.99,
            })
            mongo_db.ativacoes_selfservice.insert_one({
                "_id": ativ2_id, "cliente_id": str(cid2), "iccid": iccid2,
                "status": "aguardando_pagamento", "valor_final": 49.99,
            })

            # Import worker and run
            sys.path.insert(0, "/app/backend")
            from server import _reconciliar_selfservice_orfaos
            asyncio.get_event_loop().run_until_complete(_reconciliar_selfservice_orfaos()) \
                if False else asyncio.run(_reconciliar_selfservice_orfaos())

            doc1 = mongo_db.ativacoes_selfservice.find_one({"_id": ativ1_id})
            doc2 = mongo_db.ativacoes_selfservice.find_one({"_id": ativ2_id})
            assert doc1["status"] == "ativo", f"Orfao nao reconciliado: {doc1['status']}"
            assert doc1["msisdn"] == "5511900000001"
            assert doc1.get("reconciliado_por") == "worker_automatico"
            assert doc2["status"] == "aguardando_pagamento", f"Nao-orfao foi afetado: {doc2['status']}"
        finally:
            mongo_db.ativacoes_selfservice.delete_many({"_id": {"$in": [ativ1_id, ativ2_id]}})
            mongo_db.chips.delete_many({"_id": {"$in": [chip1_id, chip2_id]}})
            mongo_db.clientes.delete_many({"_id": {"$in": [cid1, cid2]}})
