"""
Portal do Cliente API Tests
Tests for the customer portal login, dashboard, saldo, and consumo endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPortalLogin:
    """Portal login endpoint tests - POST /api/portal/login"""
    
    def test_portal_login_success_with_valid_credentials(self):
        """Test portal login with valid CPF and phone number"""
        # Test client: Adriano Pinto De Sousa
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493",
            "telefone": "5583999056284"
        })
        
        print(f"Portal login response status: {response.status_code}")
        print(f"Portal login response: {response.text[:500]}")
        
        # Should return 200 with token and cliente data
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain 'token'"
        assert "cliente" in data, "Response should contain 'cliente'"
        assert isinstance(data["token"], str), "Token should be a string"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Validate cliente data structure
        cliente = data["cliente"]
        assert "nome" in cliente, "Cliente should have 'nome'"
        assert "documento" in cliente, "Cliente should have 'documento'"
        assert cliente["documento"] == "02962261493", "Documento should match"
        
        print(f"Login successful for: {cliente['nome']}")
        return data["token"]
    
    def test_portal_login_alternative_client(self):
        """Test portal login with alternative test client"""
        # Alternative test client: Ailton Ferreira da Costa
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "28454877894",
            "telefone": "5519974112943"
        })
        
        print(f"Alternative client login status: {response.status_code}")
        print(f"Alternative client login response: {response.text[:500]}")
        
        # This may return 401 if the client doesn't have a matching line
        # We just verify the endpoint responds correctly
        assert response.status_code in [200, 401], f"Expected 200 or 401, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "cliente" in data
            print(f"Alternative login successful for: {data['cliente']['nome']}")
        else:
            print(f"Alternative client login failed (expected if no matching line): {response.json()}")
    
    def test_portal_login_invalid_cpf(self):
        """Test portal login with invalid CPF returns 401"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "00000000000",
            "telefone": "5511999999999"
        })
        
        print(f"Invalid CPF login status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 for invalid CPF, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have 'detail'"
        print(f"Invalid CPF error message: {data['detail']}")
    
    def test_portal_login_invalid_phone(self):
        """Test portal login with valid CPF but wrong phone returns 401"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493",  # Valid CPF
            "telefone": "5511000000000"  # Wrong phone
        })
        
        print(f"Invalid phone login status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 for wrong phone, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should have 'detail'"
        print(f"Invalid phone error message: {data['detail']}")
    
    def test_portal_login_missing_fields(self):
        """Test portal login with missing fields returns 422"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493"
            # Missing telefone
        })
        
        print(f"Missing fields login status: {response.status_code}")
        
        assert response.status_code == 422, f"Expected 422 for missing fields, got {response.status_code}"


