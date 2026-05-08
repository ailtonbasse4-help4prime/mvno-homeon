"""
MVNO API Tests - Planos vs Ofertas Architecture
Tests for the restructured MVNO system with technical plans (Planos) and commercial offers (Ofertas)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://chip-manager-3.preview.emergentagent.com')

class TestAuth:
    """Authentication endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["email"] == "admin@mvno.com"
        assert data["role"] == "admin"
        assert data["name"] == "Administrador"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@mvno.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
    
    def test_auth_me_after_login(self):
        """Test /auth/me returns user data after login"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        
        # Check /auth/me
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        data = me_response.json()
        assert data["email"] == "admin@mvno.com"


class TestDashboard:
    """Dashboard stats tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_dashboard_stats(self):
        """Test dashboard stats includes ofertas"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "clientes" in data
        assert "chips" in data
        assert "linhas" in data
        assert "planos" in data
        assert "ofertas" in data  # New field for offers
        
        # Verify ofertas stats
        assert "total" in data["ofertas"]
        assert "ativas" in data["ofertas"]
        assert data["ofertas"]["total"] >= 0
        assert data["ofertas"]["ativas"] >= 0


class TestPlanos:
    """Technical Plans CRUD tests - no price field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_list_planos(self):
        """Test listing technical plans"""
        response = self.session.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            plano = data[0]
            # Verify plano structure - no valor field
            assert "id" in plano
            assert "nome" in plano
            assert "franquia" in plano
            assert "valor" not in plano  # Plans should NOT have price
    
    def test_create_plano_no_valor(self):
        """Test creating a technical plan without valor field"""
        response = self.session.post(f"{BASE_URL}/api/planos", json={
            "nome": "TEST_Plano 100GB",
            "franquia": "100GB",
            "descricao": "Plano de teste"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nome"] == "TEST_Plano 100GB"
        assert data["franquia"] == "100GB"
        assert "valor" not in data  # No price in technical plan
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/planos/{data['id']}")
    
    def test_update_plano(self):
        """Test updating a technical plan"""
        # Create first
        create_response = self.session.post(f"{BASE_URL}/api/planos", json={
            "nome": "TEST_Plano Update",
            "franquia": "15GB",
            "descricao": "Original"
        })
        assert create_response.status_code == 200
        plano_id = create_response.json()["id"]
        
        # Update
        update_response = self.session.put(f"{BASE_URL}/api/planos/{plano_id}", json={
            "nome": "TEST_Plano Updated",
            "franquia": "25GB",
            "descricao": "Updated"
        })
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["nome"] == "TEST_Plano Updated"
        assert data["franquia"] == "25GB"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/planos/{plano_id}")


class TestOfertas:
    """Commercial Offers CRUD tests - with price and linked plan"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_list_ofertas(self):
        """Test listing commercial offers"""
        response = self.session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            oferta = data[0]
            # Verify oferta structure
            assert "id" in oferta
            assert "nome" in oferta
            assert "plano_id" in oferta
            assert "valor" in oferta  # Offers MUST have price
            assert "plano_nome" in oferta  # Linked plan name
            assert "franquia" in oferta  # Linked plan franquia
            assert "ativo" in oferta
    
    def test_ofertas_have_plano_info(self):
        """Test that offers include linked plan information"""
        response = self.session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        data = response.json()
        
        for oferta in data:
            assert oferta.get("plano_nome") is not None, f"Oferta {oferta['nome']} missing plano_nome"
            assert oferta.get("franquia") is not None, f"Oferta {oferta['nome']} missing franquia"
    
    def test_create_oferta_with_plano(self):
        """Test creating an offer linked to a plan"""
        # Get a plan first
        planos_response = self.session.get(f"{BASE_URL}/api/planos")
        planos = planos_response.json()
        assert len(planos) > 0, "No plans available for testing"
        plano_id = planos[0]["id"]
        
        # Create offer
        response = self.session.post(f"{BASE_URL}/api/ofertas", json={
            "nome": "TEST_Oferta Especial",
            "plano_id": plano_id,
            "valor": 99.90,
            "descricao": "Oferta de teste",
            "ativo": True
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nome"] == "TEST_Oferta Especial"
        assert data["plano_id"] == plano_id
        assert data["valor"] == 99.90
        assert data["ativo"] == True
        assert data["plano_nome"] is not None
        assert data["franquia"] is not None
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/ofertas/{data['id']}")
    
    def test_create_oferta_invalid_plano(self):
        """Test creating an offer with invalid plan ID"""
        response = self.session.post(f"{BASE_URL}/api/ofertas", json={
            "nome": "TEST_Oferta Invalid",
            "plano_id": "000000000000000000000000",  # Invalid ID
            "valor": 50.00,
            "ativo": True
        })
        assert response.status_code == 400


class TestChips:
    """Chips tests - linked to offers"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_list_chips(self):
        """Test listing chips with offer info"""
        response = self.session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            chip = data[0]
            # Verify chip structure
            assert "id" in chip
            assert "iccid" in chip
            assert "status" in chip
            assert "oferta_id" in chip  # Linked to offer
            assert "oferta_nome" in chip
            assert "plano_nome" in chip
            assert "franquia" in chip
            assert "valor" in chip
    
    def test_create_chip_requires_oferta(self):
        """Test that creating a chip requires an offer"""
        # Get an offer first
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas")
        ofertas = ofertas_response.json()
        assert len(ofertas) > 0, "No offers available for testing"
        oferta_id = ofertas[0]["id"]
        
        # Create chip with offer
        response = self.session.post(f"{BASE_URL}/api/chips", json={
            "iccid": "8955010099999999999",
            "oferta_id": oferta_id
        })
        assert response.status_code == 200
        data = response.json()
        assert data["iccid"] == "8955010099999999999"
        assert data["oferta_id"] == oferta_id
        assert data["status"] == "disponivel"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/chips/{data['id']}")
    
    def test_create_chip_invalid_oferta(self):
        """Test creating a chip with invalid offer ID"""
        response = self.session.post(f"{BASE_URL}/api/chips", json={
            "iccid": "8955010088888888888",
            "oferta_id": "000000000000000000000000"  # Invalid ID
        })
        assert response.status_code == 400


class TestAtivacao:
    """Activation tests - no manual plan selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_ativacao_only_requires_cliente_and_chip(self):
        """Test that activation only requires cliente_id and chip_id (no plano_id)"""
        # Get a client
        clientes_response = self.session.get(f"{BASE_URL}/api/clientes")
        clientes = [c for c in clientes_response.json() if c["status"] == "ativo"]
        assert len(clientes) > 0, "No active clients available"
        cliente_id = clientes[0]["id"]
        
        # Get an available chip
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        chips = chips_response.json()
        assert len(chips) > 0, "No available chips"
        chip_id = chips[0]["id"]
        
        # Activate - only cliente_id and chip_id required
        response = self.session.post(f"{BASE_URL}/api/ativacao", json={
            "cliente_id": cliente_id,
            "chip_id": chip_id
            # NO plano_id - should be auto-detected from chip's offer
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify response includes offer/plan info
        assert data["success"] == True
        assert "oferta_nome" in data
        assert "plano_nome" in data
        assert "franquia" in data
        assert "valor" in data
    
    def test_ativacao_returns_offer_info(self):
        """Test that activation response includes offer and plan information"""
        # Get a client
        clientes_response = self.session.get(f"{BASE_URL}/api/clientes")
        clientes = [c for c in clientes_response.json() if c["status"] == "ativo"]
        if len(clientes) == 0:
            pytest.skip("No active clients available")
        cliente_id = clientes[0]["id"]
        
        # Get an available chip
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        chips = chips_response.json()
        if len(chips) == 0:
            pytest.skip("No available chips")
        chip = chips[0]
        
        # Activate
        response = self.session.post(f"{BASE_URL}/api/ativacao", json={
            "cliente_id": cliente_id,
            "chip_id": chip["id"]
        })
        
        if response.status_code == 200:
            data = response.json()
            # Verify offer info is returned
            assert data.get("oferta_nome") is not None
            assert data.get("plano_nome") is not None
            assert data.get("franquia") is not None
            assert data.get("valor") is not None


class TestClientes:
    """Client CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_list_clientes(self):
        """Test listing clients"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_cliente(self):
        """Test creating a client"""
        response = self.session.post(f"{BASE_URL}/api/clientes", json={
            "nome": "TEST_Cliente Teste",
            "cpf": "999.888.777-66",
            "telefone": "(11) 99999-8888",
            "status": "ativo"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["nome"] == "TEST_Cliente Teste"
        assert data["cpf"] == "999.888.777-66"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/clientes/{data['id']}")


class TestLinhas:
    """Lines tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login
        self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
    
    def test_list_linhas(self):
        """Test listing lines"""
        response = self.session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
