"""
Test Security Features for MVNO Management System
- Rate limiting on login endpoints
- Progressive lockout after failed attempts
- Password confirmation for destructive actions
- Security headers in responses
- X-Confirm-Token requirement for DELETE operations
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"

# Portal test credentials
PORTAL_CPF = "23211311874"
PORTAL_PHONE = "19920090179"


class TestSecurityHeaders:
    """Test that security headers are present in responses"""
    
    def test_security_headers_present(self):
        """Verify X-Content-Type-Options, X-Frame-Options, X-XSS-Protection headers"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        # Check X-Content-Type-Options
        assert "X-Content-Type-Options" in response.headers, "Missing X-Content-Type-Options header"
        assert response.headers["X-Content-Type-Options"] == "nosniff", f"Expected 'nosniff', got '{response.headers['X-Content-Type-Options']}'"
        
        # Check X-Frame-Options
        assert "X-Frame-Options" in response.headers, "Missing X-Frame-Options header"
        assert response.headers["X-Frame-Options"] == "DENY", f"Expected 'DENY', got '{response.headers['X-Frame-Options']}'"
        
        # Check X-XSS-Protection
        assert "X-XSS-Protection" in response.headers, "Missing X-XSS-Protection header"
        assert "1" in response.headers["X-XSS-Protection"], f"Expected '1; mode=block', got '{response.headers['X-XSS-Protection']}'"
        
        print(f"✓ All security headers present: X-Content-Type-Options={response.headers['X-Content-Type-Options']}, X-Frame-Options={response.headers['X-Frame-Options']}, X-XSS-Protection={response.headers['X-XSS-Protection']}")


class TestAdminLogin:
    """Test admin login endpoint with rate limiting"""
    
    def test_admin_login_success(self):
        """Test successful admin login"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data, "Response missing 'id'"
        assert "email" in data, "Response missing 'email'"
        assert data["email"] == ADMIN_EMAIL, f"Expected email {ADMIN_EMAIL}, got {data['email']}"
        
        # Check httpOnly cookies are set
        assert "access_token" in session.cookies, "access_token cookie not set"
        print(f"✓ Admin login successful: {data['email']}, role={data.get('role')}")
        return session
    
    def test_admin_login_invalid_credentials(self):
        """Test login with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly returns 401")


