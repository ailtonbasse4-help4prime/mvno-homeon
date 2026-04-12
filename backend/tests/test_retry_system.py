"""
Test suite for MVNO Retry System - Iteration 23
Tests the automatic retry functionality for failed activations.

Features tested:
- GET /api/retry-queue - returns retry queue with stats and config
- POST /api/ativacoes-selfservice/{id}/retry - manual retry for error/retry_pendente activations
- Retry fields in GET /api/ativacoes-selfservice response
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@mvno.com"
ADMIN_PASSWORD = "admin123"


class TestRetrySystem:
    """Tests for the retry system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        # Login as admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        yield
        self.session.close()
    
    # ==================== GET /api/retry-queue Tests ====================
    
    def test_retry_queue_endpoint_returns_200(self):
        """Test that retry-queue endpoint returns 200 OK"""
        response = self.session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/retry-queue returns 200")
    
    def test_retry_queue_has_queue_field(self):
        """Test that retry-queue response has 'queue' field"""
        response = self.session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code == 200
        data = response.json()
        assert "queue" in data, "Response missing 'queue' field"
        assert isinstance(data["queue"], list), "'queue' should be a list"
        print(f"PASS: retry-queue has 'queue' field with {len(data['queue'])} items")
    
    def test_retry_queue_has_stats_field(self):
        """Test that retry-queue response has 'stats' field with expected structure"""
        response = self.session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data, "Response missing 'stats' field"
        stats = data["stats"]
        
        # Check required stats fields
        assert "retry_pendente" in stats, "stats missing 'retry_pendente'"
        assert "erro" in stats, "stats missing 'erro'"
        assert "ativando" in stats, "stats missing 'ativando'"
        assert "config" in stats, "stats missing 'config'"
        
        print(f"PASS: retry-queue stats: retry_pendente={stats['retry_pendente']}, erro={stats['erro']}, ativando={stats['ativando']}")
    
    def test_retry_queue_config_has_expected_fields(self):
        """Test that retry-queue config has max_retries, backoff_minutes, check_interval_seconds"""
        response = self.session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code == 200
        data = response.json()
        config = data["stats"]["config"]
        
        assert "max_retries" in config, "config missing 'max_retries'"
        assert "backoff_minutes" in config, "config missing 'backoff_minutes'"
        assert "check_interval_seconds" in config, "config missing 'check_interval_seconds'"
        
        # Validate values
        assert config["max_retries"] == 5, f"Expected max_retries=5, got {config['max_retries']}"
        assert config["backoff_minutes"] == [2, 5, 15, 30, 60], f"Unexpected backoff_minutes: {config['backoff_minutes']}"
        assert config["check_interval_seconds"] == 120, f"Expected check_interval=120, got {config['check_interval_seconds']}"
        
        print(f"PASS: retry-queue config correct: max_retries={config['max_retries']}, backoff={config['backoff_minutes']}, interval={config['check_interval_seconds']}s")
    
    def test_retry_queue_requires_auth(self):
        """Test that retry-queue endpoint requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        response = unauth_session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print(f"PASS: retry-queue requires auth (returns {response.status_code} without auth)")
    
    # ==================== GET /api/ativacoes-selfservice Tests ====================
    
    def test_ativacoes_selfservice_list_returns_200(self):
        """Test that ativacoes-selfservice list endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/ativacoes-selfservice")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/ativacoes-selfservice returns 200")
    
    def test_ativacoes_selfservice_has_retry_fields(self):
        """Test that ativacoes-selfservice response includes retry fields"""
        response = self.session.get(f"{BASE_URL}/api/ativacoes-selfservice")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) == 0:
            print("SKIP: No activations in database to verify retry fields")
            return
        
        # Check first activation for retry fields
        activation = data[0]
        required_retry_fields = ["retry_count", "next_retry_at", "last_retry_at", "retry_errors", "error_code"]
        
        for field in required_retry_fields:
            assert field in activation, f"Activation missing retry field: {field}"
        
        print(f"PASS: Activation has all retry fields: {required_retry_fields}")
        print(f"  Sample values: retry_count={activation['retry_count']}, next_retry_at={activation['next_retry_at']}")
    
    def test_ativacoes_selfservice_filter_by_status(self):
        """Test filtering ativacoes-selfservice by status"""
        # Test with retry_pendente filter
        response = self.session.get(f"{BASE_URL}/api/ativacoes-selfservice?status=retry_pendente")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # All returned items should have status=retry_pendente
        for item in data:
            assert item["status"] == "retry_pendente", f"Filter failed: got status={item['status']}"
        
        print(f"PASS: Filter by status=retry_pendente works ({len(data)} items)")
    
    # ==================== POST /api/ativacoes-selfservice/{id}/retry Tests ====================
    
    def test_retry_endpoint_rejects_non_error_status(self):
        """Test that retry endpoint rejects activations that are not in error/retry_pendente status"""
        # First get list of activations
        response = self.session.get(f"{BASE_URL}/api/ativacoes-selfservice")
        assert response.status_code == 200
        data = response.json()
        
        # Find an activation that is NOT in error or retry_pendente status
        non_error_activation = None
        for activation in data:
            if activation["status"] not in ("erro", "retry_pendente"):
                non_error_activation = activation
                break
        
        if not non_error_activation:
            print("SKIP: No non-error activations found to test rejection")
            return
        
        # Try to retry it - should fail
        retry_response = self.session.post(
            f"{BASE_URL}/api/ativacoes-selfservice/{non_error_activation['id']}/retry"
        )
        
        assert retry_response.status_code == 400, f"Expected 400 for non-error activation, got {retry_response.status_code}"
        error_detail = retry_response.json().get("detail", "")
        assert "erro" in error_detail.lower() or "retry_pendente" in error_detail.lower(), f"Error message should mention valid statuses: {error_detail}"
        
        print(f"PASS: Retry correctly rejected for status={non_error_activation['status']} (HTTP 400)")
    
    def test_retry_endpoint_returns_404_for_invalid_id(self):
        """Test that retry endpoint returns 404 for non-existent activation"""
        fake_id = "000000000000000000000000"  # Valid ObjectId format but doesn't exist
        response = self.session.post(f"{BASE_URL}/api/ativacoes-selfservice/{fake_id}/retry")
        
        assert response.status_code == 404, f"Expected 404 for invalid ID, got {response.status_code}"
        print("PASS: Retry returns 404 for non-existent activation")
    
    def test_retry_endpoint_requires_auth(self):
        """Test that retry endpoint requires authentication"""
        unauth_session = requests.Session()
        fake_id = "000000000000000000000000"
        response = unauth_session.post(f"{BASE_URL}/api/ativacoes-selfservice/{fake_id}/retry")
        
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print(f"PASS: Retry endpoint requires auth (returns {response.status_code} without auth)")
    
    # ==================== Integration Test: Retry Flow ====================
    
    def test_retry_on_error_activation_if_exists(self):
        """Test retry on an actual error/retry_pendente activation if one exists"""
        # Get activations with error or retry_pendente status
        response = self.session.get(f"{BASE_URL}/api/ativacoes-selfservice")
        assert response.status_code == 200
        data = response.json()
        
        error_activation = None
        for activation in data:
            if activation["status"] in ("erro", "retry_pendente"):
                error_activation = activation
                break
        
        if not error_activation:
            print("SKIP: No error/retry_pendente activations found to test retry")
            return
        
        # Attempt retry
        retry_response = self.session.post(
            f"{BASE_URL}/api/ativacoes-selfservice/{error_activation['id']}/retry"
        )
        
        # Should return 200 with status info
        assert retry_response.status_code == 200, f"Expected 200, got {retry_response.status_code}: {retry_response.text}"
        result = retry_response.json()
        
        assert "success" in result, "Response missing 'success' field"
        assert "status" in result, "Response missing 'status' field"
        assert "retry_count" in result, "Response missing 'retry_count' field"
        
        print(f"PASS: Retry executed successfully. New status={result['status']}, retry_count={result['retry_count']}")


class TestRetryQueueItemStructure:
    """Tests for the structure of items in the retry queue"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code}")
        yield
        self.session.close()
    
    def test_queue_item_has_required_fields(self):
        """Test that queue items have all required fields"""
        response = self.session.get(f"{BASE_URL}/api/retry-queue")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["queue"]) == 0:
            print("SKIP: No items in retry queue to verify structure")
            return
        
        item = data["queue"][0]
        required_fields = [
            "id", "iccid", "cliente_nome", "status", "erro_msg", "error_code",
            "retry_count", "max_retries", "next_retry_at", "last_retry_at",
            "retry_errors", "created_at"
        ]
        
        for field in required_fields:
            assert field in item, f"Queue item missing field: {field}"
        
        print(f"PASS: Queue item has all required fields")
        print(f"  Sample: iccid={item['iccid']}, status={item['status']}, retry_count={item['retry_count']}/{item['max_retries']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
