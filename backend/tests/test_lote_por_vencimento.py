"""Tests for the new mass billing generation by due date endpoints.

Endpoints under test:
- GET  /api/carteira/cobrancas/lote/preview
- POST /api/carteira/cobrancas/lote/por-vencimento
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chip-manager-3.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
               timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def unauth_session():
    return requests.Session()


# ----- GET preview -----
class TestPreviewLote:
    def test_preview_requires_auth(self, unauth_session):
        r = unauth_session.get(f"{BASE_URL}/api/carteira/cobrancas/lote/preview", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}: {r.text[:200]}"

    def test_preview_basic_structure(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/carteira/cobrancas/lote/preview", timeout=20)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        for k in ("mes_alvo", "ano_alvo", "total", "items", "counts_by_dia"):
            assert k in data, f"Missing key: {k}"
        assert isinstance(data["items"], list)
        assert isinstance(data["counts_by_dia"], dict)
        assert isinstance(data["total"], int)
        # Defaults: current month/year
        assert 1 <= data["mes_alvo"] <= 12
        assert data["ano_alvo"] >= 2025

    def test_preview_with_filters(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/carteira/cobrancas/lote/preview",
            params={"dia_vencimento": 15, "mes": 8, "ano": 2026},
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["mes_alvo"] == 8
        assert data["ano_alvo"] == 2026
        # All items returned should have dia_vencimento == 15
        for item in data["items"]:
            assert item.get("dia_vencimento") == 15, f"Filter failed: {item}"

    def test_preview_items_have_required_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/carteira/cobrancas/lote/preview", timeout=20)
        data = r.json()
        # If there are items, validate field shape
        for item in data["items"][:5]:
            for k in ("assinatura_id", "cliente_id", "vencimento_alvo",
                      "dia_vencimento", "ja_tem_cobranca", "valor_assinatura"):
                assert k in item, f"item missing key {k}: {item}"


# ----- POST por-vencimento -----
class TestGerarLote:
    def test_post_requires_auth(self, unauth_session):
        r = unauth_session.post(
            f"{BASE_URL}/api/carteira/cobrancas/lote/por-vencimento",
            json={"items": [], "billing_type": "BOLETO"},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_post_empty_items_returns_zero(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/carteira/cobrancas/lote/por-vencimento",
            json={"items": [], "billing_type": "BOLETO"},
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("success") is True
        assert data.get("created") == 0
        assert data.get("total") == 0
        assert isinstance(data.get("errors"), list)
        assert isinstance(data.get("items"), list)
        # New field added: skipped
        assert "skipped" in data

    def test_post_invalid_assinatura_returns_error_item(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/carteira/cobrancas/lote/por-vencimento",
            json={
                "items": [{
                    "assinatura_id": "000000000000000000000000",  # valid format, not in DB
                    "valor": 10.0,
                    "vencimento": "2026-08-15",
                }],
                "billing_type": "BOLETO",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["created"] == 0
        assert len(data["errors"]) >= 1
        err = data["errors"][0]
        assert "error" in err and ("nao encontrada" in err["error"].lower() or "invalido" in err["error"].lower())

    def test_post_invalid_id_format(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/carteira/cobrancas/lote/por-vencimento",
            json={
                "items": [{
                    "assinatura_id": "not-an-objectid",
                    "valor": 10.0,
                    "vencimento": "2026-08-15",
                }],
                "billing_type": "BOLETO",
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["created"] == 0
        assert len(data["errors"]) == 1
        assert "invalido" in data["errors"][0]["error"].lower()

    def test_post_response_shape(self, admin_session):
        r = admin_session.post(
            f"{BASE_URL}/api/carteira/cobrancas/lote/por-vencimento",
            json={"items": [], "billing_type": "BOLETO"},
            timeout=20,
        )
        data = r.json()
        for k in ("success", "created", "skipped", "errors", "total", "items"):
            assert k in data, f"Response missing key {k}"


# ----- Admin enforcement: try with non-admin -----
class TestAdminOnly:
    def test_non_admin_blocked_or_skipped(self, admin_session):
        """Best-effort: create a non-admin user, login, attempt POST -> 403.
        If non-admin signup unsupported, skip."""
        # Try to find an existing non-admin via /api/users list or skip
        try:
            r = admin_session.get(f"{BASE_URL}/api/users", timeout=10)
            if r.status_code != 200:
                pytest.skip("Cannot list users; skipping non-admin enforcement test.")
            users = r.json() if isinstance(r.json(), list) else r.json().get("users", [])
            non_admin = next((u for u in users if u.get("role") != "admin"), None)
            if not non_admin:
                pytest.skip("No non-admin user available to test 403.")
            # We cannot login as them without their password; skip.
            pytest.skip("Non-admin password unknown in env; cannot test 403 directly.")
        except Exception as e:
            pytest.skip(f"Skipped: {e}")