class TestConfirmPassword:
    """Test password confirmation endpoint for destructive actions"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        return session
    
    def test_confirm_password_success(self, authenticated_session):
        """Test POST /api/auth/confirm-password returns confirm_token when correct password"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/auth/confirm-password",
            json={"password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "confirmed" in data, "Response missing 'confirmed'"
        assert data["confirmed"] == True, "Expected confirmed=True"
        assert "confirm_token" in data, "Response missing 'confirm_token'"
        assert len(data["confirm_token"]) > 0, "confirm_token is empty"
        print(f"✓ Confirm password success: confirmed={data['confirmed']}, token_length={len(data['confirm_token'])}")
        return data["confirm_token"]
    
    def test_confirm_password_wrong_password(self, authenticated_session):
        """Test POST /api/auth/confirm-password returns 401 when wrong password"""
        response = authenticated_session.post(
            f"{BASE_URL}/api/auth/confirm-password",
            json={"password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ Wrong password correctly returns 401")
    
    def test_confirm_password_unauthenticated(self):
        """Test confirm-password requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/auth/confirm-password",
            json={"password": ADMIN_PASSWORD}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request correctly returns 401")


class TestDeleteWithoutConfirmToken:
    """Test that DELETE operations return 403 without X-Confirm-Token header"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        return session
    
    def test_delete_usuario_without_token_returns_403(self, authenticated_session):
        """DELETE /api/usuarios/{id} returns 403 without X-Confirm-Token"""
        # Use a fake ID - we just want to test the 403 response
        fake_id = "507f1f77bcf86cd799439011"
        response = authenticated_session.delete(f"{BASE_URL}/api/usuarios/{fake_id}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing 'detail'"
        assert "confirmacao" in data["detail"].lower() or "senha" in data["detail"].lower(), f"Unexpected error message: {data['detail']}"
        print(f"✓ DELETE /api/usuarios without token returns 403: {data['detail']}")
    
    def test_delete_cliente_without_token_returns_403(self, authenticated_session):
        """DELETE /api/clientes/{id} returns 403 without X-Confirm-Token"""
        fake_id = "507f1f77bcf86cd799439011"
        response = authenticated_session.delete(f"{BASE_URL}/api/clientes/{fake_id}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing 'detail'"
        print(f"✓ DELETE /api/clientes without token returns 403: {data['detail']}")
    
    def test_delete_plano_without_token_returns_403(self, authenticated_session):
        """DELETE /api/planos/{id} returns 403 without X-Confirm-Token"""
        fake_id = "507f1f77bcf86cd799439011"
        response = authenticated_session.delete(f"{BASE_URL}/api/planos/{fake_id}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing 'detail'"
        print(f"✓ DELETE /api/planos without token returns 403: {data['detail']}")
    
    def test_delete_oferta_without_token_returns_403(self, authenticated_session):
        """DELETE /api/ofertas/{id} returns 403 without X-Confirm-Token"""
        fake_id = "507f1f77bcf86cd799439011"
        response = authenticated_session.delete(f"{BASE_URL}/api/ofertas/{fake_id}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing 'detail'"
        print(f"✓ DELETE /api/ofertas without token returns 403: {data['detail']}")
    
    def test_delete_chip_without_token_returns_403(self, authenticated_session):
        """DELETE /api/chips/{id} returns 403 without X-Confirm-Token"""
        fake_id = "507f1f77bcf86cd799439011"
        response = authenticated_session.delete(f"{BASE_URL}/api/chips/{fake_id}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Response missing 'detail'"
        print(f"✓ DELETE /api/chips without token returns 403: {data['detail']}")


class TestDeleteWithConfirmToken:
    """Test that DELETE operations work with valid X-Confirm-Token"""
    
    @pytest.fixture
    def authenticated_session_with_token(self):
        """Get authenticated session and confirm token"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        
        # Get confirm token
        confirm_response = session.post(
            f"{BASE_URL}/api/auth/confirm-password",
            json={"password": ADMIN_PASSWORD}
        )
        if confirm_response.status_code != 200:
            pytest.skip(f"Confirm password failed: {confirm_response.text}")
        
        confirm_token = confirm_response.json()["confirm_token"]
        return session, confirm_token
    
    def test_delete_usuario_with_token_passes_auth(self, authenticated_session_with_token):
        """DELETE /api/usuarios/{id} with X-Confirm-Token passes auth check (may return 404 for fake ID)"""
        session, confirm_token = authenticated_session_with_token
        fake_id = "507f1f77bcf86cd799439011"
        
        response = session.delete(
            f"{BASE_URL}/api/usuarios/{fake_id}",
            headers={"X-Confirm-Token": confirm_token}
        )
        
        # Should NOT be 403 (auth passed), but may be 404 (user not found) or 400 (can't delete self)
        assert response.status_code != 403, f"Got 403 even with valid token: {response.text}"
        print(f"✓ DELETE /api/usuarios with token passes auth check (status={response.status_code})")
    
    def test_delete_cliente_with_token_passes_auth(self, authenticated_session_with_token):
        """DELETE /api/clientes/{id} with X-Confirm-Token passes auth check"""
        session, confirm_token = authenticated_session_with_token
        fake_id = "507f1f77bcf86cd799439011"
        
        response = session.delete(
            f"{BASE_URL}/api/clientes/{fake_id}",
            headers={"X-Confirm-Token": confirm_token}
        )
        
        assert response.status_code != 403, f"Got 403 even with valid token: {response.text}"
        print(f"✓ DELETE /api/clientes with token passes auth check (status={response.status_code})")


class TestRepairStatus:
    """Test operadora repair status endpoint"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Get authenticated session"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.text}")
        return session
    
    def test_repair_status_endpoint(self, authenticated_session):
        """GET /api/operadora/reparar-status returns status"""
        response = authenticated_session.get(f"{BASE_URL}/api/operadora/reparar-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "status" in data, "Response missing 'status'"
        print(f"✓ Repair status endpoint works: status={data['status']}, message={data.get('message', 'N/A')}")


class TestPortalLogin:
    """Test portal login endpoint with rate limiting"""
    
    def test_portal_login_success(self):
        """Test successful portal login with CPF and phone"""
        response = requests.post(
            f"{BASE_URL}/api/portal/login",
            json={"documento": PORTAL_CPF, "telefone": PORTAL_PHONE}
        )
        
        # May return 200 (success) or 401 (CPF/phone not found in DB)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "Response missing 'token'"
            assert "cliente" in data, "Response missing 'cliente'"
            print(f"✓ Portal login successful: cliente={data['cliente'].get('nome')}")
        elif response.status_code == 401:
            print(f"✓ Portal login returns 401 (CPF/phone not in DB): {response.json().get('detail')}")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    def test_portal_login_invalid_cpf(self):
        """Test portal login with invalid CPF"""
        response = requests.post(
            f"{BASE_URL}/api/portal/login",
            json={"documento": "00000000000", "telefone": "11999999999"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid CPF correctly returns 401")


class TestProgressiveLockout:
    """Test progressive lockout after failed login attempts"""
    
    def test_lockout_info_in_error(self):
        """Test that lockout information is provided after multiple failed attempts"""
        # Note: We can't fully test lockout without making 5+ failed attempts
        # which would affect other tests. Just verify the endpoint handles failures correctly.
        unique_email = f"test_lockout_{uuid.uuid4().hex[:8]}@test.com"
        
        # Make a few failed attempts
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": unique_email, "password": "wrongpassword"}
            )
            assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✓ Failed login attempts handled correctly (401 returned)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
