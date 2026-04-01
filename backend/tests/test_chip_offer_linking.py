"""
Test suite for Chip Offer Linking Feature
Tests:
- PUT /api/chips/{chip_id} - update offer for available chip
- PUT /api/chips/{chip_id} - prevent update for activated chip
- GET /api/ofertas?ativo=true - return offers with 'categoria' field
- GET /api/chips - return chips with oferta_nome, categoria, plan_code, valor
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestChipOfferLinking:
    """Tests for chip offer linking feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get session"""
        self.session = requests.Session()
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        print(f"Admin login successful")
        yield
        # Cleanup
        self.session.close()
    
    def test_get_ofertas_with_categoria(self):
        """GET /api/ofertas?ativo=true should return offers with 'categoria' field"""
        response = self.session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        assert response.status_code == 200, f"Failed to get ofertas: {response.text}"
        
        ofertas = response.json()
        assert len(ofertas) > 0, "No active offers found"
        
        # Check that all offers have categoria field
        for oferta in ofertas:
            assert "categoria" in oferta, f"Offer {oferta.get('nome')} missing 'categoria' field"
            assert oferta["categoria"] in ["movel", "m2m"], f"Invalid categoria: {oferta['categoria']}"
            print(f"Offer: {oferta['nome']} - Categoria: {oferta['categoria']}")
        
        # Count by category
        movel_count = len([o for o in ofertas if o["categoria"] == "movel"])
        m2m_count = len([o for o in ofertas if o["categoria"] == "m2m"])
        print(f"Total offers: {len(ofertas)}, Movel: {movel_count}, M2M: {m2m_count}")
    
    def test_get_chips_with_offer_details(self):
        """GET /api/chips should return chips with oferta_nome, categoria, plan_code, valor"""
        response = self.session.get(f"{BASE_URL}/api/chips")
        assert response.status_code == 200, f"Failed to get chips: {response.text}"
        
        chips = response.json()
        assert len(chips) > 0, "No chips found"
        
        # Find a chip with an offer linked
        chips_with_offer = [c for c in chips if c.get("oferta_id")]
        print(f"Total chips: {len(chips)}, Chips with offer: {len(chips_with_offer)}")
        
        if chips_with_offer:
            chip = chips_with_offer[0]
            # Verify response structure includes offer details
            assert "oferta_nome" in chip, "Missing oferta_nome field"
            assert "categoria" in chip, "Missing categoria field"
            assert "plan_code" in chip, "Missing plan_code field"
            assert "valor" in chip, "Missing valor field"
            print(f"Chip {chip['iccid']}: oferta={chip['oferta_nome']}, categoria={chip['categoria']}, plan_code={chip['plan_code']}, valor={chip['valor']}")
        else:
            print("No chips with offers linked - will test linking next")
    
    def test_update_chip_offer_available(self):
        """PUT /api/chips/{chip_id} should update offer for available chip"""
        # Get available chips
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        assert chips_response.status_code == 200
        chips = chips_response.json()
        
        if not chips:
            pytest.skip("No available chips to test")
        
        # Get active offers
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        assert ofertas_response.status_code == 200
        ofertas = ofertas_response.json()
        
        if not ofertas:
            pytest.skip("No active offers to test")
        
        # Pick a chip and an offer
        chip = chips[0]
        oferta = ofertas[0]
        
        print(f"Testing: Update chip {chip['iccid']} (status={chip['status']}) with offer {oferta['nome']}")
        
        # Update chip with offer
        update_response = self.session.put(
            f"{BASE_URL}/api/chips/{chip['id']}",
            json={"oferta_id": oferta["id"]}
        )
        assert update_response.status_code == 200, f"Failed to update chip: {update_response.text}"
        
        updated_chip = update_response.json()
        assert updated_chip["oferta_id"] == oferta["id"], "Offer ID not updated"
        assert updated_chip["oferta_nome"] == oferta["nome"], "Offer name not returned"
        print(f"SUCCESS: Chip updated with offer {updated_chip['oferta_nome']}")
    
    def test_update_chip_offer_activated_fails(self):
        """PUT /api/chips/{chip_id} should fail for activated chip with 400"""
        # Get activated chips
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=ativado")
        assert chips_response.status_code == 200
        chips = chips_response.json()
        
        if not chips:
            pytest.skip("No activated chips to test - this is expected if no activations done")
        
        # Get active offers
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        assert ofertas_response.status_code == 200
        ofertas = ofertas_response.json()
        
        if not ofertas:
            pytest.skip("No active offers to test")
        
        chip = chips[0]
        oferta = ofertas[0]
        
        print(f"Testing: Try to update activated chip {chip['iccid']} (should fail)")
        
        # Try to update activated chip - should fail
        update_response = self.session.put(
            f"{BASE_URL}/api/chips/{chip['id']}",
            json={"oferta_id": oferta["id"]}
        )
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}: {update_response.text}"
        
        error_detail = update_response.json().get("detail", "")
        assert "ativado" in error_detail.lower(), f"Error message should mention 'ativado': {error_detail}"
        print(f"SUCCESS: Correctly rejected with error: {error_detail}")
    
    def test_update_chip_offer_blocked_fails(self):
        """PUT /api/chips/{chip_id} should fail for blocked chip"""
        # Get blocked chips
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=bloqueado")
        assert chips_response.status_code == 200
        chips = chips_response.json()
        
        if not chips:
            pytest.skip("No blocked chips to test")
        
        # Get active offers
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        assert ofertas_response.status_code == 200
        ofertas = ofertas_response.json()
        
        if not ofertas:
            pytest.skip("No active offers to test")
        
        chip = chips[0]
        oferta = ofertas[0]
        
        print(f"Testing: Try to update blocked chip {chip['iccid']} (should fail)")
        
        # Try to update blocked chip - should fail
        update_response = self.session.put(
            f"{BASE_URL}/api/chips/{chip['id']}",
            json={"oferta_id": oferta["id"]}
        )
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        print(f"SUCCESS: Correctly rejected blocked chip update")
    
    def test_update_chip_offer_reserved_works(self):
        """PUT /api/chips/{chip_id} should work for reserved chip"""
        # Get reserved chips
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=reservado")
        assert chips_response.status_code == 200
        chips = chips_response.json()
        
        if not chips:
            pytest.skip("No reserved chips to test")
        
        # Get active offers
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas?ativo=true")
        assert ofertas_response.status_code == 200
        ofertas = ofertas_response.json()
        
        if not ofertas:
            pytest.skip("No active offers to test")
        
        chip = chips[0]
        oferta = ofertas[0]
        
        print(f"Testing: Update reserved chip {chip['iccid']} with offer {oferta['nome']}")
        
        # Update reserved chip - should work
        update_response = self.session.put(
            f"{BASE_URL}/api/chips/{chip['id']}",
            json={"oferta_id": oferta["id"]}
        )
        assert update_response.status_code == 200, f"Failed to update reserved chip: {update_response.text}"
        print(f"SUCCESS: Reserved chip updated successfully")
    
    def test_update_chip_inactive_offer_fails(self):
        """PUT /api/chips/{chip_id} should fail with inactive offer"""
        # Get available chips
        chips_response = self.session.get(f"{BASE_URL}/api/chips?status=disponivel")
        assert chips_response.status_code == 200
        chips = chips_response.json()
        
        if not chips:
            pytest.skip("No available chips to test")
        
        # Get all offers including inactive
        ofertas_response = self.session.get(f"{BASE_URL}/api/ofertas")
        assert ofertas_response.status_code == 200
        ofertas = ofertas_response.json()
        
        inactive_ofertas = [o for o in ofertas if not o.get("ativo", True)]
        if not inactive_ofertas:
            pytest.skip("No inactive offers to test")
        
        chip = chips[0]
        oferta = inactive_ofertas[0]
        
        print(f"Testing: Try to link inactive offer {oferta['nome']} to chip (should fail)")
        
        update_response = self.session.put(
            f"{BASE_URL}/api/chips/{chip['id']}",
            json={"oferta_id": oferta["id"]}
        )
        assert update_response.status_code == 400, f"Expected 400, got {update_response.status_code}"
        print(f"SUCCESS: Correctly rejected inactive offer")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
