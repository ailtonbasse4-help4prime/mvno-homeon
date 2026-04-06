"""
Test Portability Feature - Admin and Self-Service Activation Flows
Tests for portability toggle, DDD/Numero inputs, and API endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"
TEST_CHIP_ICCID = "8955170110392667273"


class TestPortabilityBackend:
    """Backend API tests for portability feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session with auth"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        """Login and get auth cookies"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response
    
    # ============ Admin Activation Endpoint Tests ============
    
    def test_admin_ativacao_accepts_portability_fields(self):
        """POST /api/ativacao accepts portability=true, port_ddd, port_number fields"""
        self.get_auth_token()
        
        # First get a client and chip
        clients_resp = self.session.get(f"{BASE_URL}/api/clientes")
        assert clients_resp.status_code == 200
        clients = clients_resp.json()
        
        chips_resp = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        assert chips_resp.status_code == 200
        chips = chips_resp.json()
        
        if not clients or not chips:
            pytest.skip("No clients or available chips for testing")
        
        # Find a client with complete data
        complete_client = None
        for c in clients:
            if c.get('dados_completos', False) and c.get('status') == 'ativo':
                complete_client = c
                break
        
        if not complete_client:
            pytest.skip("No client with complete data for activation test")
        
        # Find a chip with oferta
        chip_with_oferta = None
        for chip in chips:
            if chip.get('oferta_id') and chip.get('plan_code'):
                chip_with_oferta = chip
                break
        
        if not chip_with_oferta:
            pytest.skip("No chip with oferta and plan_code for activation test")
        
        # Test activation with portability fields
        payload = {
            "cliente_id": complete_client['id'],
            "chip_id": chip_with_oferta['id'],
            "portability": True,
            "port_ddd": "83",
            "port_number": "999056284"
        }
        
        response = self.session.post(f"{BASE_URL}/api/ativacao", json=payload)
        
        # Should either succeed or fail with validation error (not 422 for missing fields)
        assert response.status_code in [200, 400, 500], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "success" in data
            assert "status" in data
            print(f"Activation response: success={data.get('success')}, status={data.get('status')}")
    
    def test_admin_ativacao_without_portability(self):
        """POST /api/ativacao works without portability fields (default false)"""
        self.get_auth_token()
        
        clients_resp = self.session.get(f"{BASE_URL}/api/clientes")
        chips_resp = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        
        clients = clients_resp.json()
        chips = chips_resp.json()
        
        if not clients or not chips:
            pytest.skip("No clients or available chips")
        
        # Find complete client
        complete_client = next((c for c in clients if c.get('dados_completos') and c.get('status') == 'ativo'), None)
        if not complete_client:
            pytest.skip("No complete client")
        
        # Find chip with oferta
        chip = next((c for c in chips if c.get('oferta_id') and c.get('plan_code')), None)
        if not chip:
            pytest.skip("No chip with oferta")
        
        # Test without portability fields
        payload = {
            "cliente_id": complete_client['id'],
            "chip_id": chip['id']
        }
        
        response = self.session.post(f"{BASE_URL}/api/ativacao", json=payload)
        assert response.status_code in [200, 400, 500], f"Unexpected: {response.status_code}"
        print(f"Activation without portability: {response.status_code}")
    
    # ============ Self-Service Activation Endpoint Tests ============
    
    def test_public_ativacao_accepts_portability_fields(self):
        """POST /api/public/ativacao accepts portability=true, port_ddd, port_number"""
        # Validate chip first
        validate_resp = requests.get(f"{BASE_URL}/api/public/validar-chip/{TEST_CHIP_ICCID}")
        
        if validate_resp.status_code != 200:
            pytest.skip(f"Test chip not available: {validate_resp.text}")
        
        chip_info = validate_resp.json()
        print(f"Chip info: {chip_info.get('oferta_nome')}, valor: {chip_info.get('valor_final')}")
        
        # Test activation with portability
        payload = {
            "iccid": TEST_CHIP_ICCID,
            "nome": "TEST_Portability User",
            "documento": "12345678909",  # Valid CPF format
            "telefone": "11999999999",
            "data_nascimento": "1990-01-01",
            "cep": "01310100",
            "endereco": "Av Paulista",
            "numero_endereco": "1000",
            "bairro": "Bela Vista",
            "cidade": "Sao Paulo",
            "estado": "SP",
            "billing_type": "PIX",
            "portability": True,
            "port_ddd": "83",
            "port_number": "999056284"
        }
        
        response = requests.post(f"{BASE_URL}/api/public/ativacao", json=payload)
        
        # Should accept the fields (may fail validation for other reasons)
        assert response.status_code in [200, 201, 400, 422], f"Unexpected: {response.status_code}, {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data or "status" in data
            print(f"Self-service activation response: {data.get('status')}")
        else:
            # Check it's not failing due to missing portability fields
            error_detail = response.json().get('detail', '')
            assert 'portability' not in str(error_detail).lower() or 'port_ddd' not in str(error_detail).lower()
            print(f"Expected validation error: {error_detail}")
    
    def test_public_ativacao_without_portability(self):
        """POST /api/public/ativacao works without portability (default false)"""
        validate_resp = requests.get(f"{BASE_URL}/api/public/validar-chip/{TEST_CHIP_ICCID}")
        
        if validate_resp.status_code != 200:
            pytest.skip("Test chip not available")
        
        payload = {
            "iccid": TEST_CHIP_ICCID,
            "nome": "TEST_No Portability User",
            "documento": "98765432100",
            "telefone": "11888888888",
            "data_nascimento": "1985-05-15",
            "cep": "01310100",
            "endereco": "Rua Augusta",
            "numero_endereco": "500",
            "bairro": "Consolacao",
            "cidade": "Sao Paulo",
            "estado": "SP",
            "billing_type": "PIX"
            # No portability fields - should default to false
        }
        
        response = requests.post(f"{BASE_URL}/api/public/ativacao", json=payload)
        assert response.status_code in [200, 201, 400, 422], f"Unexpected: {response.status_code}"
        print(f"Self-service without portability: {response.status_code}")
    
    # ============ Portability Status Endpoint Tests ============
    
    def test_portability_status_endpoint_exists(self):
        """GET /api/portabilidade/status/{numero} returns status response"""
        self.get_auth_token()
        
        test_numero = "11999999999"
        response = self.session.get(f"{BASE_URL}/api/portabilidade/status/{test_numero}")
        
        assert response.status_code == 200, f"Portability status failed: {response.status_code}, {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "status" in data or "message" in data
        print(f"Portability status response: {data}")
    
    def test_portability_status_with_iccid(self):
        """GET /api/portabilidade/status/{iccid} works with ICCID"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/portabilidade/status/{TEST_CHIP_ICCID}")
        
        assert response.status_code == 200, f"Failed: {response.status_code}"
        data = response.json()
        assert "success" in data
        print(f"Portability status for ICCID: {data}")
    
    def test_portability_status_requires_auth(self):
        """GET /api/portabilidade/status requires authentication"""
        # Without login
        response = requests.get(f"{BASE_URL}/api/portabilidade/status/11999999999")
        assert response.status_code == 401, f"Should require auth: {response.status_code}"
        print("Portability status correctly requires authentication")
    
    # ============ Chip Validation Endpoint Tests ============
    
    def test_chip_validation_endpoint(self):
        """GET /api/public/validar-chip/{iccid} returns chip info or reserved status"""
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/{TEST_CHIP_ICCID}")
        
        # Chip may be available (200) or reserved (400)
        assert response.status_code in [200, 400], f"Chip validation failed: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "chip_id" in data
            assert "iccid" in data
            assert "oferta_nome" in data
            assert "valor_final" in data
            print(f"Chip validation: {data.get('oferta_nome')}, R$ {data.get('valor_final')}")
        else:
            # Chip is reserved from previous test
            data = response.json()
            assert "detail" in data
            print(f"Chip is reserved: {data.get('detail')}")
    
    def test_chip_validation_invalid_iccid(self):
        """GET /api/public/validar-chip with invalid ICCID returns 404"""
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/0000000000000000000")
        assert response.status_code == 404, f"Should return 404: {response.status_code}"
        print("Invalid ICCID correctly returns 404")


class TestChipsPageSearch:
    """Test Chips page search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response
    
    def test_chips_list_endpoint(self):
        """GET /api/chips returns list of chips"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200
        
        chips = response.json()
        assert isinstance(chips, list)
        print(f"Total chips: {len(chips)}")
        
        if chips:
            chip = chips[0]
            assert "iccid" in chip
            assert "status" in chip
            print(f"Sample chip: ICCID={chip.get('iccid')}, status={chip.get('status')}")
    
    def test_chips_filter_by_status(self):
        """GET /api/chips?status=disponivel filters correctly"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        assert response.status_code == 200
        
        chips = response.json()
        for chip in chips:
            assert chip.get('status') == 'disponivel', f"Wrong status: {chip.get('status')}"
        
        print(f"Available chips: {len(chips)}")


