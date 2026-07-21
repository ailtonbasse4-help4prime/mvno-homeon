"""
Tests for MSISDN historico feature - portability bug fix.
- Portal login with historic MSISDN
- Admin POST/DELETE /api/linhas/{linha_id}/msisdn-historico
- RBAC 403 for non-admin
- Idempotency ($addToSet)
"""
import os
import re
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'mvno_management')

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]

CPF_TEST = "12345678909"  # test document
MSISDN_ATUAL = "11999990001"  # current line number
MSISDN_HIST_1 = "11888880001"  # old (pre-port) number stored in historico
MSISDN_HIST_2 = "11777770002"


@pytest.fixture(scope="module")
def seeded_data():
    """Insert cliente + chip + linha with msisdn_historico directly in DB."""
    # cleanup previous
    db.clientes.delete_many({"documento": CPF_TEST})
    db.linhas.delete_many({"msisdn": MSISDN_ATUAL})
    db.chips.delete_many({"iccid": {"$in": ["TEST_ICCID_HIST_1"]}})

    cliente_id = db.clientes.insert_one({
        "nome": "TEST Cliente Historico",
        "documento": CPF_TEST,
        "email": "test_historico@example.com",
        "telefone": MSISDN_ATUAL,
    }).inserted_id
    cliente_id_str = str(cliente_id)

    chip_id = db.chips.insert_one({
        "iccid": "TEST_ICCID_HIST_1",
        "msisdn": MSISDN_ATUAL,
        "msisdn_historico": [MSISDN_HIST_1],
        "cliente_id": cliente_id_str,
        "status": "ativo",
    }).inserted_id

    linha_id = db.linhas.insert_one({
        "msisdn": MSISDN_ATUAL,
        "numero": MSISDN_ATUAL,
        "msisdn_historico": [MSISDN_HIST_1],
        "cliente_id": cliente_id_str,
        "chip_id": str(chip_id),
        "status": "ativo",
    }).inserted_id

    yield {
        "cliente_id": cliente_id_str,
        "chip_id": str(chip_id),
        "linha_id": str(linha_id),
    }

    # teardown
    db.linhas.delete_one({"_id": linha_id})
    db.chips.delete_one({"_id": chip_id})
    db.clientes.delete_one({"_id": cliente_id})


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@mvno.com", "password": "admin123"
    })
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def revendedor_session():
    """Register a revendedor test user and return an authenticated session."""
    s = requests.Session()
    email = f"test_rev_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "revpass123",
        "name": "TEST Atendente", "role": "atendente"
    })
    assert r.status_code == 200, f"Revendedor register failed: {r.text}"
    yield s
    # cleanup
    db.usuarios.delete_one({"email": email})


# ==================== PORTAL LOGIN TESTS ====================

class TestPortalLoginRegression:
    def test_login_with_current_msisdn_still_works(self, seeded_data):
        """REGRESSION: login with current msisdn works normally."""
        r = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": CPF_TEST, "telefone": MSISDN_ATUAL,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]
        assert data["cliente"]["documento"] == CPF_TEST


class TestPortalLoginHistorico:
    def test_login_with_historic_msisdn_from_linha(self, seeded_data):
        """FIX: login accepts a msisdn saved in linha.msisdn_historico."""
        r = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": CPF_TEST, "telefone": MSISDN_HIST_1,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["token"]

    def test_login_with_historic_msisdn_from_chip_only(self, seeded_data):
        """FIX: login accepts msisdn saved only in chip.msisdn_historico."""
        # Add a number ONLY in chip historico (not on linha)
        db.chips.update_one(
            {"_id": ObjectId(seeded_data["chip_id"])},
            {"$addToSet": {"msisdn_historico": MSISDN_HIST_2}}
        )
        # ensure not present on linha
        db.linhas.update_one(
            {"_id": ObjectId(seeded_data["linha_id"])},
            {"$pull": {"msisdn_historico": MSISDN_HIST_2}}
        )
        r = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": CPF_TEST, "telefone": MSISDN_HIST_2,
        })
        assert r.status_code == 200, r.text
        assert "token" in r.json()

    def test_login_with_unknown_number_returns_401(self, seeded_data):
        r = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": CPF_TEST, "telefone": "11000000000",
        })
        assert r.status_code == 401


# ==================== ADMIN ENDPOINT TESTS ====================

class TestAdicionarMsisdnHistorico:
    def test_add_numero_success(self, admin_session, seeded_data):
        novo = "11666660003"
        # cleanup first
        db.linhas.update_one(
            {"_id": ObjectId(seeded_data["linha_id"])},
            {"$pull": {"msisdn_historico": novo}}
        )
        r = admin_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": novo}
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["linha_id"] == seeded_data["linha_id"]
        assert novo in data["msisdn_historico"]

        # verify chip was also updated
        chip = db.chips.find_one({"_id": ObjectId(seeded_data["chip_id"])})
        assert novo in (chip.get("msisdn_historico") or [])

    def test_add_numero_idempotency(self, admin_session, seeded_data):
        """IDEMPOTENCY: adding same number twice does not duplicate."""
        numero = "11555550004"
        # First add
        r1 = admin_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": numero}
        )
        assert r1.status_code == 200
        # Second add
        r2 = admin_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": numero}
        )
        assert r2.status_code == 200
        historico = r2.json()["msisdn_historico"]
        assert historico.count(numero) == 1

    def test_add_numero_invalid_short(self, admin_session, seeded_data):
        r = admin_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": "1234"}
        )
        assert r.status_code == 400

    def test_add_numero_invalid_linha_id(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/linhas/invalidid/msisdn-historico",
            json={"numero": "11999998888"}
        )
        assert r.status_code in (400, 404), r.text

    def test_add_numero_nonexistent_linha(self, admin_session):
        fake_id = str(ObjectId())
        r = admin_session.post(
            f"{BASE_URL}/api/linhas/{fake_id}/msisdn-historico",
            json={"numero": "11999998888"}
        )
        assert r.status_code == 404


class TestRemoverMsisdnHistorico:
    def test_remove_numero_success(self, admin_session, seeded_data):
        numero = "11444440005"
        # Ensure it exists first
        admin_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": numero}
        )
        r = admin_session.delete(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico/{numero}"
        )
        assert r.status_code == 200, r.text
        # verify removed in DB
        linha = db.linhas.find_one({"_id": ObjectId(seeded_data["linha_id"])})
        assert numero not in (linha.get("msisdn_historico") or [])
        chip = db.chips.find_one({"_id": ObjectId(seeded_data["chip_id"])})
        assert numero not in (chip.get("msisdn_historico") or [])


class TestRBACHistoricoEndpoints:
    def test_add_forbidden_for_revendedor(self, revendedor_session, seeded_data):
        r = revendedor_session.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": "11999998888"}
        )
        assert r.status_code == 403, r.text

    def test_delete_forbidden_for_revendedor(self, revendedor_session, seeded_data):
        r = revendedor_session.delete(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico/11999998888"
        )
        assert r.status_code == 403, r.text

    def test_add_unauthenticated_returns_401_or_403(self, seeded_data):
        r = requests.post(
            f"{BASE_URL}/api/linhas/{seeded_data['linha_id']}/msisdn-historico",
            json={"numero": "11999998888"}
        )
        assert r.status_code in (401, 403), r.text
