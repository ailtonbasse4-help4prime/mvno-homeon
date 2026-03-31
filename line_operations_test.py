#!/usr/bin/env python3
"""
Test specific line operations for MVNO system
"""

import requests
import sys
import json
from datetime import datetime

class LineOperationsTest:
    def __init__(self, base_url: str = "https://chip-manager-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
    def login(self):
        """Login as admin"""
        response = self.session.post(f"{self.base_url}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        return response.status_code == 200
    
    def test_line_activation(self):
        """Test line activation with available resources"""
        print("🔍 Testing Line Activation...")
        
        # Get available clients, chips, and plans
        clients = self.session.get(f"{self.base_url}/api/clientes").json()
        chips = self.session.get(f"{self.base_url}/api/chips").json()
        plans = self.session.get(f"{self.base_url}/api/planos").json()
        
        # Find available resources
        available_chips = [c for c in chips if c['status'] == 'disponivel']
        active_clients = [c for c in clients if c['status'] == 'ativo']
        
        if not available_chips:
            print("❌ No available chips for activation")
            return False
        
        if not active_clients:
            print("❌ No active clients for activation")
            return False
            
        if not plans:
            print("❌ No plans available")
            return False
        
        # Try activation
        activation_data = {
            "cliente_id": active_clients[0]['id'],
            "chip_id": available_chips[0]['id'],
            "plano_id": plans[0]['id']
        }
        
        response = self.session.post(f"{self.base_url}/api/ativacao", json=activation_data)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Activation successful: {result['status']} - {result['message']}")
            if result.get('numero'):
                print(f"   📞 Number assigned: {result['numero']}")
            print(f"   ⏱️ Response time: {result.get('response_time_ms', 'N/A')}ms")
            return True
        else:
            print(f"❌ Activation failed: {response.text}")
            return False
    
    def test_line_operations(self):
        """Test line block/unblock operations"""
        print("\n🔍 Testing Line Operations...")
        
        # Get lines
        lines_response = self.session.get(f"{self.base_url}/api/linhas")
        if lines_response.status_code != 200:
            print("❌ Failed to get lines")
            return False
        
        lines = lines_response.json()
        if not lines:
            print("❌ No lines found")
            return False
        
        print(f"📋 Found {len(lines)} lines")
        
        # Find an active line to test
        active_lines = [l for l in lines if l['status'] == 'ativo']
        if not active_lines:
            print("❌ No active lines found for testing")
            return False
        
        test_line = active_lines[0]
        line_id = test_line['id']
        print(f"🎯 Testing with line: {test_line['numero']} (ID: {line_id})")
        
        # Test status consultation
        status_response = self.session.get(f"{self.base_url}/api/linhas/{line_id}/status")
        if status_response.status_code == 200:
            status_data = status_response.json()
            print(f"✅ Status consultation: {status_data['status']}")
            if status_data.get('saldo_dados'):
                print(f"   📊 Data balance: {status_data['saldo_dados']}")
            print(f"   ⏱️ Response time: {status_data.get('response_time_ms', 'N/A')}ms")
        else:
            print(f"❌ Status consultation failed: {status_response.text}")
        
        # Test block operation
        block_response = self.session.post(f"{self.base_url}/api/linhas/{line_id}/bloquear", json={})
        if block_response.status_code == 200:
            block_data = block_response.json()
            if block_data.get('success'):
                print(f"✅ Block operation: {block_data['message']}")
                print(f"   ⏱️ Response time: {block_data.get('response_time_ms', 'N/A')}ms")
                
                # Test unblock operation
                unblock_response = self.session.post(f"{self.base_url}/api/linhas/{line_id}/desbloquear", json={})
                if unblock_response.status_code == 200:
                    unblock_data = unblock_response.json()
                    if unblock_data.get('success'):
                        print(f"✅ Unblock operation: {unblock_data['message']}")
                        print(f"   ⏱️ Response time: {unblock_data.get('response_time_ms', 'N/A')}ms")
                        return True
                    else:
                        print(f"❌ Unblock failed: {unblock_data}")
                else:
                    print(f"❌ Unblock request failed: {unblock_response.text}")
            else:
                print(f"❌ Block operation failed: {block_data}")
        else:
            print(f"❌ Block request failed: {block_response.text}")
        
        return False
    
    def test_logs_with_api_details(self):
        """Test logs with API request/response details"""
        print("\n🔍 Testing Logs with API Details...")
        
        logs_response = self.session.get(f"{self.base_url}/api/logs?limit=20")
        if logs_response.status_code != 200:
            print("❌ Failed to get logs")
            return False
        
        logs = logs_response.json()
        print(f"📋 Found {len(logs)} recent logs")
        
        # Look for logs with API details
        api_logs = [l for l in logs if l.get('api_request') or l.get('api_response')]
        mock_logs = [l for l in logs if l.get('is_mock') is True]
        real_logs = [l for l in logs if l.get('is_mock') is False]
        
        print(f"🔌 API logs: {len(api_logs)}")
        print(f"🎭 Mock API logs: {len(mock_logs)}")
        print(f"🌐 Real API logs: {len(real_logs)}")
        
        if api_logs:
            print("\n📝 Sample API log details:")
            sample_log = api_logs[0]
            print(f"   Action: {sample_log['action']}")
            print(f"   Details: {sample_log['details']}")
            print(f"   Mock: {sample_log.get('is_mock', 'N/A')}")
            
            if sample_log.get('api_request'):
                req = sample_log['api_request']
                print(f"   Request: {req.get('method', 'N/A')} {req.get('endpoint', 'N/A')}")
            
            if sample_log.get('api_response'):
                resp = sample_log['api_response']
                print(f"   Response: {resp.get('status', 'N/A')} - {resp.get('message', 'N/A')}")
                print(f"   Response time: {resp.get('response_time_ms', 'N/A')}ms")
        
        return len(api_logs) > 0
    
    def run_tests(self):
        """Run all line operation tests"""
        print("🚀 Starting Line Operations Tests")
        print("=" * 50)
        
        if not self.login():
            print("❌ Login failed")
            return False
        
        print("✅ Login successful")
        
        # Run tests
        activation_ok = self.test_line_activation()
        operations_ok = self.test_line_operations()
        logs_ok = self.test_logs_with_api_details()
        
        print("\n" + "=" * 50)
        print("📊 Line Operations Test Summary")
        print("=" * 50)
        print(f"Activation: {'✅' if activation_ok else '❌'}")
        print(f"Block/Unblock: {'✅' if operations_ok else '❌'}")
        print(f"API Logs: {'✅' if logs_ok else '❌'}")
        
        return activation_ok and operations_ok and logs_ok

def main():
    tester = LineOperationsTest()
    success = tester.run_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())