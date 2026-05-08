#!/usr/bin/env python3
"""
MVNO System Backend API Testing
Tests all backend endpoints for the MVNO management system
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class MVNOAPITester:
    def __init__(self, base_url: str = "https://chip-manager-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_credentials = {
            "email": "admin@mvno.com",
            "password": "admin123"
        }
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, expected_status: int = 200) -> tuple[bool, Dict]:
        """Make HTTP request and validate response"""
        url = f"{self.base_url}/api/{endpoint}"
        
        try:
            if method == 'GET':
                response = self.session.get(url)
            elif method == 'POST':
                response = self.session.post(url, json=data)
            elif method == 'PUT':
                response = self.session.put(url, json=data)
            elif method == 'DELETE':
                response = self.session.delete(url)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}

            return success, response_data

        except Exception as e:
            return False, {"error": str(e)}

    def test_auth_login(self) -> bool:
        """Test admin login"""
        success, response = self.make_request('POST', 'auth/login', self.admin_credentials)
        
        if success and 'id' in response:
            self.log_test("Admin Login", True, f"Logged in as {response.get('name', 'Admin')}")
            return True
        else:
            self.log_test("Admin Login", False, f"Login failed: {response}")
            return False

    def test_auth_me(self) -> bool:
        """Test get current user"""
        success, response = self.make_request('GET', 'auth/me')
        
        if success and response.get('role') == 'admin':
            self.log_test("Get Current User", True, f"User: {response.get('name')} ({response.get('role')})")
            return True
        else:
            self.log_test("Get Current User", False, f"Failed to get user info: {response}")
            return False

    def test_dashboard_stats(self) -> Dict:
        """Test dashboard statistics"""
        success, response = self.make_request('GET', 'dashboard/stats')
        
        if success and 'clientes' in response:
            stats = response
            expected_clients = 4
            expected_chips = 5
            expected_plans = 4
            
            clients_ok = stats['clientes']['total'] == expected_clients
            chips_ok = stats['chips']['total'] == expected_chips
            plans_ok = stats['planos']['total'] == expected_plans
            
            details = f"Clients: {stats['clientes']['total']}/{expected_clients}, Chips: {stats['chips']['total']}/{expected_chips}, Plans: {stats['planos']['total']}/{expected_plans}"
            
            if clients_ok and chips_ok and plans_ok:
                self.log_test("Dashboard Stats", True, details)
            else:
                self.log_test("Dashboard Stats", False, f"Stats mismatch - {details}")
            
            return stats
        else:
            self.log_test("Dashboard Stats", False, f"Failed to get stats: {response}")
            return {}

    def test_clients_crud(self) -> Optional[str]:
        """Test client CRUD operations"""
        # List clients
        success, clients = self.make_request('GET', 'clientes')
        if not success:
            self.log_test("List Clients", False, f"Failed to list clients: {clients}")
            return None
        
        self.log_test("List Clients", True, f"Found {len(clients)} clients")
        
        # Create new client
        new_client = {
            "nome": "Cliente Teste API",
            "cpf": "999.888.777-66",
            "telefone": "(11) 99999-8888",
            "status": "ativo"
        }
        
        success, response = self.make_request('POST', 'clientes', new_client, 200)
        if success and 'id' in response:
            client_id = response['id']
            self.log_test("Create Client", True, f"Created client with ID: {client_id}")
            
            # Get specific client
            success, client = self.make_request('GET', f'clientes/{client_id}')
            if success and client.get('nome') == new_client['nome']:
                self.log_test("Get Client", True, f"Retrieved client: {client['nome']}")
            else:
                self.log_test("Get Client", False, f"Failed to get client: {client}")
            
            # Update client
            updated_client = new_client.copy()
            updated_client['nome'] = "Cliente Teste API Atualizado"
            
            success, response = self.make_request('PUT', f'clientes/{client_id}', updated_client)
            if success:
                self.log_test("Update Client", True, "Client updated successfully")
            else:
                self.log_test("Update Client", False, f"Failed to update client: {response}")
            
            return client_id
        else:
            self.log_test("Create Client", False, f"Failed to create client: {response}")
            return None

    def test_chips_crud(self) -> Optional[str]:
        """Test chip CRUD operations"""
        # List chips
        success, chips = self.make_request('GET', 'chips')
        if not success:
            self.log_test("List Chips", False, f"Failed to list chips: {chips}")
            return None
        
        self.log_test("List Chips", True, f"Found {len(chips)} chips")
        
        # Create new chip
        new_chip = {
            "iccid": "8955010099887766554"
        }
        
        success, response = self.make_request('POST', 'chips', new_chip, 200)
        if success and 'id' in response:
            chip_id = response['id']
            self.log_test("Create Chip", True, f"Created chip with ID: {chip_id}")
            return chip_id
        else:
            self.log_test("Create Chip", False, f"Failed to create chip: {response}")
            return None

    def test_plans_crud(self) -> Optional[str]:
        """Test plan CRUD operations (admin only)"""
        # List plans
        success, plans = self.make_request('GET', 'planos')
        if not success:
            self.log_test("List Plans", False, f"Failed to list plans: {plans}")
            return None
        
        self.log_test("List Plans", True, f"Found {len(plans)} plans")
        
        # Create new plan (admin only)
        new_plan = {
            "nome": "Teste API 15GB",
            "valor": 59.90,
            "franquia": "15GB"
        }
        
        success, response = self.make_request('POST', 'planos', new_plan, 200)
        if success and 'id' in response:
            plan_id = response['id']
            self.log_test("Create Plan", True, f"Created plan with ID: {plan_id}")
            
            # Update plan
            updated_plan = new_plan.copy()
            updated_plan['valor'] = 69.90
            
            success, response = self.make_request('PUT', f'planos/{plan_id}', updated_plan)
            if success:
                self.log_test("Update Plan", True, "Plan updated successfully")
            else:
                self.log_test("Update Plan", False, f"Failed to update plan: {response}")
            
            return plan_id
        else:
            self.log_test("Create Plan", False, f"Failed to create plan: {response}")
            return None

    def test_line_activation(self, client_id: str, chip_id: str, plan_id: str) -> Optional[str]:
        """Test line activation workflow"""
        if not all([client_id, chip_id, plan_id]):
            self.log_test("Line Activation", False, "Missing required IDs for activation")
            return None
        
        activation_data = {
            "cliente_id": client_id,
            "chip_id": chip_id,
            "plano_id": plan_id
        }
        
        success, response = self.make_request('POST', 'ativacao', activation_data)
        
        if success and response.get('success'):
            status = response.get('status', 'unknown')
            message = response.get('message', '')
            numero = response.get('numero', 'N/A')
            
            self.log_test("Line Activation", True, f"Status: {status}, Number: {numero}, Message: {message}")
            
            # If activation was successful, try to find the line
            if status in ['ativo', 'pendente']:
                success, lines = self.make_request('GET', 'linhas')
                if success:
                    # Find the line we just created
                    for line in lines:
                        if line.get('chip_id') == chip_id:
                            return line['id']
            
            return "activated"
        else:
            self.log_test("Line Activation", False, f"Activation failed: {response}")
            return None

    def test_lines_management(self, line_id: str) -> bool:
        """Test line management (block/unblock)"""
        if not line_id or line_id == "activated":
            # Try to get any active line for testing
            success, lines = self.make_request('GET', 'linhas')
            if success and lines:
                active_lines = [l for l in lines if l.get('status') == 'ativo']
                if active_lines:
                    line_id = active_lines[0]['id']
                else:
                    self.log_test("Line Management", False, "No active lines found for testing")
                    return False
            else:
                self.log_test("Line Management", False, "Failed to get lines for testing")
                return False
        
        # List lines
        success, lines = self.make_request('GET', 'linhas')
        if success:
            self.log_test("List Lines", True, f"Found {len(lines)} lines")
        else:
            self.log_test("List Lines", False, f"Failed to list lines: {lines}")
            return False
        
        # Get line status
        success, status = self.make_request('GET', f'linhas/{line_id}/status')
        if success:
            self.log_test("Get Line Status", True, f"Status: {status.get('status', 'unknown')}")
        else:
            self.log_test("Get Line Status", False, f"Failed to get status: {status}")
        
        # Try to block line (if it's active)
        success, response = self.make_request('POST', f'linhas/{line_id}/bloquear', {})
        if success and response.get('success'):
            self.log_test("Block Line", True, response.get('message', 'Line blocked'))
            
            # Try to unblock
            success, response = self.make_request('POST', f'linhas/{line_id}/desbloquear', {})
            if success and response.get('success'):
                self.log_test("Unblock Line", True, response.get('message', 'Line unblocked'))
                return True
            else:
                self.log_test("Unblock Line", False, f"Failed to unblock: {response}")
        else:
            # Line might already be blocked or in different state
            self.log_test("Block Line", False, f"Block operation result: {response}")
        
        return False

    def test_operadora_config(self) -> bool:
        """Test operadora configuration endpoint"""
        success, response = self.make_request('GET', 'operadora/config')
        
        if success and 'mode' in response:
            mode = response.get('mode', 'unknown')
            token_configured = response.get('token_configured', False)
            timeout = response.get('timeout', 0)
            endpoints = response.get('endpoints', {})
            
            details = f"Mode: {mode}, Token: {'Yes' if token_configured else 'No'}, Timeout: {timeout}s, Endpoints: {len(endpoints)}"
            self.log_test("Operadora Config", True, details)
            return True
        else:
            self.log_test("Operadora Config", False, f"Failed to get config: {response}")
            return False

    def test_operadora_connection(self) -> bool:
        """Test operadora connection test endpoint"""
        success, response = self.make_request('POST', 'operadora/test', {})
        
        if success and 'mode' in response:
            mode = response.get('mode', 'unknown')
            test_success = response.get('test_success', False)
            response_time = response.get('response_time_ms', 0)
            message = response.get('message', '')
            
            details = f"Mode: {mode}, Test Success: {test_success}, Response Time: {response_time}ms, Message: {message}"
            self.log_test("Operadora Connection Test", True, details)
            return True
        else:
            self.log_test("Operadora Connection Test", False, f"Failed to test connection: {response}")
            return False

    def test_logs(self) -> bool:
        """Test system logs with detailed API logging"""
        success, logs = self.make_request('GET', 'logs')
        
        if success and isinstance(logs, list):
            self.log_test("Get Logs", True, f"Found {len(logs)} log entries")
            
            # Check for API logs with detailed request/response
            api_logs = [l for l in logs if l.get('api_request') or l.get('api_response')]
            if api_logs:
                self.log_test("API Logs Found", True, f"Found {len(api_logs)} logs with API details")
                
                # Check for mock indicators
                mock_logs = [l for l in api_logs if l.get('is_mock') is not None]
                if mock_logs:
                    mock_count = len([l for l in mock_logs if l.get('is_mock')])
                    real_count = len(mock_logs) - mock_count
                    self.log_test("Mock/Real Indicators", True, f"Mock: {mock_count}, Real: {real_count}")
                else:
                    self.log_test("Mock/Real Indicators", False, "No mock/real indicators found in logs")
            else:
                self.log_test("API Logs Found", False, "No logs with API request/response details found")
            
            # Test filtered logs
            success, filtered_logs = self.make_request('GET', 'logs?action=login')
            if success:
                login_logs = [l for l in filtered_logs if l.get('action') == 'login']
                self.log_test("Filter Logs", True, f"Found {len(login_logs)} login logs")
            else:
                self.log_test("Filter Logs", False, f"Failed to filter logs: {filtered_logs}")
            
            # Test operadora action logs
            success, operadora_logs = self.make_request('GET', 'logs?action=ativacao')
            if success:
                activation_logs = [l for l in operadora_logs if l.get('action') == 'ativacao']
                self.log_test("Operadora Action Logs", True, f"Found {len(activation_logs)} activation logs")
            else:
                self.log_test("Operadora Action Logs", False, f"Failed to get operadora logs: {operadora_logs}")
            
            return True
        else:
            self.log_test("Get Logs", False, f"Failed to get logs: {logs}")
            return False

    def test_auth_logout(self) -> bool:
        """Test logout"""
        success, response = self.make_request('POST', 'auth/logout', {})
        
        if success:
            self.log_test("Logout", True, "Logged out successfully")
            return True
        else:
            self.log_test("Logout", False, f"Logout failed: {response}")
            return False

    def run_all_tests(self) -> Dict:
        """Run all backend tests"""
        print("🚀 Starting MVNO Backend API Tests")
        print("=" * 50)
        
        # Authentication tests
        if not self.test_auth_login():
            print("❌ Authentication failed - stopping tests")
            return self.get_summary()
        
        self.test_auth_me()
        
        # Operadora service tests (admin required)
        print("\n🔧 Testing Operadora Service...")
        self.test_operadora_config()
        self.test_operadora_connection()
        
        # Dashboard tests
        stats = self.test_dashboard_stats()
        
        # CRUD tests
        client_id = self.test_clients_crud()
        chip_id = self.test_chips_crud()
        plan_id = self.test_plans_crud()
        
        # Line activation and management (uses OperadoraService)
        print("\n📱 Testing Line Management with OperadoraService...")
        line_id = None
        if client_id and chip_id and plan_id:
            line_id = self.test_line_activation(client_id, chip_id, plan_id)
        
        if line_id:
            self.test_lines_management(line_id)
        
        # System logs (should now include detailed API logs)
        print("\n📋 Testing Detailed Logging...")
        self.test_logs()
        
        # Logout
        self.test_auth_logout()
        
        return self.get_summary()

    def get_summary(self) -> Dict:
        """Get test summary"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        summary = {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "test_results": self.test_results
        }
        
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.tests_run - self.tests_passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['details']}")
        
        return summary

def main():
    """Main test execution"""
    tester = MVNOAPITester()
    summary = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if summary['failed_tests'] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())