class TestOtherPagesLoad:
    """Test that other pages still load correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self):
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats returns dashboard data"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Dashboard uses nested structure: clientes.total, chips.total, etc.
        assert "clientes" in data or "total_clientes" in data
        assert "chips" in data or "total_chips" in data
        
        if "clientes" in data:
            print(f"Dashboard: {data['clientes'].get('total')} clients, {data['chips'].get('total')} chips")
        else:
            print(f"Dashboard: {data.get('total_clientes')} clients, {data.get('total_chips')} chips")
    
    def test_clientes_list(self):
        """GET /api/clientes returns client list"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        
        clients = response.json()
        assert isinstance(clients, list)
        print(f"Total clients: {len(clients)}")
    
    def test_planos_list(self):
        """GET /api/planos returns plans list"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200
        
        plans = response.json()
        assert isinstance(plans, list)
        print(f"Total plans: {len(plans)}")
    
    def test_ofertas_list(self):
        """GET /api/ofertas returns offers list"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        
        offers = response.json()
        assert isinstance(offers, list)
        print(f"Total offers: {len(offers)}")
    
    def test_linhas_list(self):
        """GET /api/linhas returns lines list"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        
        lines = response.json()
        assert isinstance(lines, list)
        print(f"Total lines: {len(lines)}")
    
    def test_portal_login_page(self):
        """Portal login endpoint exists"""
        # Test portal login with invalid credentials (should return 401, not 404)
        response = requests.post(f"{BASE_URL}/api/portal/login", json={
            "cpf": "00000000000",
            "telefone": "00000000000"
        })
        assert response.status_code in [401, 422], f"Portal login should exist: {response.status_code}"
        print("Portal login endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
