"""
Test Suite for MVNO Ta Telecom Integration
Tests all new endpoints and features:
- Expanded client model (tipo_pessoa, documento, data_nascimento, address fields, dados_completos)
- Plans with plan_code
- Chips with msisdn
- Operator sync endpoints
- Line action endpoints (bloquear-parcial, bloquear-total, desbloquear, alterar-plano, consultar)
- CPF/CNPJ/CEP validation
- Client data completeness check before activation
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"

# Valid CPFs for testing (from seed data)
VALID_CPFS = ["52998224725", "11144477735", "35379838867"]
INVALID_CPF = "12345678900"
VALID_CNPJ = "11222333000181"
INVALID_CNPJ = "11222333000100"


class TestSession:
    """Shared session with authentication"""
    session = None
    
    @classmethod
    def get_session(cls):
        if cls.session is None:
            cls.session = requests.Session()
            cls.session.headers.update({"Content-Type": "application/json"})
        return cls.session


@pytest.fixture(scope="module")
def auth_session():
    """Authenticated session fixture"""
    session = TestSession.get_session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return session


# ==================== AUTH TESTS ====================
class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        # Check httpOnly cookie is set
        assert "access_token" in session.cookies
        print(f"✓ Login successful: {data['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")


# ==================== CLIENTS TESTS ====================
class TestClients:
    """Client CRUD tests with expanded fields"""
    
    def test_get_clients_returns_expanded_fields(self, auth_session):
        """GET /api/clientes returns clients with expanded fields"""
        response = auth_session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        clients = response.json()
        assert len(clients) > 0, "Should have seed clients"
        
        # Check expanded fields exist
        client = clients[0]
        required_fields = ["id", "nome", "tipo_pessoa", "documento", "telefone", 
                          "data_nascimento", "cep", "endereco", "numero_endereco",
                          "bairro", "cidade", "estado", "city_code", "dados_completos", "status"]
        for field in required_fields:
            assert field in client, f"Missing field: {field}"
        
        print(f"✓ GET /api/clientes returns {len(clients)} clients with expanded fields")
        print(f"  Sample client: tipo_pessoa={client['tipo_pessoa']}, dados_completos={client['dados_completos']}")
    
    def test_create_client_validates_cpf(self, auth_session):
        """POST /api/clientes validates CPF"""
        # Invalid CPF should be rejected
        response = auth_session.post(f"{BASE_URL}/api/clientes", json={
            "nome": "TEST_Invalid CPF",
            "tipo_pessoa": "pf",
            "documento": INVALID_CPF,
            "telefone": "11999999999"
        })
        assert response.status_code == 400
        assert "CPF invalido" in response.json().get("detail", "")
        print("✓ Invalid CPF rejected correctly")
    
    def test_create_client_validates_cnpj(self, auth_session):
        """POST /api/clientes validates CNPJ"""
        # Invalid CNPJ should be rejected
        response = auth_session.post(f"{BASE_URL}/api/clientes", json={
            "nome": "TEST_Invalid CNPJ",
            "tipo_pessoa": "pj",
            "documento": INVALID_CNPJ,
            "telefone": "11999999999"
        })
        assert response.status_code == 400
        assert "CNPJ invalido" in response.json().get("detail", "")
        print("✓ Invalid CNPJ rejected correctly")
    
    def test_create_client_validates_cep(self, auth_session):
        """POST /api/clientes validates CEP format"""
        # Invalid CEP (not 8 digits) should be rejected
        response = auth_session.post(f"{BASE_URL}/api/clientes", json={
            "nome": "TEST_Invalid CEP",
            "tipo_pessoa": "pf",
            "documento": "82178537030",  # Valid CPF
            "telefone": "11999999999",
            "cep": "1234"  # Invalid - not 8 digits
        })
        assert response.status_code == 400
        assert "CEP invalido" in response.json().get("detail", "")
        print("✓ Invalid CEP rejected correctly")
    
    def test_create_and_update_client_with_expanded_fields(self, auth_session):
        """Create and update client with all expanded fields"""
        # Create client with all fields
        create_payload = {
            "nome": "TEST_Full Client",
            "tipo_pessoa": "pf",
            "documento": "45532206015",  # Valid CPF
            "telefone": "11987654321",
            "data_nascimento": "1990-01-15",
            "cep": "01310100",
            "endereco": "Av Paulista",
            "numero_endereco": "1000",
            "bairro": "Bela Vista",
            "cidade": "Sao Paulo",
            "estado": "SP",
            "city_code": "3550308",
            "complemento": "Sala 101",
            "status": "ativo"
        }
        
        response = auth_session.post(f"{BASE_URL}/api/clientes", json=create_payload)
        assert response.status_code == 200, f"Create failed: {response.text}"
        created = response.json()
        client_id = created["id"]
        
        # Verify all fields
        assert created["nome"] == create_payload["nome"]
        assert created["tipo_pessoa"] == "pf"
        assert created["data_nascimento"] == "1990-01-15"
        assert created["cep"] == "01310100"
        assert created["numero_endereco"] == "1000"
        assert created["dados_completos"] == True  # All required fields present
        print(f"✓ Created client with all expanded fields, dados_completos={created['dados_completos']}")
        
        # Update client
        update_payload = {**create_payload, "nome": "TEST_Updated Client", "bairro": "Centro"}
        response = auth_session.put(f"{BASE_URL}/api/clientes/{client_id}", json=update_payload)
        assert response.status_code == 200
        updated = response.json()
        assert updated["nome"] == "TEST_Updated Client"
        assert updated["bairro"] == "Centro"
        print("✓ Updated client with expanded fields")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/clientes/{client_id}")


# ==================== PLANS TESTS ====================
class TestPlans:
    """Plan tests with plan_code"""
    
    def test_get_plans_returns_plan_code(self, auth_session):
        """GET /api/planos returns plans with plan_code field"""
        response = auth_session.get(f"{BASE_URL}/api/planos")
        assert response.status_code == 200
        plans = response.json()
        assert len(plans) > 0, "Should have seed plans"
        
        # Check plan_code field exists
        plan = plans[0]
        assert "plan_code" in plan, "Missing plan_code field"
        assert plan["plan_code"] is not None, "plan_code should not be null for seed data"
        print(f"✓ GET /api/planos returns {len(plans)} plans with plan_code")
        print(f"  Sample plan: {plan['nome']} - plan_code={plan['plan_code']}")
    
    def test_create_plan_with_plan_code(self, auth_session):
        """POST /api/planos accepts plan_code"""
        response = auth_session.post(f"{BASE_URL}/api/planos", json={
            "nome": "TEST_Plan with Code",
            "franquia": "15GB",
            "descricao": "Test plan",
            "plan_code": "TEST_PLAN_15GB"
        })
        assert response.status_code == 200
        plan = response.json()
        assert plan["plan_code"] == "TEST_PLAN_15GB"
        print(f"✓ Created plan with plan_code={plan['plan_code']}")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/planos/{plan['id']}")


# ==================== OFFERS TESTS ====================
class TestOffers:
    """Offer tests with plan_code from linked plan"""
    
    def test_get_offers_returns_plan_code(self, auth_session):
        """GET /api/ofertas returns offers with plan_code from linked plan"""
        response = auth_session.get(f"{BASE_URL}/api/ofertas")
        assert response.status_code == 200
        offers = response.json()
        assert len(offers) > 0, "Should have seed offers"
        
        # Check plan_code field exists (from linked plan)
        offer = offers[0]
        assert "plan_code" in offer, "Missing plan_code field"
        assert "plano_nome" in offer, "Missing plano_nome field"
        assert "franquia" in offer, "Missing franquia field"
        print(f"✓ GET /api/ofertas returns {len(offers)} offers with plan_code")
        print(f"  Sample offer: {offer['nome']} - plan_code={offer.get('plan_code')}")


# ==================== CHIPS TESTS ====================
class TestChips:
    """Chip tests with msisdn field"""
    
    def test_get_chips_returns_msisdn(self, auth_session):
        """GET /api/chips returns chips with msisdn field"""
        response = auth_session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200
        chips = response.json()
        assert len(chips) > 0, "Should have seed chips"
        
        # Check msisdn field exists
        chip = chips[0]
        assert "msisdn" in chip, "Missing msisdn field"
        print(f"✓ GET /api/chips returns {len(chips)} chips with msisdn field")
        print(f"  Sample chip: ICCID={chip['iccid']}, msisdn={chip.get('msisdn')}")


# ==================== OPERATOR SYNC TESTS ====================
class TestOperatorSync:
    """Operator synchronization tests (mock mode)"""
    
    def test_sync_plans_from_operator(self, auth_session):
        """POST /api/operadora/sincronizar-planos syncs plans from operator"""
        response = auth_session.post(f"{BASE_URL}/api/operadora/sincronizar-planos")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "synced" in data or "created" in data
        print(f"✓ Sync plans: {data['message']}")
    
    def test_sync_stock_from_operator(self, auth_session):
        """POST /api/operadora/sincronizar-estoque syncs stock from operator"""
        response = auth_session.post(f"{BASE_URL}/api/operadora/sincronizar-estoque")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ Sync stock: {data['message']}")
    
    def test_get_block_reasons(self, auth_session):
        """GET /api/operadora/motivos-bloqueio returns 5 block reasons"""
        response = auth_session.get(f"{BASE_URL}/api/operadora/motivos-bloqueio")
        assert response.status_code == 200
        data = response.json()
        assert "reasons" in data
        reasons = data["reasons"]
        assert len(reasons) == 5, f"Expected 5 block reasons, got {len(reasons)}"
        
        # Verify expected reasons
        reason_codes = [r["code"] for r in reasons]
        assert 1 in reason_codes  # Roubo
        assert 2 in reason_codes  # Perda
        assert 3 in reason_codes  # Uso indevido
        assert 4 in reason_codes  # Inadimplencia
        assert 5 in reason_codes  # Suspensao temporaria
        print(f"✓ GET /api/operadora/motivos-bloqueio returns 5 reasons: {[r['label'] for r in reasons]}")


# ==================== ACTIVATION TESTS ====================
class TestActivation:
    """Activation tests with data completeness validation"""
    
    def test_activation_validates_client_completeness(self, auth_session):
        """POST /api/ativacao validates client data completeness"""
        # Create incomplete client (missing required fields)
        response = auth_session.post(f"{BASE_URL}/api/clientes", json={
            "nome": "TEST_Incomplete Client",
            "tipo_pessoa": "pf",
            "documento": "67893254092",  # Valid CPF
            "telefone": "11999999999"
            # Missing: data_nascimento, cep, numero_endereco
        })
        assert response.status_code == 200
        incomplete_client = response.json()
        assert incomplete_client["dados_completos"] == False
        
        # Get an available chip
        chips_response = auth_session.get(f"{BASE_URL}/api/chips?status=disponivel")
        chips = chips_response.json()
        if len(chips) == 0:
            pytest.skip("No available chips for testing")
        
        chip = chips[0]
        
        # Try to activate - should fail due to incomplete data
        response = auth_session.post(f"{BASE_URL}/api/ativacao", json={
            "cliente_id": incomplete_client["id"],
            "chip_id": chip["id"]
        })
        assert response.status_code == 400
        assert "Dados incompletos" in response.json().get("detail", "")
        print("✓ Activation rejected for incomplete client data")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/clientes/{incomplete_client['id']}")
    
    def test_activation_validates_plan_code(self, auth_session):
        """POST /api/ativacao validates plan_code exists on the linked plan"""
        # Get a complete client
        clients_response = auth_session.get(f"{BASE_URL}/api/clientes")
        clients = [c for c in clients_response.json() if c.get("dados_completos")]
        if len(clients) == 0:
            pytest.skip("No complete clients for testing")
        
        client = clients[0]
        
        # Create a plan without plan_code
        plan_response = auth_session.post(f"{BASE_URL}/api/planos", json={
            "nome": "TEST_Plan No Code",
            "franquia": "5GB",
            "plan_code": None  # No plan_code
        })
        plan = plan_response.json()
        
        # Create an offer linked to this plan
        offer_response = auth_session.post(f"{BASE_URL}/api/ofertas", json={
            "nome": "TEST_Offer No Code",
            "plano_id": plan["id"],
            "valor": 29.90,
            "ativo": True
        })
        offer = offer_response.json()
        
        # Create a chip linked to this offer
        chip_response = auth_session.post(f"{BASE_URL}/api/chips", json={
            "iccid": "8955010099999999999",
            "oferta_id": offer["id"]
        })
        chip = chip_response.json()
        
        # Try to activate - should fail due to missing plan_code
        response = auth_session.post(f"{BASE_URL}/api/ativacao", json={
            "cliente_id": client["id"],
            "chip_id": chip["id"]
        })
        assert response.status_code == 400
        assert "plan_code" in response.json().get("detail", "").lower()
        print("✓ Activation rejected for missing plan_code")
        
        # Cleanup
        auth_session.delete(f"{BASE_URL}/api/chips/{chip['id']}")
        auth_session.delete(f"{BASE_URL}/api/ofertas/{offer['id']}")
        auth_session.delete(f"{BASE_URL}/api/planos/{plan['id']}")
    
    def test_successful_activation(self, auth_session):
        """POST /api/ativacao creates line and updates chip with msisdn on success"""
        # Get a complete client
        clients_response = auth_session.get(f"{BASE_URL}/api/clientes")
        clients = [c for c in clients_response.json() if c.get("dados_completos")]
        if len(clients) == 0:
            pytest.skip("No complete clients for testing")
        
        client = clients[0]
        
        # Get an available chip with valid offer/plan
        chips_response = auth_session.get(f"{BASE_URL}/api/chips?status=disponivel")
        chips = chips_response.json()
        # Filter chips that have an offer with plan_code
        valid_chips = [c for c in chips if c.get("plan_code")]
        
        if len(valid_chips) == 0:
            pytest.skip("No available chips with valid plan_code for testing")
        
        chip = valid_chips[0]
        
        # Activate
        response = auth_session.post(f"{BASE_URL}/api/ativacao", json={
            "cliente_id": client["id"],
            "chip_id": chip["id"]
        })
        
        # Mock API has 70% success, 20% pending, 10% error
        # We accept any valid response
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "status" in data
        assert "message" in data
        
        if data["success"]:
            print(f"✓ Activation successful: status={data['status']}, numero={data.get('numero')}")
            
            # Verify chip was updated
            chip_response = auth_session.get(f"{BASE_URL}/api/chips")
            updated_chip = next((c for c in chip_response.json() if c["id"] == chip["id"]), None)
            if updated_chip:
                assert updated_chip["status"] == "ativado"
                print(f"  Chip updated: status={updated_chip['status']}, msisdn={updated_chip.get('msisdn')}")
        else:
            print(f"✓ Activation returned error (expected in mock mode): {data['message']}")


# ==================== LINE ACTION TESTS ====================
class TestLineActions:
    """Line action tests (bloquear-parcial, bloquear-total, desbloquear, alterar-plano, consultar)"""
    
    def test_get_lines(self, auth_session):
        """GET /api/linhas returns lines"""
        response = auth_session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        lines = response.json()
        print(f"✓ GET /api/linhas returns {len(lines)} lines")
        return lines
    
    def test_query_line_from_operator(self, auth_session):
        """GET /api/linhas/{id}/consultar queries line from operator"""
        # Get lines
        lines_response = auth_session.get(f"{BASE_URL}/api/linhas")
        lines = lines_response.json()
        
        if len(lines) == 0:
            pytest.skip("No lines available for testing")
        
        line = lines[0]
        response = auth_session.get(f"{BASE_URL}/api/linhas/{line['id']}/consultar")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "status" in data
        assert "message" in data
        print(f"✓ Line query: success={data['success']}, status={data['status']}")
    
    def test_block_partial_line(self, auth_session):
        """POST /api/linhas/{id}/bloquear-parcial blocks line partially"""
        # Get active lines
        lines_response = auth_session.get(f"{BASE_URL}/api/linhas?status=ativo")
        lines = lines_response.json()
        
        if len(lines) == 0:
            pytest.skip("No active lines available for testing")
        
        line = lines[0]
        response = auth_session.post(f"{BASE_URL}/api/linhas/{line['id']}/bloquear-parcial")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Partial block: success={data['success']}, message={data['message']}")
    
    def test_block_total_line_with_reason(self, auth_session):
        """POST /api/linhas/{id}/bloquear-total blocks line totally with reason code"""
        # Get active lines
        lines_response = auth_session.get(f"{BASE_URL}/api/linhas?status=ativo")
        lines = lines_response.json()
        
        if len(lines) == 0:
            pytest.skip("No active lines available for testing")
        
        line = lines[0]
        response = auth_session.post(f"{BASE_URL}/api/linhas/{line['id']}/bloquear-total", json={
            "reason": 1  # Roubo
        })
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Total block: success={data['success']}, message={data['message']}")
    
    def test_unblock_line(self, auth_session):
        """POST /api/linhas/{id}/desbloquear unblocks line"""
        # Get blocked lines
        lines_response = auth_session.get(f"{BASE_URL}/api/linhas?status=bloqueado")
        lines = lines_response.json()
        
        if len(lines) == 0:
            pytest.skip("No blocked lines available for testing")
        
        line = lines[0]
        response = auth_session.post(f"{BASE_URL}/api/linhas/{line['id']}/desbloquear")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Unblock: success={data['success']}, message={data['message']}")
    
    def test_change_plan(self, auth_session):
        """POST /api/linhas/{id}/alterar-plano changes plan via new oferta_id"""
        # Get active lines
        lines_response = auth_session.get(f"{BASE_URL}/api/linhas?status=ativo")
        lines = lines_response.json()
        
        if len(lines) == 0:
            pytest.skip("No active lines available for testing")
        
        line = lines[0]
        
        # Get offers
        offers_response = auth_session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        offers = offers_response.json()
        
        # Find a different offer
        different_offers = [o for o in offers if o["id"] != line.get("oferta_id")]
        if len(different_offers) == 0:
            pytest.skip("No different offers available for testing")
        
        new_offer = different_offers[0]
        
        response = auth_session.post(f"{BASE_URL}/api/linhas/{line['id']}/alterar-plano", json={
            "oferta_id": new_offer["id"]
        })
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Plan change: success={data['success']}, new_plan={data.get('new_plan')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