class TestPortalDashboard:
    """Portal dashboard endpoint tests - GET /api/portal/dashboard"""
    
    @pytest.fixture
    def portal_token(self):
        """Get a valid portal token for testing"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493",
            "telefone": "5583999056284"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not obtain portal token - login failed")
    
    def test_portal_dashboard_with_valid_token(self, portal_token):
        """Test dashboard returns client data with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/portal/dashboard",
            headers={"Authorization": f"Bearer {portal_token}"}
        )
        
        print(f"Dashboard response status: {response.status_code}")
        print(f"Dashboard response: {response.text[:1000]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate response structure
        assert "cliente" in data, "Response should contain 'cliente'"
        assert "linhas" in data, "Response should contain 'linhas'"
        assert "cobrancas" in data, "Response should contain 'cobrancas'"
        
        # Validate cliente data
        cliente = data["cliente"]
        assert "nome" in cliente, "Cliente should have 'nome'"
        assert "documento" in cliente, "Cliente should have 'documento'"
        
        # Validate linhas is a list
        assert isinstance(data["linhas"], list), "Linhas should be a list"
        
        # Validate cobrancas is a list
        assert isinstance(data["cobrancas"], list), "Cobrancas should be a list"
        
        print(f"Dashboard loaded for: {cliente['nome']}")
        print(f"Number of linhas: {len(data['linhas'])}")
        print(f"Number of cobrancas: {len(data['cobrancas'])}")
        
        # If there are linhas, validate their structure
        if data["linhas"]:
            linha = data["linhas"][0]
            assert "id" in linha, "Linha should have 'id'"
            assert "numero" in linha, "Linha should have 'numero'"
            assert "status" in linha, "Linha should have 'status'"
            print(f"First linha: {linha['numero']} - {linha['status']}")
    
    def test_portal_dashboard_without_token(self):
        """Test dashboard returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/portal/dashboard")
        
        print(f"Dashboard without token status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
    
    def test_portal_dashboard_with_invalid_token(self):
        """Test dashboard returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/portal/dashboard",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        print(f"Dashboard with invalid token status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
    
    def test_portal_dashboard_with_admin_token_fails(self):
        """Test dashboard rejects admin tokens (type != portal)"""
        # First get an admin token
        admin_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        
        if admin_response.status_code != 200:
            pytest.skip("Could not get admin token")
        
        # Extract token from cookies
        admin_token = admin_response.cookies.get("access_token")
        if not admin_token:
            pytest.skip("Admin token not in cookies")
        
        # Try to use admin token on portal endpoint
        response = requests.get(
            f"{BASE_URL}/api/portal/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"Dashboard with admin token status: {response.status_code}")
        
        # Should fail because admin token has type="access", not type="portal"
        assert response.status_code == 401, f"Expected 401 with admin token, got {response.status_code}"


class TestPortalSaldo:
    """Portal saldo endpoint tests - GET /api/portal/saldo/{numero}"""
    
    @pytest.fixture
    def portal_token(self):
        """Get a valid portal token for testing"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493",
            "telefone": "5583999056284"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not obtain portal token - login failed")
    
    def test_portal_saldo_with_valid_token(self, portal_token):
        """Test saldo endpoint returns balance data"""
        # Use the test phone number
        numero = "5583999056284"
        
        response = requests.get(
            f"{BASE_URL}/api/portal/saldo/{numero}",
            headers={"Authorization": f"Bearer {portal_token}"}
        )
        
        print(f"Saldo response status: {response.status_code}")
        print(f"Saldo response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate response structure (may be mock data)
        assert "success" in data, "Response should contain 'success'"
        
        if data["success"]:
            assert "balance_mb" in data, "Successful response should have 'balance_mb'"
            print(f"Saldo: {data.get('balance_mb', 0)} MB")
        else:
            # Mock API may return success=False with message
            print(f"Saldo query returned: {data.get('message', 'No message')}")
    
    def test_portal_saldo_without_token(self):
        """Test saldo endpoint returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/portal/saldo/5583999056284")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"


class TestPortalConsumo:
    """Portal consumo endpoint tests - GET /api/portal/consumo/{numero}"""
    
    @pytest.fixture
    def portal_token(self):
        """Get a valid portal token for testing"""
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "documento": "02962261493",
            "telefone": "5583999056284"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Could not obtain portal token - login failed")
    
    def test_portal_consumo_with_valid_token(self, portal_token):
        """Test consumo endpoint returns consumption data"""
        numero = "5583999056284"
        
        response = requests.get(
            f"{BASE_URL}/api/portal/consumo/{numero}",
            headers={"Authorization": f"Bearer {portal_token}"}
        )
        
        print(f"Consumo response status: {response.status_code}")
        print(f"Consumo response: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Validate response structure (may be mock data)
        assert "success" in data, "Response should contain 'success'"
        
        if data["success"]:
            # Check for consumption fields
            print(f"Consumo dados: {data.get('consumo_dados_gb', 0)} GB")
            print(f"Consumo SMS: {data.get('consumo_sms', 0)}")
            print(f"Consumo minutos: {data.get('consumo_minutos', 0)}")
        else:
            print(f"Consumo query returned: {data.get('message', 'No message')}")
    
    def test_portal_consumo_without_token(self):
        """Test consumo endpoint returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/portal/consumo/5583999056284")
        
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
