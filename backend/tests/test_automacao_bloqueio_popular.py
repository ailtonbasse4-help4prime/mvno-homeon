"""Tests for POST /api/automacao/bloqueio/popular-expiracao-de-recarga bug fix"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def auth_headers():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    # also return session (in case httpOnly cookies used)
    return headers, s


def test_popular_expiracao_no_auth_not_404():
    """Without auth, endpoint must NOT return 404 (proving route is registered)."""
    r = requests.post(f"{BASE_URL}/api/automacao/bloqueio/popular-expiracao-de-recarga", timeout=30)
    assert r.status_code != 404, f"Endpoint returns 404 (route not registered!): {r.text[:200]}"
    assert r.status_code in (401, 403), f"Expected 401/403 without auth, got {r.status_code}: {r.text[:200]}"


def test_painel_endpoint_router_working(auth_headers):
    headers, sess = auth_headers
    r = sess.get(f"{BASE_URL}/api/automacao/bloqueio/painel", headers=headers, timeout=30)
    assert r.status_code != 404, f"painel returned 404: {r.text[:200]}"
    assert r.status_code == 200, f"painel expected 200, got {r.status_code}: {r.text[:200]}"


def test_popular_expiracao_authenticated_returns_200(auth_headers):
    headers, sess = auth_headers
    r = sess.post(f"{BASE_URL}/api/automacao/bloqueio/popular-expiracao-de-recarga",
                  headers=headers, timeout=60)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data.get("ok") is True, f"ok not True: {data}"
    for key in ("atualizadas", "ja_preenchidas", "sem_proxima_recarga", "sem_proxima_recarga_invalida"):
        assert key in data, f"Missing key {key} in response: {data}"
        assert isinstance(data[key], int), f"Key {key} not int: {data[key]}"
