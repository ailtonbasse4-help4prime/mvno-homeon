"""Tests for GET /api/integracao/buscar-cliente-boleto (MVNO integration endpoint)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://chip-manager-3.preview.emergentagent.com").rstrip("/")
ENDPOINT = f"{BASE_URL}/api/integracao/buscar-cliente-boleto"
TOKEN = "test-integration-token-abc123"
HDR = {"x-integration-token": TOKEN}

# Existing seed cliente in db
CLIENTE_CPF = "11144477735"
CLIENTE_NOME_PART = "Maria"  # partial name for regex


def test_no_token_returns_401():
    r = requests.get(ENDPOINT, params={"termo": "teste"})
    assert r.status_code == 401, r.text


def test_wrong_token_returns_401():
    r = requests.get(ENDPOINT, params={"termo": "teste"}, headers={"x-integration-token": "wrong-token"})
    assert r.status_code == 401, r.text


def test_valid_token_cpf_returns_cliente_with_boletos():
    r = requests.get(ENDPOINT, params={"termo": CLIENTE_CPF}, headers=HDR)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "clientes" in data
    assert data.get("total", 0) >= 1
    cli = data["clientes"][0]
    # Structure checks
    for k in ["cliente_id", "nome", "documento", "boletos_abertos"]:
        assert k in cli, f"missing key {k}"
    assert cli["documento"] == CLIENTE_CPF
    # Boletos structure
    assert isinstance(cli["boletos_abertos"], list)
    assert len(cli["boletos_abertos"]) >= 1
    b = cli["boletos_abertos"][0]
    for k in ["id", "valor", "vencimento", "status", "asaas_invoice_url", "asaas_bankslip_url", "asaas_pix_code", "barcode"]:
        assert k in b, f"missing boleto key {k}"


def test_valid_token_name_partial():
    r = requests.get(ENDPOINT, params={"termo": CLIENTE_NOME_PART}, headers=HDR)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("total", 0) >= 1
    assert any(CLIENTE_NOME_PART.lower() in (c.get("nome") or "").lower() for c in data["clientes"])


def test_cpf_inexistente_returns_empty():
    r = requests.get(ENDPOINT, params={"termo": "00000000000"}, headers=HDR)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("total", 0) == 0
    assert data.get("clientes") == []


def test_boletos_only_pending_status():
    r = requests.get(ENDPOINT, params={"termo": CLIENTE_CPF}, headers=HDR)
    assert r.status_code == 200
    data = r.json()
    forbidden = {"CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "REFUNDED", "CANCELLED"}
    for cli in data["clientes"]:
        for b in cli["boletos_abertos"]:
            assert b["status"] not in forbidden, f"paid status leaked: {b['status']}"
