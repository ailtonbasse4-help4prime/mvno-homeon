"""
Backend tests for Self-Service Activation feature
Tests public endpoints and admin management endpoints
"""
import pytest
import requests
import os
import time
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicEndpoints:
    """Tests for public self-service endpoints (no auth required)"""
    
    def test_public_ofertas_returns_list(self):
        """GET /api/public/ofertas should return list of active offers"""
        response = requests.get(f"{BASE_URL}/api/public/ofertas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one offer"
        
        # Validate offer structure
        offer = data[0]
        assert "id" in offer, "Offer should have id"
        assert "nome" in offer, "Offer should have nome"
        assert "valor" in offer, "Offer should have valor"
        print(f"SUCCESS: Found {len(data)} active offers")
    
    def test_public_validar_chip_with_offer(self):
        """GET /api/public/validar-chip/{iccid} should validate chip with offer"""
        # Use chip with offer: 8955170110392667273
        iccid = "8955170110392667273"
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/{iccid}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["iccid"] == iccid, "ICCID should match"
        assert "oferta_nome" in data, "Should have oferta_nome"
        assert "valor_original" in data, "Should have valor_original"
        assert "valor_final" in data, "Should have valor_final"
        assert "desconto" in data, "Should have desconto"
        print(f"SUCCESS: Chip validated - {data['oferta_nome']} - R${data['valor_final']}")
    
    def test_public_validar_chip_without_offer(self):
        """GET /api/public/validar-chip/{iccid} should return error for chip without offer"""
        # Use chip without offer: 8955170110392667281
        iccid = "8955170110392667281"
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/{iccid}")
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "oferta" in data["detail"].lower(), "Error should mention oferta"
        print(f"SUCCESS: Chip without offer rejected correctly")
    
    def test_public_validar_chip_not_found(self):
        """GET /api/public/validar-chip/{iccid} should return 404 for invalid ICCID"""
        iccid = "0000000000000000000"
        response = requests.get(f"{BASE_URL}/api/public/validar-chip/{iccid}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Invalid ICCID returns 404")


class TestSelfServiceActivation:
    """Tests for self-service activation flow"""
    
    @pytest.fixture
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture
    def admin_session(self, session):
        """Login as admin and return authenticated session"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_activation_status_check(self, session):
        """GET /api/public/ativacao/{id}/status should return activation status"""
        # First get existing activation from admin endpoint
        admin_session = requests.Session()
        admin_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        
        activations = admin_session.get(f"{BASE_URL}/api/ativacoes-selfservice").json()
        if not activations:
            pytest.skip("No existing activations to test")
        
        activation_id = activations[0]["id"]
        
        # Test public status endpoint
        response = session.get(f"{BASE_URL}/api/public/ativacao/{activation_id}/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Should have id"
        assert "status" in data, "Should have status"
        assert "chip_iccid" in data, "Should have chip_iccid"
        print(f"SUCCESS: Activation status retrieved - {data['status']}")
    
    def test_activation_status_not_found(self, session):
        """GET /api/public/ativacao/{id}/status should return 404 for invalid ID"""
        response = session.get(f"{BASE_URL}/api/public/ativacao/000000000000000000000000/status")
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
        print("SUCCESS: Invalid activation ID returns error")


class TestAdminSelfServiceManagement:
    """Tests for admin self-service management endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Login as admin and return authenticated session"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return session
    
    def test_admin_list_selfservice_activations(self, admin_session):
        """GET /api/ativacoes-selfservice should return list of activations"""
        response = admin_session.get(f"{BASE_URL}/api/ativacoes-selfservice")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            activation = data[0]
            assert "id" in activation, "Activation should have id"
            assert "status" in activation, "Activation should have status"
            assert "iccid" in activation, "Activation should have iccid"
            assert "cliente_nome" in activation, "Activation should have cliente_nome"
            assert "valor_final" in activation, "Activation should have valor_final"
        print(f"SUCCESS: Found {len(data)} self-service activations")
    
    def test_admin_list_selfservice_with_status_filter(self, admin_session):
        """GET /api/ativacoes-selfservice?status=aguardando_pagamento should filter by status"""
        response = admin_session.get(f"{BASE_URL}/api/ativacoes-selfservice?status=aguardando_pagamento")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # All returned items should have the filtered status
        for activation in data:
            assert activation["status"] == "aguardando_pagamento", f"Expected status aguardando_pagamento, got {activation['status']}"
        print(f"SUCCESS: Status filter works - {len(data)} pending activations")
    
    def test_admin_confirm_requires_auth(self):
        """POST /api/ativacoes-selfservice/{id}/confirmar should require auth"""
        response = requests.post(f"{BASE_URL}/api/ativacoes-selfservice/000000000000000000000000/confirmar")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Confirm endpoint requires authentication")
    
    def test_admin_cancel_requires_auth(self):
        """POST /api/ativacoes-selfservice/{id}/cancelar should require auth"""
        response = requests.post(f"{BASE_URL}/api/ativacoes-selfservice/000000000000000000000000/cancelar")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Cancel endpoint requires authentication")
    
    def test_admin_confirm_not_found(self, admin_session):
        """POST /api/ativacoes-selfservice/{id}/confirmar should return 404 for invalid ID"""
        response = admin_session.post(f"{BASE_URL}/api/ativacoes-selfservice/000000000000000000000000/confirmar")
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
        print("SUCCESS: Confirm with invalid ID returns error")
    
    def test_admin_cancel_not_found(self, admin_session):
        """POST /api/ativacoes-selfservice/{id}/cancelar should return 404 for invalid ID"""
        response = admin_session.post(f"{BASE_URL}/api/ativacoes-selfservice/000000000000000000000000/cancelar")
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"
        print("SUCCESS: Cancel with invalid ID returns error")


class TestSelfServiceActivationCreation:
    """Tests for creating self-service activations"""
    
    @pytest.fixture
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    def test_create_activation_missing_fields(self, session):
        """POST /api/public/ativacao should validate required fields"""
        response = session.post(f"{BASE_URL}/api/public/ativacao", json={
            "iccid": "8955170110392667273"
            # Missing required fields
        })
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"
        print("SUCCESS: Missing fields validation works")
    
    def test_create_activation_invalid_cpf(self, session):
        """POST /api/public/ativacao should validate CPF"""
        response = session.post(f"{BASE_URL}/api/public/ativacao", json={
            "iccid": "8955170110392667273",
            "nome": "Test User",
            "documento": "00000000000",  # Invalid CPF
            "telefone": "11999999999",
            "data_nascimento": "1990-01-01",
            "cep": "01310100",
            "endereco": "Av Paulista",
            "numero_endereco": "1000",
            "billing_type": "PIX"
        })
        assert response.status_code == 400, f"Expected 400 for invalid CPF, got {response.status_code}"
        
        data = response.json()
        assert "cpf" in data.get("detail", "").lower() or "invalido" in data.get("detail", "").lower(), "Error should mention CPF"
        print("SUCCESS: Invalid CPF validation works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
