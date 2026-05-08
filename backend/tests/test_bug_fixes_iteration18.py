"""
Test suite for Bug Fixes - Iteration 18
Tests for:
1. Clientes API returns linhas_count and linhas array
2. CPF search finds clients with multiple lines
3. Name search works
4. Asaas config persists in MongoDB
5. Carteira sync endpoint works
6. Portal dashboard shows cobrancas
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestClientesWithLinhas:
    """Tests for GET /api/clientes with linhas_count and linhas array"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
    
    def test_clientes_returns_linhas_count(self):
        """Test that GET /api/clientes returns linhas_count field"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        
        clients = response.json()
        assert isinstance(clients, list)
        assert len(clients) > 0
        
        # Check that all clients have linhas_count field
        for client in clients[:5]:  # Check first 5
            assert "linhas_count" in client, f"Client {client.get('nome')} missing linhas_count"
            assert isinstance(client["linhas_count"], int)
    
    def test_clientes_returns_linhas_array(self):
        """Test that GET /api/clientes returns linhas array"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        
        clients = response.json()
        for client in clients[:5]:
            assert "linhas" in client, f"Client {client.get('nome')} missing linhas array"
            assert isinstance(client["linhas"], list)
    
    def test_cpf_search_finds_ailton_with_3_lines(self):
        """Test CPF search 28454877894 finds Ailton with 3 lines"""
        response = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "28454877894"})
        assert response.status_code == 200
        
        clients = response.json()
        assert len(clients) == 1, f"Expected 1 client, got {len(clients)}"
        
        ailton = clients[0]
        assert "Ailton" in ailton["nome"], f"Expected Ailton, got {ailton['nome']}"
        assert ailton["linhas_count"] == 3, f"Expected 3 lines, got {ailton['linhas_count']}"
        assert len(ailton["linhas"]) == 3, f"Expected 3 linhas items, got {len(ailton['linhas'])}"
        
        # Verify line data structure
        for linha in ailton["linhas"]:
            assert "numero" in linha
            assert "status" in linha
            assert linha["numero"], "Line numero should not be empty"
    
    def test_name_search_finds_ailton(self):
        """Test name search 'ailton' finds the client"""
        response = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "ailton"})
        assert response.status_code == 200
        
        clients = response.json()
        assert len(clients) == 1, f"Expected 1 client, got {len(clients)}"
        assert "Ailton" in clients[0]["nome"]
    
    def test_partial_cpf_search(self):
        """Test partial CPF search works"""
        response = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "28454"})
        assert response.status_code == 200
        
        clients = response.json()
        assert len(clients) >= 1, "Should find at least 1 client with partial CPF"
    
    def test_client_with_multiple_lines_shows_all(self):
        """Test that clients with multiple lines show all lines in response"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        
        clients = response.json()
        
        # Find clients with multiple lines
        multi_line_clients = [c for c in clients if c.get("linhas_count", 0) > 1]
        
        for client in multi_line_clients[:3]:  # Check first 3
            assert len(client["linhas"]) == client["linhas_count"], \
                f"Client {client['nome']}: linhas array length ({len(client['linhas'])}) != linhas_count ({client['linhas_count']})"


class TestAsaasConfigPersistence:
    """Tests for Asaas config persistence in MongoDB"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_asaas_config_status(self):
        """Test GET /api/carteira/config returns config status"""
        response = self.session.get(f"{BASE_URL}/api/carteira/config")
        assert response.status_code == 200
        
        config = response.json()
        assert "configured" in config
        assert "environment" in config
        assert "base_url" in config
        
        # Verify Asaas is configured
        assert config["configured"] == True, "Asaas should be configured"
        assert config["environment"] in ["sandbox", "production"]


class TestCarteiraSyncEndpoint:
    """Tests for POST /api/carteira/sincronizar-status"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_sync_cobrancas_status_endpoint(self):
        """Test POST /api/carteira/sincronizar-status works for admin"""
        response = self.session.post(f"{BASE_URL}/api/carteira/sincronizar-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_checked" in data
        assert "updated" in data
        assert "errors" in data
        assert isinstance(data["errors"], list)


class TestPortalDashboard:
    """Tests for Portal dashboard with cobrancas"""
    
    def test_portal_login_and_dashboard(self):
        """Test portal login and dashboard shows linhas and cobrancas"""
        session = requests.Session()
        
        # Login to portal with Ailton's credentials
        login_response = session.post(
            f"{BASE_URL}/api/portal/login",
            json={"documento": "28454877894", "telefone": "5519974112943"}
        )
        assert login_response.status_code == 200
        
        login_data = login_response.json()
        assert "token" in login_data
        assert "cliente" in login_data
        assert "Ailton" in login_data["cliente"]["nome"]
        
        token = login_data["token"]
        
        # Get dashboard
        dashboard_response = session.get(
            f"{BASE_URL}/api/portal/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert dashboard_response.status_code == 200
        
        dashboard = dashboard_response.json()
        assert "cliente" in dashboard
        assert "linhas" in dashboard
        assert "cobrancas" in dashboard
        
        # Verify Ailton has 3 lines
        assert len(dashboard["linhas"]) == 3, f"Expected 3 lines, got {len(dashboard['linhas'])}"


class TestOtherPagesLoad:
    """Tests to verify other pages/endpoints still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth cookies"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert login_response.status_code == 200
    
    def test_chips_endpoint(self):
        """Test GET /api/chips works"""
        response = self.session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_linhas_endpoint(self):
        """Test GET /api/linhas works"""
        response = self.session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_planos_endpoint(self):
        """Test GET /api/planos works"""
        response = self.session.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_ofertas_endpoint(self):
        """Test GET /api/ofertas works"""
        response = self.session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
