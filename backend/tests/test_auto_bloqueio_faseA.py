"""Fase A auto-bloqueio: sync expiracao Ta + desbloqueio de confianca.
Iteration 36 tests. Does NOT call sincronizar-expiracao-ta in mass (Ta prod real)."""
import os
import pytest
import requests
from bson import ObjectId

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login falhou {r.status_code}: {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_client():
    return requests.Session()


@pytest.fixture(scope="module")
def non_admin_client():
    """Cria um usuario nao-admin via API admin, faz login como ele."""
    admin = requests.Session()
    r = admin.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200
    email = "TEST_faseA_operator@mvno.com"
    payload = {"email": email, "name": "TEST FaseA Atendente", "password": "TestPass123!", "role": "atendente"}
    r = admin.post(f"{BASE_URL}/api/usuarios", json=payload, timeout=20)
    # ok even if 409/400 (ja existe)
    user_client = requests.Session()
    lr = user_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "TestPass123!"}, timeout=20)
    if lr.status_code != 200:
        pytest.skip(f"nao foi possivel criar/logar non-admin: {r.status_code}/{r.text[:200]} login:{lr.status_code}")
    yield user_client
    # cleanup best effort
    try:
        me = user_client.get(f"{BASE_URL}/api/auth/me", timeout=10).json()
        uid = me.get("id")
        if uid:
            admin.delete(f"{BASE_URL}/api/usuarios/{uid}", timeout=10)
    except Exception:
        pass


# ============ SINCRONIZAR EXPIRACAO TA ============
class TestSincronizarExpiracaoTa:
    def test_requires_auth(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/automacao/bloqueio/sincronizar-expiracao-ta", timeout=15)
        assert r.status_code == 401, f"esperado 401 got {r.status_code}"

    def test_non_admin_forbidden(self, non_admin_client):
        r = non_admin_client.post(f"{BASE_URL}/api/automacao/bloqueio/sincronizar-expiracao-ta", timeout=15)
        assert r.status_code == 403, f"esperado 403 got {r.status_code}: {r.text[:200]}"

    # NAO executamos como admin (produca 114 chamadas reais Ta)


# ============ DESBLOQUEIO DE CONFIANCA ============
class TestDesbloqueioConfianca:
    def test_requires_auth(self, anon_client):
        r = anon_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/507f1f77bcf86cd799439011/desbloqueio-confianca",
            json={"dias": 2}, timeout=15,
        )
        assert r.status_code == 401

    def test_non_admin_forbidden(self, non_admin_client):
        r = non_admin_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/507f1f77bcf86cd799439011/desbloqueio-confianca",
            json={"dias": 2}, timeout=15,
        )
        assert r.status_code == 403

    def test_dias_menor_que_1(self, admin_client):
        r = admin_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/507f1f77bcf86cd799439011/desbloqueio-confianca",
            json={"dias": 0}, timeout=15,
        )
        assert r.status_code == 400
        assert "1 e 30" in r.text or "entre 1" in r.text.lower()

    def test_dias_maior_que_30(self, admin_client):
        r = admin_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/507f1f77bcf86cd799439011/desbloqueio-confianca",
            json={"dias": 31}, timeout=15,
        )
        assert r.status_code == 400

    def test_linha_id_invalido(self, admin_client):
        r = admin_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/xxx-invalid-id/desbloqueio-confianca",
            json={"dias": 2}, timeout=15,
        )
        assert r.status_code == 400

    def test_linha_inexistente(self, admin_client):
        # ObjectId valido mas nao existente
        fake_id = str(ObjectId())
        r = admin_client.post(
            f"{BASE_URL}/api/automacao/bloqueio/linhas/{fake_id}/desbloqueio-confianca",
            json={"dias": 2}, timeout=15,
        )
        assert r.status_code == 404, f"esperado 404 got {r.status_code}: {r.text[:200]}"


# ============ LISTAR DESBLOQUEIOS DE CONFIANCA ============
class TestListDesbloqueiosConfianca:
    def test_requires_auth(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/automacao/bloqueio/desbloqueios-confianca", timeout=15)
        assert r.status_code == 401

    def test_non_admin_forbidden(self, non_admin_client):
        r = non_admin_client.get(f"{BASE_URL}/api/automacao/bloqueio/desbloqueios-confianca", timeout=15)
        assert r.status_code == 403

    def test_admin_ok_and_sorted(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/automacao/bloqueio/desbloqueios-confianca", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # ordenacao por expira_em asc quando ha items
        if len(data) >= 2:
            exps = [x.get("expira_em") for x in data if x.get("expira_em")]
            assert exps == sorted(exps), "lista nao ordenada por expira_em"
        # estrutura basica
        for item in data:
            assert "linha_id" in item


# ============ HELPERS (unit test importando o modulo) ============
class TestHelpers:
    def test_extrair_data_e_normalize(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from routes import automacao_bloqueio as ab
        # _normalize_date
        assert ab._normalize_date("25/12/2026") == "2026-12-25"
        assert ab._normalize_date("2026-01-15") == "2026-01-15"
        assert ab._normalize_date("2026-01-15T10:00:00Z") == "2026-01-15"
        assert ab._normalize_date("") is None
        assert ab._normalize_date(None) is None

    def test_extrair_data_expiracao_campos(self):
        import sys, asyncio
        sys.path.insert(0, "/app/backend")
        from routes import automacao_bloqueio as ab
        async def _run():
            assert await ab._extrair_data_expiracao({"data_expiracao": "25/12/2026"}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({"expiration_date": "2026-12-25"}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({"plan_expiration": "2026-12-25T10:00:00Z"}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({"expira_em": "2026-12-25"}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({"expiresAt": "2026-12-25"}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({"plan": {"data_expiracao": "25/12/2026"}}) == "2026-12-25"
            assert await ab._extrair_data_expiracao({}) is None
            assert await ab._extrair_data_expiracao(None) is None
        asyncio.run(_run())
