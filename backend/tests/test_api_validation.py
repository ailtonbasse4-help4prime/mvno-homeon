"""
Backend API validation tests for MVNO Manager
Tests login, dashboard stats, and key endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chip-manager-3.preview.emergentagent.com')

class TestAuthFlow:
    """Authentication flow tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a session for cookie persistence"""
        return requests.Session()
    
    def test_login_success(self, session):
        """Test login with valid credentials"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["email"] == "admin@mvno.com"
        assert data["role"] == "admin"
        print(f"✅ Login successful: {data['name']}")
    
    def test_get_me_authenticated(self, session):
        """Test /auth/me with authenticated session"""
        # First login
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        
        response = session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert data["email"] == "admin@mvno.com"
        print(f"✅ Auth/me works: {data['name']}")
    
    def test_logout(self, session):
        """Test logout"""
        # First login
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        
        response = session.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        print("✅ Logout successful")


class TestDashboardAndData:
    """Dashboard and data endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        return session
    
    def test_dashboard_stats(self, auth_session):
        """Test dashboard stats endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        assert "total_clientes" in data
        assert "total_chips" in data
        print(f"✅ Dashboard stats: {data['total_clientes']} clientes, {data['total_chips']} chips")
    
    def test_clientes_list(self, auth_session):
        """Test clientes list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Clientes list: {len(data)} clientes")
    
    def test_planos_list(self, auth_session):
        """Test planos list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Planos list: {len(data)} planos")
    
    def test_ofertas_list(self, auth_session):
        """Test ofertas list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Ofertas list: {len(data)} ofertas")
    
    def test_chips_list(self, auth_session):
        """Test chips list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Chips list: {len(data)} chips")
    
    def test_linhas_list(self, auth_session):
        """Test linhas list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Linhas list: {len(data)} linhas")
    
    def test_logs_list(self, auth_session):
        """Test logs list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/logs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Logs list: {len(data)} logs")
    
    def test_usuarios_list(self, auth_session):
        """Test usuarios list endpoint (admin only)"""
        response = auth_session.get(f"{BASE_URL}/api/usuarios")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Usuarios list: {len(data)} usuarios")


class TestCarteiraMovel:
    """Carteira Movel (financial) endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_session(self):
        """Create authenticated session"""
        session = requests.Session()
        session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        return session
    
    def test_carteira_config(self, auth_session):
        """Test carteira config endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/carteira/config")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Carteira config: {data}")
    
    def test_carteira_resumo(self, auth_session):
        """Test carteira resumo endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/carteira/resumo")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Carteira resumo: {data}")
    
    def test_cobrancas_list(self, auth_session):
        """Test cobrancas list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/cobrancas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Cobrancas list: {len(data)} cobrancas")
    
    def test_assinaturas_list(self, auth_session):
        """Test assinaturas list endpoint"""
        response = auth_session.get(f"{BASE_URL}/api/assinaturas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Assinaturas list: {len(data)} assinaturas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
