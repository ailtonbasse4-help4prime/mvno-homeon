"""
Iteration 31: DUPLA-CHECAGEM INDIVIDUAL antes de bloquear (fail-safe anti bloqueio indevido).
- POST /carteira/sincronizar-status
- POST /automacao/bloqueio/executar (dry_run=true) - garantir que nao chama Asaas
- Confirma novos campos: pulados_pagamento_asaas, pagamentos_verificados_asaas
- Seguranca: nao-admin recebe 401/403
IMPORTANT: NUNCA rodar executar dry_run=false neste teste (Ta Telecom eh producao).
"""
import os
import time
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


class TestSincronizarStatus:
    """POST /api/carteira/sincronizar-status - endpoint de sync com Asaas."""

    def test_sincronizar_status_admin_ok(self, admin_session):
        """Deve retornar 200 e conter total_checked, updated e errors."""
        r = admin_session.post(f"{API}/carteira/sincronizar-status", json={}, timeout=180)
        assert r.status_code == 200, f"Expected 200, got {r.status_code} - {r.text[:400]}"
        data = r.json()
        # Campos obrigatorios
        for key in ("total_checked", "updated", "errors"):
            assert key in data, f"Missing key '{key}' in response: {data}"
        assert isinstance(data["total_checked"], int)
        assert isinstance(data["updated"], int)
        assert isinstance(data["errors"], list)
        assert data["updated"] <= data["total_checked"]
        print(f"[sync] total_checked={data['total_checked']} updated={data['updated']} errors={len(data['errors'])}")

    def test_sincronizar_status_requires_auth(self, anon_session):
        r = anon_session.post(f"{API}/carteira/sincronizar-status", json={}, timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


class TestExecutarDryRunFailsafe:
    """Dry-run NAO deve chamar Asaas por cliente. Novos campos devem estar presentes."""

    def test_dry_run_returns_new_fields(self, admin_session):
        t0 = time.time()
        r = admin_session.post(
            f"{API}/automacao/bloqueio/executar",
            json={"dry_run": True, "dias_tolerancia": 0},
            timeout=180,
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, f"Expected 200, got {r.status_code} - {r.text[:400]}"
        data = r.json()
        # dry_run tem que estar true no retorno
        assert data.get("dry_run") is True
        # Novos campos devem existir mesmo em dry_run
        assert "pulados_pagamento_asaas" in data, f"missing pulados_pagamento_asaas: {list(data.keys())}"
        assert "pagamentos_verificados_asaas" in data, f"missing pagamentos_verificados_asaas: {list(data.keys())}"
        # Em dry_run, NAO deve haver chamadas Asaas (verificados = 0 e pulados = 0)
        assert data["pagamentos_verificados_asaas"] == 0, (
            f"dry_run nao deveria consultar Asaas individualmente. Got {data['pagamentos_verificados_asaas']} verificacoes."
        )
        assert data["pulados_pagamento_asaas"] == 0, (
            f"dry_run nao deveria pular por Asaas. Got {data['pulados_pagamento_asaas']}."
        )
        print(f"[dry_run] elapsed={elapsed:.1f}s total_inadimplentes={data.get('total_inadimplentes')} bloqueadas={data.get('bloqueadas')}")

    def test_executar_requires_admin(self, anon_session):
        r = anon_session.post(
            f"{API}/automacao/bloqueio/executar",
            json={"dry_run": True, "dias_tolerancia": 0},
            timeout=15,
        )
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


class TestConfigAtivoFalse:
    """SEGURANCA: config.ativo deve permanecer false para nao rodar worker acidentalmente."""

    def test_ativo_permanece_false(self, admin_session):
        r = admin_session.get(f"{API}/automacao/bloqueio/config", timeout=15)
        assert r.status_code == 200
        cfg = r.json()
        assert cfg.get("ativo") is False, f"config.ativo deveria ser false, got {cfg.get('ativo')}"
        # Salvaguarda tambem deve estar ativa (default True)
        assert cfg.get("sync_asaas_antes_bloqueio", True) is True
