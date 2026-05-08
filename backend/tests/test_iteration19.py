"""
Test suite for Iteration 19 - Bug fixes verification
Tests:
1. Login admin with admin@mvno.com / admin123
2. CEP lookup via ViaCEP (client-side, tested via frontend)
3. Ativacoes page loads correctly (MockAdapter.ativar_chip restored)
4. Self-Service page loads correctly
5. API endpoint POST /api/operadora/sincronizar-estoque returns success=true
6. Chips page loads listing of chips
7. General navigation: Dashboard, Clientes, Planos, Chips, Ativacoes, Linhas
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test admin login functionality"""
    
    def test_admin_login_success(self):
        """Test login with admin@mvno.com / admin123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["email"] == "admin@mvno.com"
        assert data["role"] == "admin"
        print(f"Admin login successful: {data['name']}")


class TestOperadoraSync:
    """Test operadora synchronization endpoints"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_sincronizar_estoque_success(self, auth_cookies):
        """Test POST /api/operadora/sincronizar-estoque returns success=true"""
        response = auth_cookies.post(f"{BASE_URL}/api/operadora/sincronizar-estoque")
        assert response.status_code == 200, f"Sync failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Expected success=true, got: {data}"
        print(f"Estoque sync: {data.get('synced', 0)} updated, {data.get('created', 0)} created")
    
    def test_operadora_config(self, auth_cookies):
        """Test operadora config endpoint"""
        response = auth_cookies.get(f"{BASE_URL}/api/operadora/config")
        assert response.status_code == 200
        data = response.json()
        assert "mode" in data
        print(f"Operadora mode: {data.get('mode')}")


class TestChipsEndpoint:
    """Test chips listing endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_chips_list(self, auth_cookies):
        """Test GET /api/chips returns list of chips"""
        response = auth_cookies.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200, f"Chips list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of chips"
        print(f"Chips count: {len(data)}")
        if len(data) > 0:
            chip = data[0]
            assert "iccid" in chip
            assert "status" in chip
            print(f"First chip ICCID: {chip['iccid']}, status: {chip['status']}")
    
    def test_chips_filter_disponivel(self, auth_cookies):
        """Test GET /api/chips?status=disponivel"""
        response = auth_cookies.get(f"{BASE_URL}/api/chips?status=disponivel")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All chips should have status=disponivel
        for chip in data[:5]:  # Check first 5
            assert chip.get("status") == "disponivel", f"Expected disponivel, got {chip.get('status')}"
        print(f"Chips disponiveis: {len(data)}")


class TestClientesEndpoint:
    """Test clientes listing endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_clientes_list(self, auth_cookies):
        """Test GET /api/clientes returns list with linhas_count"""
        response = auth_cookies.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200, f"Clientes list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of clientes"
        print(f"Clientes count: {len(data)}")
        if len(data) > 0:
            cliente = data[0]
            assert "nome" in cliente
            assert "linhas_count" in cliente, "linhas_count field missing"
            assert "linhas" in cliente, "linhas field missing"
            print(f"First cliente: {cliente['nome']}, linhas_count: {cliente['linhas_count']}")


class TestPlanosEndpoint:
    """Test planos listing endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_planos_list(self, auth_cookies):
        """Test GET /api/planos returns list of planos"""
        response = auth_cookies.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200, f"Planos list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of planos"
        print(f"Planos count: {len(data)}")


class TestLinhasEndpoint:
    """Test linhas listing endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_linhas_list(self, auth_cookies):
        """Test GET /api/linhas returns list of linhas"""
        response = auth_cookies.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200, f"Linhas list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of linhas"
        print(f"Linhas count: {len(data)}")


class TestDashboardEndpoint:
    """Test dashboard stats endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_dashboard_stats(self, auth_cookies):
        """Test GET /api/dashboard/stats returns stats"""
        response = auth_cookies.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        assert "total_clientes" in data or "clientes" in data
        print(f"Dashboard stats: {data}")


class TestOfertasEndpoint:
    """Test ofertas listing endpoint"""
    
    @pytest.fixture
    def auth_cookies(self):
        """Get authentication cookies"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert response.status_code == 200
        return session
    
    def test_ofertas_list(self, auth_cookies):
        """Test GET /api/ofertas returns list of ofertas"""
        response = auth_cookies.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200, f"Ofertas list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of ofertas"
        print(f"Ofertas count: {len(data)}")


class TestPublicEndpoints:
    """Test public endpoints (no auth required)"""
    
    def test_public_validar_chip_invalid(self):
        """Test public chip validation with invalid ICCID"""
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/invalid123")
        # Should return 404 or 400 for invalid chip
        assert response.status_code in [400, 404], f"Expected 400/404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
