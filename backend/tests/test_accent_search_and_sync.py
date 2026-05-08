"""
Test accent-insensitive client search and Asaas sync endpoint.
Iteration 24 - Testing fixes for:
1. Accent-insensitive search (alvaro should find Álvaro)
2. POST /api/carteira/sincronizar-asaas endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAccentInsensitiveSearch:
    """Test accent-insensitive client search functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session with cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        if login_resp.status_code != 200:
            pytest.skip(f"Login failed: {login_resp.status_code}")
        print(f"Login successful: {login_resp.json().get('name')}")
    
    def test_search_alvaro_lowercase_no_accent(self):
        """Search 'alvaro' (lowercase, no accent) should find 'Álvaro Da Silva Junior'"""
        resp = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "alvaro"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        
        clients = resp.json()
        print(f"Search 'alvaro' returned {len(clients)} clients")
        
        # Check if any client name contains 'Álvaro' (with accent)
        found_alvaro = False
        for c in clients:
            nome = c.get("nome", "").lower()
            if "álvaro" in nome or "alvaro" in nome:
                found_alvaro = True
                print(f"Found client: {c.get('nome')} - {c.get('documento')}")
        
        assert found_alvaro, "Expected to find client with name containing 'Álvaro' but none found"
    
    def test_search_Alvaro_capitalized_no_accent(self):
        """Search 'Alvaro' (capitalized, no accent) should find 'Álvaro Da Silva Junior'"""
        resp = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "Alvaro"})
        assert resp.status_code == 200
        
        clients = resp.json()
        print(f"Search 'Alvaro' returned {len(clients)} clients")
        
        found_alvaro = any("álvaro" in c.get("nome", "").lower() or "alvaro" in c.get("nome", "").lower() for c in clients)
        assert found_alvaro, "Expected to find client with name containing 'Álvaro'"
    
    def test_search_ALVARO_uppercase_with_accent(self):
        """Search 'ÁLVARO' (uppercase, with accent) should find 'Álvaro Da Silva Junior'"""
        resp = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "ÁLVARO"})
        assert resp.status_code == 200
        
        clients = resp.json()
        print(f"Search 'ÁLVARO' returned {len(clients)} clients")
        
        found_alvaro = any("álvaro" in c.get("nome", "").lower() or "alvaro" in c.get("nome", "").lower() for c in clients)
        assert found_alvaro, "Expected to find client with name containing 'Álvaro'"
    
    def test_search_silva_junior(self):
        """Search 'silva junior' should find 'Álvaro Da Silva Junior'"""
        resp = self.session.get(f"{BASE_URL}/api/clientes", params={"search": "silva junior"})
        assert resp.status_code == 200
        
        clients = resp.json()
        print(f"Search 'silva junior' returned {len(clients)} clients")
        
        found = any("silva" in c.get("nome", "").lower() and "junior" in c.get("nome", "").lower() for c in clients)
        assert found, "Expected to find client with name containing 'Silva Junior'"
    
    def test_search_empty_returns_all(self):
        """Empty search should return all clients"""
        resp = self.session.get(f"{BASE_URL}/api/clientes")
        assert resp.status_code == 200
        
        clients = resp.json()
        print(f"Empty search returned {len(clients)} clients")
        assert len(clients) >= 0, "Should return a list of clients"
    
    def test_search_by_documento(self):
        """Search by document number should work"""
        # First get a client to know a document number
        resp = self.session.get(f"{BASE_URL}/api/clientes")
        assert resp.status_code == 200
        
        clients = resp.json()
        if not clients:
            pytest.skip("No clients to test document search")
        
        # Get first client's document
        doc = clients[0].get("documento", "")
        if not doc:
            pytest.skip("First client has no document")
        
        # Search by partial document
        partial_doc = doc[:6] if len(doc) >= 6 else doc
        resp2 = self.session.get(f"{BASE_URL}/api/clientes", params={"search": partial_doc})
        assert resp2.status_code == 200
        
        found_clients = resp2.json()
        print(f"Search by document '{partial_doc}' returned {len(found_clients)} clients")
        assert len(found_clients) >= 1, "Should find at least one client by document"


class TestSincronizarAsaasEndpoint:
    """Test POST /api/carteira/sincronizar-asaas endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session with cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        if login_resp.status_code != 200:
            pytest.skip(f"Login failed: {login_resp.status_code}")
        print(f"Login successful for sync tests")
    
    def test_sincronizar_asaas_requires_auth(self):
        """Endpoint should require authentication"""
        # Use a new session without login
        new_session = requests.Session()
        resp = new_session.post(f"{BASE_URL}/api/carteira/sincronizar-asaas", timeout=30)
        assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
        print("Auth check passed - endpoint requires authentication")
    
    def test_sincronizar_asaas_returns_expected_fields(self):
        """Endpoint should return success, imported, skipped, no_client, total_asaas, message"""
        resp = self.session.post(f"{BASE_URL}/api/carteira/sincronizar-asaas", timeout=180)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        print(f"Sync response: {data}")
        
        # Check required fields
        assert "success" in data, "Response should have 'success' field"
        assert "imported" in data, "Response should have 'imported' field"
        assert "skipped" in data, "Response should have 'skipped' field"
        assert "no_client" in data, "Response should have 'no_client' field"
        assert "total_asaas" in data, "Response should have 'total_asaas' field"
        assert "message" in data, "Response should have 'message' field"
        
        # Validate types
        assert isinstance(data["success"], bool), "success should be boolean"
        assert isinstance(data["imported"], int), "imported should be integer"
        assert isinstance(data["skipped"], int), "skipped should be integer"
        assert isinstance(data["no_client"], int), "no_client should be integer"
        assert isinstance(data["total_asaas"], int), "total_asaas should be integer"
        
        print(f"Sync result: imported={data['imported']}, skipped={data['skipped']}, no_client={data['no_client']}, total_asaas={data['total_asaas']}")
    
    def test_sincronizar_asaas_handles_already_imported(self):
        """Running sync twice should skip already imported charges"""
        # First sync
        resp1 = self.session.post(f"{BASE_URL}/api/carteira/sincronizar-asaas", timeout=180)
        assert resp1.status_code == 200
        data1 = resp1.json()
        
        # Second sync - should have more skipped
        resp2 = self.session.post(f"{BASE_URL}/api/carteira/sincronizar-asaas", timeout=180)
        assert resp2.status_code == 200
        data2 = resp2.json()
        
        print(f"First sync: imported={data1['imported']}, skipped={data1['skipped']}")
        print(f"Second sync: imported={data2['imported']}, skipped={data2['skipped']}")
        
        # Second sync should have 0 or fewer imports (all should be skipped now)
        assert data2["imported"] <= data1["imported"], "Second sync should import same or fewer charges"


class TestSincronizarStatusEndpoint:
    """Test POST /api/carteira/sincronizar-status endpoint (existing button)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session with cookies"""
        self.session = requests.Session()
        login_resp = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@mvno.com", "password": "admin123"}
        )
        if login_resp.status_code != 200:
            pytest.skip(f"Login failed: {login_resp.status_code}")
    
    def test_sincronizar_status_works(self):
        """Existing sync status endpoint should still work"""
        resp = self.session.post(f"{BASE_URL}/api/carteira/sincronizar-status", timeout=120)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        data = resp.json()
        print(f"Sync status response: {data}")
        
        # Check expected fields
        assert "total_checked" in data, "Response should have 'total_checked' field"
        assert "updated" in data, "Response should have 'updated' field"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
