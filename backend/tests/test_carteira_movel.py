"""
Test suite for Carteira Movel (Mobile Wallet) feature
Tests: Cobrancas (charges), Assinaturas (subscriptions), Webhook, Config endpoints
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"


class TestCarteiraMovelAPI:
    """Tests for Carteira Movel endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        yield
        # Cleanup - logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    # ==================== CONFIG TESTS ====================
    def test_get_carteira_config(self):
        """GET /api/carteira/config - returns Asaas configuration status"""
        response = self.session.get(f"{BASE_URL}/api/carteira/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "configured" in data, "Response should have 'configured' field"
        assert "environment" in data, "Response should have 'environment' field"
        assert "base_url" in data, "Response should have 'base_url' field"
        
        # Asaas is NOT configured (no API key)
        assert data["configured"] == False, "Asaas should NOT be configured (no API key)"
        print(f"✓ Carteira config: configured={data['configured']}, env={data['environment']}")
    
    # ==================== RESUMO TESTS ====================
    def test_get_carteira_resumo(self):
        """GET /api/carteira/resumo - returns financial summary"""
        response = self.session.get(f"{BASE_URL}/api/carteira/resumo")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check structure
        assert "cobrancas" in data, "Response should have 'cobrancas' section"
        assert "assinaturas" in data, "Response should have 'assinaturas' section"
        assert "financeiro" in data, "Response should have 'financeiro' section"
        assert "asaas" in data, "Response should have 'asaas' section"
        
        # Check cobrancas fields
        assert "total" in data["cobrancas"]
        assert "pendentes" in data["cobrancas"]
        assert "pagas" in data["cobrancas"]
        assert "vencidas" in data["cobrancas"]
        
        # Check assinaturas fields
        assert "total" in data["assinaturas"]
        assert "ativas" in data["assinaturas"]
        
        # Check financeiro fields
        assert "receita_total" in data["financeiro"]
        assert "pendente_total" in data["financeiro"]
        assert "vencido_total" in data["financeiro"]
        
        print(f"✓ Resumo: cobrancas={data['cobrancas']['total']}, assinaturas={data['assinaturas']['total']}")
        print(f"  Receita: R${data['financeiro']['receita_total']:.2f}, Pendente: R${data['financeiro']['pendente_total']:.2f}")
    
    # ==================== COBRANCAS TESTS ====================
    def test_list_cobrancas(self):
        """GET /api/carteira/cobrancas - list charges"""
        response = self.session.get(f"{BASE_URL}/api/carteira/cobrancas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ List cobrancas: {len(data)} items")
        
        if len(data) > 0:
            cobranca = data[0]
            assert "id" in cobranca
            assert "cliente_id" in cobranca
            assert "billing_type" in cobranca
            assert "valor" in cobranca
            assert "vencimento" in cobranca
            assert "status" in cobranca
            print(f"  First cobranca: {cobranca.get('cliente_nome')} - R${cobranca['valor']:.2f} - {cobranca['status']}")
    
    def test_list_cobrancas_with_status_filter(self):
        """GET /api/carteira/cobrancas?status=PENDING - filter by status"""
        response = self.session.get(f"{BASE_URL}/api/carteira/cobrancas", params={"status": "PENDING"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All items should have PENDING status
        for cobranca in data:
            assert cobranca["status"] == "PENDING", f"Expected PENDING, got {cobranca['status']}"
        
        print(f"✓ List cobrancas with status=PENDING: {len(data)} items")
    
    def test_create_cobranca(self):
        """POST /api/carteira/cobrancas - create a new charge"""
        # First get a client
        clients_response = self.session.get(f"{BASE_URL}/api/clientes")
        assert clients_response.status_code == 200
        clients = clients_response.json()
        
        if len(clients) == 0:
            pytest.skip("No clients available for testing")
        
        client = clients[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        payload = {
            "cliente_id": client["id"],
            "billing_type": "PIX",
            "valor": 49.90,
            "vencimento": tomorrow,
            "descricao": "TEST_Cobranca de teste automatizado"
        }
        
        response = self.session.post(f"{BASE_URL}/api/carteira/cobrancas", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["cliente_id"] == client["id"]
        assert data["billing_type"] == "PIX"
        assert data["valor"] == 49.90
        assert data["vencimento"] == tomorrow
        assert data["status"] == "PENDING"
        assert "id" in data
        
        print(f"✓ Created cobranca: {data['id']} - R${data['valor']:.2f} - {data['billing_type']}")
        
        # Store for cleanup
        self.created_cobranca_id = data["id"]
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/carteira/cobrancas")
        assert get_response.status_code == 200
        cobrancas = get_response.json()
        found = any(c["id"] == data["id"] for c in cobrancas)
        assert found, "Created cobranca should be in list"
        print(f"✓ Verified cobranca persistence")
    
    def test_delete_cobranca_pending(self):
        """DELETE /api/carteira/cobrancas/{id} - delete pending charge"""
        # First create a cobranca to delete
        clients_response = self.session.get(f"{BASE_URL}/api/clientes")
        clients = clients_response.json()
        
        if len(clients) == 0:
            pytest.skip("No clients available for testing")
        
        client = clients[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        create_response = self.session.post(f"{BASE_URL}/api/carteira/cobrancas", json={
            "cliente_id": client["id"],
            "billing_type": "BOLETO",
            "valor": 29.90,
            "vencimento": tomorrow,
            "descricao": "TEST_Cobranca para deletar"
        })
        assert create_response.status_code == 200
        cobranca_id = create_response.json()["id"]
        
        # Delete the cobranca
        delete_response = self.session.delete(f"{BASE_URL}/api/carteira/cobrancas/{cobranca_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        print(f"✓ Deleted cobranca: {cobranca_id}")
        
        # Verify deletion
        list_response = self.session.get(f"{BASE_URL}/api/carteira/cobrancas")
        cobrancas = list_response.json()
        found = any(c["id"] == cobranca_id for c in cobrancas)
        assert not found, "Deleted cobranca should not be in list"
        print(f"✓ Verified cobranca deletion")
    
    # ==================== ASSINATURAS TESTS ====================
    def test_list_assinaturas(self):
        """GET /api/carteira/assinaturas - list subscriptions"""
        response = self.session.get(f"{BASE_URL}/api/carteira/assinaturas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ List assinaturas: {len(data)} items")
        
        if len(data) > 0:
            assinatura = data[0]
            assert "id" in assinatura
            assert "cliente_id" in assinatura
            assert "billing_type" in assinatura
            assert "valor" in assinatura
            assert "ciclo" in assinatura
            assert "status" in assinatura
            print(f"  First assinatura: {assinatura.get('cliente_nome')} - R${assinatura['valor']:.2f} - {assinatura['ciclo']} - {assinatura['status']}")
    
    def test_create_assinatura_monthly(self):
        """POST /api/carteira/assinaturas - create MONTHLY subscription"""
        # First get a client
        clients_response = self.session.get(f"{BASE_URL}/api/clientes")
        clients = clients_response.json()
        
        if len(clients) == 0:
            pytest.skip("No clients available for testing")
        
        client = clients[0]
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        payload = {
            "cliente_id": client["id"],
            "billing_type": "PIX",
            "valor": 59.90,
            "proximo_vencimento": next_month,
            "ciclo": "MONTHLY",
            "descricao": "TEST_Assinatura mensal de teste"
        }
        
        response = self.session.post(f"{BASE_URL}/api/carteira/assinaturas", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["cliente_id"] == client["id"]
        assert data["billing_type"] == "PIX"
        assert data["valor"] == 59.90
        assert data["ciclo"] == "MONTHLY"
        assert data["status"] == "ACTIVE"
        assert "id" in data
        
        print(f"✓ Created assinatura: {data['id']} - R${data['valor']:.2f} - {data['ciclo']}")
        
        # Store for cleanup
        self.created_assinatura_id = data["id"]
        
        # Verify persistence
        get_response = self.session.get(f"{BASE_URL}/api/carteira/assinaturas")
        assinaturas = get_response.json()
        found = any(a["id"] == data["id"] for a in assinaturas)
        assert found, "Created assinatura should be in list"
        print(f"✓ Verified assinatura persistence")
    
    def test_cancel_assinatura(self):
        """POST /api/carteira/assinaturas/{id}/cancelar - cancel active subscription"""
        # First create an assinatura to cancel
        clients_response = self.session.get(f"{BASE_URL}/api/clientes")
        clients = clients_response.json()
        
        if len(clients) == 0:
            pytest.skip("No clients available for testing")
        
        client = clients[0]
        next_month = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        create_response = self.session.post(f"{BASE_URL}/api/carteira/assinaturas", json={
            "cliente_id": client["id"],
            "billing_type": "BOLETO",
            "valor": 39.90,
            "proximo_vencimento": next_month,
            "ciclo": "MONTHLY",
            "descricao": "TEST_Assinatura para cancelar"
        })
        assert create_response.status_code == 200
        assinatura_id = create_response.json()["id"]
        
        # Cancel the assinatura
        cancel_response = self.session.post(f"{BASE_URL}/api/carteira/assinaturas/{assinatura_id}/cancelar")
        assert cancel_response.status_code == 200, f"Expected 200, got {cancel_response.status_code}: {cancel_response.text}"
        
        print(f"✓ Cancelled assinatura: {assinatura_id}")
        
        # Verify cancellation
        list_response = self.session.get(f"{BASE_URL}/api/carteira/assinaturas")
        assinaturas = list_response.json()
        cancelled = next((a for a in assinaturas if a["id"] == assinatura_id), None)
        assert cancelled is not None, "Cancelled assinatura should still be in list"
        assert cancelled["status"] == "CANCELLED", f"Expected CANCELLED, got {cancelled['status']}"
        print(f"✓ Verified assinatura cancellation status")
    
    # ==================== WEBHOOK TESTS ====================
    def test_webhook_asaas_no_auth_required(self):
        """POST /api/webhooks/asaas - webhook endpoint does NOT require auth"""
        # Use a fresh session without auth
        webhook_session = requests.Session()
        webhook_session.headers.update({"Content-Type": "application/json"})
        
        payload = {
            "event": "PAYMENT_RECEIVED",
            "payment": {
                "id": "pay_test_123",
                "status": "RECEIVED",
                "value": 100.00
            }
        }
        
        response = webhook_session.post(f"{BASE_URL}/api/webhooks/asaas", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("received") == True, "Webhook should return {received: true}"
        print(f"✓ Webhook endpoint accessible without auth, returns {{received: true}}")
    
    def test_webhook_asaas_empty_payload(self):
        """POST /api/webhooks/asaas - handles empty payload gracefully"""
        webhook_session = requests.Session()
        webhook_session.headers.update({"Content-Type": "application/json"})
        
        response = webhook_session.post(f"{BASE_URL}/api/webhooks/asaas", json={})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("received") == True
        print(f"✓ Webhook handles empty payload gracefully")


class TestCarteiraMovelCleanup:
    """Cleanup test data created during tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_cleanup_test_cobrancas(self):
        """Cleanup TEST_ prefixed cobrancas"""
        response = self.session.get(f"{BASE_URL}/api/carteira/cobrancas")
        if response.status_code != 200:
            pytest.skip("Could not fetch cobrancas")
        
        cobrancas = response.json()
        deleted = 0
        for cob in cobrancas:
            if cob.get("descricao", "").startswith("TEST_") and cob.get("status") == "PENDING":
                del_response = self.session.delete(f"{BASE_URL}/api/carteira/cobrancas/{cob['id']}")
                if del_response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test cobrancas")
    
    def test_cleanup_test_assinaturas(self):
        """Cleanup TEST_ prefixed assinaturas"""
        response = self.session.get(f"{BASE_URL}/api/carteira/assinaturas")
        if response.status_code != 200:
            pytest.skip("Could not fetch assinaturas")
        
        assinaturas = response.json()
        cancelled = 0
        for ass in assinaturas:
            if ass.get("descricao", "").startswith("TEST_") and ass.get("status") == "ACTIVE":
                cancel_response = self.session.post(f"{BASE_URL}/api/carteira/assinaturas/{ass['id']}/cancelar")
                if cancel_response.status_code == 200:
                    cancelled += 1
        
        print(f"✓ Cancelled {cancelled} test assinaturas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
