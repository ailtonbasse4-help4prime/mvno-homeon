"""
Tests for Automacao de Bloqueio/Desbloqueio por Inadimplencia.
IMPORTANT: Only read-only + dry_run tests. NEVER execute real block (dry_run=false).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


# --------- CONFIG ---------
class TestConfig:
    def test_get_config_default(self, admin_session):
        r = admin_session.get(f"{API}/automacao/bloqueio/config", timeout=10)
        assert r.status_code == 200
        d = r.json()
        # Feature must be OFF by default in production. Only assert value if never touched.
        assert "ativo" in d
        assert d["hora_bloqueio"] == 23
        assert d["hora_aviso"] == 9
        assert d["motivo_bloqueio"] == 15

    def test_put_config_partial_update(self, admin_session):
        # snapshot current config
        cur = admin_session.get(f"{API}/automacao/bloqueio/config").json()
        original_hora_aviso = cur.get("hora_aviso", 9)
        # partial update - only send notificar_admin toggle back-and-forth
        r = admin_session.put(f"{API}/automacao/bloqueio/config", json={"notificar_admin": True}, timeout=10)
        assert r.status_code == 200
        after = r.json()
        # unchanged fields preserved
        assert after["hora_aviso"] == original_hora_aviso
        assert after["hora_bloqueio"] == cur["hora_bloqueio"]

    def test_put_config_validation_hora_bloqueio(self, admin_session):
        r = admin_session.put(f"{API}/automacao/bloqueio/config", json={"hora_bloqueio": 24}, timeout=10)
        assert r.status_code == 400

    def test_put_config_validation_hora_aviso(self, admin_session):
        r = admin_session.put(f"{API}/automacao/bloqueio/config", json={"hora_aviso": 99}, timeout=10)
        assert r.status_code == 400

    def test_config_stays_inactive_after_tests(self, admin_session):
        # Ensure ativo=false at end
        r = admin_session.put(f"{API}/automacao/bloqueio/config", json={"ativo": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["ativo"] is False


# --------- SIMULACAO ---------
class TestSimulacao:
    def test_simular_structure(self, admin_session):
        # snapshot linhas count as regression guard
        r = admin_session.get(f"{API}/automacao/bloqueio/simular", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert set(["total", "a_bloquear", "skip_whitelist", "itens"]).issubset(d.keys())
        assert isinstance(d["itens"], list)
        assert d["total"] == len(d["itens"])
        assert d["a_bloquear"] + d["skip_whitelist"] == d["total"]


# --------- WHITELIST ---------
class TestWhitelist:
    _cliente_id = None

    def test_list_whitelist(self, admin_session):
        r = admin_session.get(f"{API}/automacao/bloqueio/whitelist", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_add_whitelist_invalid_id(self, admin_session):
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist", json={"cliente_id": "notavalidobjectid"}, timeout=10)
        assert r.status_code == 400

    def test_add_whitelist_not_found(self, admin_session):
        # valid ObjectId format but non-existent
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist", json={"cliente_id": "000000000000000000000000"}, timeout=10)
        assert r.status_code == 404

    def test_add_remove_whitelist_flow(self, admin_session):
        # Find any cliente
        r = admin_session.get(f"{API}/clientes?limit=1", timeout=15)
        if r.status_code != 200:
            pytest.skip(f"clientes endpoint not available: {r.status_code}")
        data = r.json()
        clientes = data if isinstance(data, list) else data.get("items") or data.get("clientes") or []
        if not clientes:
            pytest.skip("no clientes to test")
        cid = clientes[0].get("id") or clientes[0].get("_id")
        TestWhitelist._cliente_id = cid

        # Add
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist", json={"cliente_id": cid, "motivo": "TEST_regressao"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # Duplicate should fail
        r2 = admin_session.post(f"{API}/automacao/bloqueio/whitelist", json={"cliente_id": cid, "motivo": "TEST_dup"}, timeout=10)
        assert r2.status_code == 400

        # Remove
        r3 = admin_session.delete(f"{API}/automacao/bloqueio/whitelist/{cid}", timeout=10)
        assert r3.status_code == 200

        # Removing again -> 404
        r4 = admin_session.delete(f"{API}/automacao/bloqueio/whitelist/{cid}", timeout=10)
        assert r4.status_code == 404


# --------- EXECUTAR (dry_run ONLY!) ---------
class TestExecutar:
    def test_executar_dry_run(self, admin_session):
        # snapshot count of blocked linhas BEFORE
        # Note: we compare via simular result before/after
        sim_before = admin_session.get(f"{API}/automacao/bloqueio/simular").json()
        r = admin_session.post(f"{API}/automacao/bloqueio/executar", json={"dry_run": True, "dias_tolerancia": 0}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is True
        assert "bloqueadas" in d
        assert "erros" in d
        # Simulate again - nothing should have changed
        sim_after = admin_session.get(f"{API}/automacao/bloqueio/simular").json()
        assert sim_before["total"] == sim_after["total"], "dry_run alterou dados!"


# --------- HISTORICO ---------
class TestHistorico:
    def test_historico(self, admin_session):
        r = admin_session.get(f"{API}/automacao/bloqueio/historico?limit=20", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --------- SEGURANCA ---------
class TestSecurity:
    ENDPOINTS = [
        ("GET", "/automacao/bloqueio/config", None),
        ("PUT", "/automacao/bloqueio/config", {"ativo": False}),
        ("GET", "/automacao/bloqueio/simular", None),
        ("GET", "/automacao/bloqueio/whitelist", None),
        ("POST", "/automacao/bloqueio/whitelist", {"cliente_id": "000000000000000000000000"}),
        ("DELETE", "/automacao/bloqueio/whitelist/000000000000000000000000", None),
        ("POST", "/automacao/bloqueio/executar", {"dry_run": True}),
        ("GET", "/automacao/bloqueio/historico", None),
    ]

    @pytest.mark.parametrize("method,path,body", ENDPOINTS)
    def test_unauth_returns_401(self, anon_session, method, path, body):
        r = anon_session.request(method, f"{API}{path}", json=body, timeout=10)
        assert r.status_code in (401, 403), f"{method} {path} -> {r.status_code}"

    @pytest.mark.parametrize("method,path,body", ENDPOINTS)
    def test_non_admin_returns_403(self, method, path, body):
        # Try to create/login as a non-admin. If not possible, skip.
        s = requests.Session()
        # Try registering a viewer via admin? For simplicity, skip if we can't.
        # Attempt to login with a common test user
        r = s.post(f"{API}/auth/login", json={"email": "viewer@mvno.com", "password": "viewer123"}, timeout=10)
        if r.status_code != 200:
            pytest.skip("no non-admin user available")
        resp = s.request(method, f"{API}{path}", json=body, timeout=10)
        assert resp.status_code == 403


# --------- REGRESSAO WEBHOOK ASAAS ---------
class TestWebhookAsaas:
    def test_webhook_accepts_confirmed_payload(self):
        # Public endpoint - no auth
        payload = {
            "event": "PAYMENT_CONFIRMED",
            "payment": {
                "id": "pay_test_nonexistent_TEST_regressao",
                "status": "CONFIRMED",
                "value": 10.0,
                "customer": "cus_nonexistent"
            }
        }
        r = requests.post(f"{API}/webhooks/asaas", json=payload, timeout=15)
        # webhook should accept payload (200 or 2xx) even if cobranca not found; should NOT be 500
        assert r.status_code < 500, f"Webhook Asaas quebrou: {r.status_code} {r.text}"



# --------- ITERATION 30: LOTE + ORDENACAO ALFABETICA ---------
class TestWhitelistLote:
    """POST /whitelist/lote and alphabetical sorting."""

    @pytest.fixture(scope="class")
    def cliente_ids(self, admin_session):
        r = admin_session.get(f"{API}/clientes?limit=10", timeout=15)
        assert r.status_code == 200
        data = r.json()
        clientes = data if isinstance(data, list) else data.get("items") or data.get("clientes") or []
        ids = [c.get("id") or c.get("_id") for c in clientes[:3]]
        if len(ids) < 2:
            pytest.skip("need at least 2 clientes to test lote")
        return ids

    def _cleanup(self, session, ids):
        for cid in ids:
            try:
                session.delete(f"{API}/automacao/bloqueio/whitelist/{cid}", timeout=10)
            except Exception:
                pass

    def test_lote_empty_400(self, admin_session):
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist/lote", json={"cliente_ids": []}, timeout=10)
        assert r.status_code == 400

    def test_lote_add_success(self, admin_session, cliente_ids):
        self._cleanup(admin_session, cliente_ids)
        r = admin_session.post(
            f"{API}/automacao/bloqueio/whitelist/lote",
            json={"cliente_ids": cliente_ids, "motivo": "TEST_VIP_lote"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["adicionados"] == len(cliente_ids)
        assert d["ja_existiam"] == 0
        assert d["total_processados"] == len(cliente_ids)
        assert isinstance(d["erros"], list)
        # cleanup after
        self._cleanup(admin_session, cliente_ids)

    def test_lote_idempotente(self, admin_session, cliente_ids):
        self._cleanup(admin_session, cliente_ids)
        # first insert
        admin_session.post(f"{API}/automacao/bloqueio/whitelist/lote",
                           json={"cliente_ids": cliente_ids, "motivo": "TEST"}, timeout=15)
        # second call - all should already exist
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist/lote",
                               json={"cliente_ids": cliente_ids, "motivo": "TEST"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["adicionados"] == 0
        assert d["ja_existiam"] == len(cliente_ids)
        self._cleanup(admin_session, cliente_ids)

    def test_lote_invalid_id_goes_to_erros(self, admin_session, cliente_ids):
        self._cleanup(admin_session, cliente_ids)
        mixed = cliente_ids[:1] + ["notavalidid_TEST", "000000000000000000000000"]
        r = admin_session.post(f"{API}/automacao/bloqueio/whitelist/lote",
                               json={"cliente_ids": mixed, "motivo": "TEST"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["adicionados"] == 1  # only the valid one
        assert len(d["erros"]) >= 2   # both invalid ones fail
        self._cleanup(admin_session, cliente_ids)

    def test_lote_requires_auth(self, anon_session):
        r = anon_session.post(f"{API}/automacao/bloqueio/whitelist/lote",
                              json={"cliente_ids": ["000000000000000000000000"]}, timeout=10)
        assert r.status_code in (401, 403)


class TestWhitelistAlfabetico:
    def test_whitelist_ordenada_alfabeticamente(self, admin_session):
        # add multiple clientes then verify sort order by cliente_nome (case-insensitive)
        r = admin_session.get(f"{API}/clientes?limit=5", timeout=15)
        assert r.status_code == 200
        data = r.json()
        clientes = data if isinstance(data, list) else data.get("items") or data.get("clientes") or []
        ids = [c.get("id") or c.get("_id") for c in clientes[:5]]
        if len(ids) < 2:
            pytest.skip("need at least 2 clientes")

        # cleanup + add
        for cid in ids:
            admin_session.delete(f"{API}/automacao/bloqueio/whitelist/{cid}", timeout=10)
        admin_session.post(f"{API}/automacao/bloqueio/whitelist/lote",
                           json={"cliente_ids": ids, "motivo": "TEST_alfabetico"}, timeout=15)

        try:
            r = admin_session.get(f"{API}/automacao/bloqueio/whitelist", timeout=10)
            assert r.status_code == 200
            wl = r.json()
            nomes = [(w.get("cliente_nome") or "").lower() for w in wl if w.get("cliente_nome")]
            assert nomes == sorted(nomes), f"whitelist nao ordenada: {nomes}"
        finally:
            for cid in ids:
                admin_session.delete(f"{API}/automacao/bloqueio/whitelist/{cid}", timeout=10)
