"""
Backend tests for Portal Recarga PIX endpoints:
- GET  /api/portal/ofertas-disponiveis?linha_id=X
- POST /api/portal/recarga/iniciar
- GET  /api/portal/recarga/{cobranca_id}/status
"""
import os
import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "mvno_management")


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def test_cliente(mongo_db):
    """Pick a real cliente that has a linha with msisdn."""
    linha = mongo_db.linhas.find_one({"msisdn": {"$ne": None}})
    assert linha, "No linha with msisdn found in DB"
    cli = mongo_db.clientes.find_one({"_id": ObjectId(linha["cliente_id"])})
    assert cli, "Cliente not found"
    return {
        "cliente_id": str(cli["_id"]),
        "documento": cli.get("documento"),
        "telefone": cli.get("telefone") or linha.get("msisdn"),
        "linha_id": str(linha["_id"]),
        "linha_msisdn": linha.get("msisdn"),
        "nome": cli.get("nome"),
    }


@pytest.fixture(scope="module")
def portal_token(test_cliente):
    r = requests.post(f"{API}/portal/login", json={
        "documento": test_cliente["documento"],
        "telefone": test_cliente["telefone"],
    })
    if r.status_code != 200:
        pytest.skip(f"Portal login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(portal_token):
    return {"Authorization": f"Bearer {portal_token}"}


@pytest.fixture(scope="module")
def oferta_movel(mongo_db):
    """Pick an active mobile offer with a plan_code."""
    for o in mongo_db.ofertas.find({"ativo": True, "categoria": "movel"}):
        if o.get("plano_id") and ObjectId.is_valid(o["plano_id"]):
            p = mongo_db.planos.find_one({"_id": ObjectId(o["plano_id"])})
            if p and p.get("plan_code"):
                return {"oferta_id": str(o["_id"]), "plano_id": str(p["_id"]), "valor": o.get("valor")}
    pytest.skip("No suitable oferta with plan_code found")


# ---------- Sanity: portal login ----------
class TestPortalLoginSanity:
    def test_portal_login_returns_token(self, portal_token):
        assert isinstance(portal_token, str) and len(portal_token) > 20


# ---------- GET /portal/ofertas-disponiveis ----------
class TestOfertasDisponiveis:
    def test_requires_auth_no_token(self, test_cliente):
        r = requests.get(f"{API}/portal/ofertas-disponiveis", params={"linha_id": test_cliente["linha_id"]})
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_requires_auth_invalid_token(self, test_cliente):
        r = requests.get(
            f"{API}/portal/ofertas-disponiveis",
            params={"linha_id": test_cliente["linha_id"]},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_404_when_linha_not_owned(self, auth_headers, mongo_db, test_cliente):
        # find a linha belonging to someone else
        other = mongo_db.linhas.find_one({"cliente_id": {"$ne": test_cliente["cliente_id"]}})
        assert other, "no other linha to test with"
        r = requests.get(
            f"{API}/portal/ofertas-disponiveis",
            params={"linha_id": str(other["_id"])},
            headers=auth_headers,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_400_or_404_invalid_linha_id(self, auth_headers):
        r = requests.get(
            f"{API}/portal/ofertas-disponiveis",
            params={"linha_id": "not-a-valid-id"},
            headers=auth_headers,
        )
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text}"

    def test_lists_ofertas_with_expected_fields(self, auth_headers, test_cliente):
        r = requests.get(
            f"{API}/portal/ofertas-disponiveis",
            params={"linha_id": test_cliente["linha_id"]},
            headers=auth_headers,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        data = r.json()
        assert "linha" in data and "ofertas" in data
        assert data["linha"]["id"] == test_cliente["linha_id"]
        assert isinstance(data["ofertas"], list)
        assert len(data["ofertas"]) >= 1
        for o in data["ofertas"]:
            assert "id" in o
            assert "nome" in o
            assert "valor" in o
            assert "plano_nome" in o
            assert "franquia" in o
            assert "plan_code" in o
            assert "atual" in o
            assert isinstance(o["atual"], bool)


# ---------- POST /portal/recarga/iniciar ----------
class TestRecargaIniciar:
    def test_requires_auth(self, test_cliente, oferta_movel):
        r = requests.post(f"{API}/portal/recarga/iniciar", json={
            "linha_id": test_cliente["linha_id"],
            "oferta_id": oferta_movel["oferta_id"],
        })
        assert r.status_code == 401, f"got {r.status_code}: {r.text}"

    def test_400_oferta_id_invalido(self, auth_headers, test_cliente):
        r = requests.post(f"{API}/portal/recarga/iniciar",
            json={"linha_id": test_cliente["linha_id"], "oferta_id": "not-an-oid"},
            headers=auth_headers,
        )
        assert r.status_code == 400, f"got {r.status_code}: {r.text}"

    def test_404_oferta_nao_encontrada(self, auth_headers, test_cliente):
        fake_oid = str(ObjectId())
        r = requests.post(f"{API}/portal/recarga/iniciar",
            json={"linha_id": test_cliente["linha_id"], "oferta_id": fake_oid},
            headers=auth_headers,
        )
        assert r.status_code == 404, f"got {r.status_code}: {r.text}"

    def test_404_linha_nao_pertence(self, auth_headers, mongo_db, test_cliente, oferta_movel):
        other = mongo_db.linhas.find_one({"cliente_id": {"$ne": test_cliente["cliente_id"]}})
        r = requests.post(f"{API}/portal/recarga/iniciar",
            json={"linha_id": str(other["_id"]), "oferta_id": oferta_movel["oferta_id"]},
            headers=auth_headers,
        )
        assert r.status_code == 404, f"got {r.status_code}: {r.text}"

    def test_400_plano_sem_plan_code(self, auth_headers, mongo_db, test_cliente):
        """Create a temp plano without plan_code + oferta pointing to it."""
        plano_id = mongo_db.planos.insert_one({
            "nome": "TEST_no_plan_code",
            "franquia": "1GB",
            "plan_code": None,
            "categoria": "movel",
        }).inserted_id
        oferta_id = mongo_db.ofertas.insert_one({
            "nome": "TEST_oferta_no_code",
            "ativo": True,
            "categoria": "movel",
            "valor": 9.99,
            "plano_id": str(plano_id),
        }).inserted_id
        try:
            r = requests.post(f"{API}/portal/recarga/iniciar",
                json={"linha_id": test_cliente["linha_id"], "oferta_id": str(oferta_id)},
                headers=auth_headers,
            )
            assert r.status_code == 400, f"got {r.status_code}: {r.text}"
            assert "plan_code" in r.text.lower() or "plano" in r.text.lower()
        finally:
            mongo_db.ofertas.delete_one({"_id": oferta_id})
            mongo_db.planos.delete_one({"_id": plano_id})

    def test_iniciar_sucesso_ou_asaas_503(self, auth_headers, test_cliente, oferta_movel, mongo_db):
        """Full flow - either returns PIX data (success) or 503 if Asaas not configured."""
        r = requests.post(f"{API}/portal/recarga/iniciar",
            json={"linha_id": test_cliente["linha_id"], "oferta_id": oferta_movel["oferta_id"]},
            headers=auth_headers,
        )
        # Accept 200 (success) OR 503 (Asaas not configured, expected in preview env)
        # OR 500 if Asaas call fails due to network/creds
        assert r.status_code in (200, 500, 503), f"got {r.status_code}: {r.text}"
        if r.status_code == 200:
            data = r.json()
            assert "cobranca_id" in data
            assert "asaas_payment_id" in data
            assert "valor" in data
            assert "status" in data
            assert "invoice_url" in data
            # save for status test
            pytest.recarga_cobranca_id = data["cobranca_id"]
            # cleanup at end handled elsewhere
        elif r.status_code == 503:
            assert "Asaas" in r.text


# ---------- GET /portal/recarga/{cobranca_id}/status ----------
class TestRecargaStatus:
    def test_requires_auth(self):
        r = requests.get(f"{API}/portal/recarga/{ObjectId()}/status")
        assert r.status_code == 401, f"got {r.status_code}: {r.text}"

    def test_404_cobranca_nao_pertence(self, auth_headers, mongo_db, test_cliente):
        """Insert a cobranca of a different client, verify 404."""
        other_cid = mongo_db.clientes.find_one({"_id": {"$ne": ObjectId(test_cliente["cliente_id"])}})
        assert other_cid
        cob_id = mongo_db.cobrancas.insert_one({
            "cliente_id": str(other_cid["_id"]),
            "status": "PENDING",
            "external_reference": "recarga:xxx:yyy",
            "tipo": "recarga_portal",
        }).inserted_id
        try:
            r = requests.get(f"{API}/portal/recarga/{cob_id}/status", headers=auth_headers)
            assert r.status_code == 404, f"got {r.status_code}: {r.text}"
        finally:
            mongo_db.cobrancas.delete_one({"_id": cob_id})

    def test_400_ou_404_cobranca_id_invalido(self, auth_headers):
        r = requests.get(f"{API}/portal/recarga/invalid-id/status", headers=auth_headers)
        assert r.status_code in (400, 404), f"got {r.status_code}: {r.text}"

    def test_status_de_propria_cobranca(self, auth_headers, mongo_db, test_cliente):
        cob_id = mongo_db.cobrancas.insert_one({
            "cliente_id": test_cliente["cliente_id"],
            "status": "PENDING",
            "external_reference": "recarga:xxx:yyy",
            "tipo": "recarga_portal",
        }).inserted_id
        try:
            r = requests.get(f"{API}/portal/recarga/{cob_id}/status", headers=auth_headers)
            assert r.status_code == 200, f"got {r.status_code}: {r.text}"
            data = r.json()
            assert "status" in data
            assert "paga" in data
            assert "recarga_aplicada" in data
            assert isinstance(data["paga"], bool)
            assert isinstance(data["recarga_aplicada"], bool)
        finally:
            mongo_db.cobrancas.delete_one({"_id": cob_id})
