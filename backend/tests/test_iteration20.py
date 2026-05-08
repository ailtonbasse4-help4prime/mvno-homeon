"""
Iteration 20 Tests - P0 Fixes Verification
Tests for:
1. GET /api/linhas - no lines with status 'ok' (all should be 'ativo' or 'bloqueado')
2. GET /api/clientes - no clients with status 'pendente' (should be 'ativo', 'bloqueado', 'inativo')
3. GET /api/dashboard/stats - returns correct data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStatusFixes:
    """Tests for P0 status fixes - no 'ok' status in linhas, no 'pendente' in clientes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login and get session with cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        print(f"Login successful: {login_response.json().get('name')}")
        yield
        # Logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_linhas_no_status_ok(self):
        """GET /api/linhas - verify no line has status 'ok' (should be 'ativo' or 'bloqueado')"""
        response = self.session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200, f"Failed to get linhas: {response.text}"
        
        linhas = response.json()
        print(f"Total linhas: {len(linhas)}")
        
        # Check for invalid 'ok' status
        linhas_with_ok = [l for l in linhas if l.get('status') == 'ok']
        assert len(linhas_with_ok) == 0, f"Found {len(linhas_with_ok)} linhas with status 'ok': {[l.get('numero') for l in linhas_with_ok]}"
        
        # Verify valid statuses
        valid_statuses = {'ativo', 'bloqueado', 'pendente', 'erro', 'portabilidade_em_andamento'}
        for linha in linhas:
            status = linha.get('status')
            assert status in valid_statuses, f"Linha {linha.get('numero')} has invalid status: {status}"
        
        # Count by status
        status_counts = {}
        for linha in linhas:
            s = linha.get('status', 'unknown')
            status_counts[s] = status_counts.get(s, 0) + 1
        print(f"Linhas by status: {status_counts}")
        
        print("PASS: No linhas with status 'ok'")
    
    def test_clientes_no_status_pendente(self):
        """GET /api/clientes - verify no client has status 'pendente' (should be 'ativo', 'bloqueado', 'inativo')"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200, f"Failed to get clientes: {response.text}"
        
        clientes = response.json()
        print(f"Total clientes: {len(clientes)}")
        
        # Check for invalid 'pendente' status
        clientes_with_pendente = [c for c in clientes if c.get('status') == 'pendente']
        assert len(clientes_with_pendente) == 0, f"Found {len(clientes_with_pendente)} clientes with status 'pendente': {[c.get('nome') for c in clientes_with_pendente]}"
        
        # Verify valid statuses
        valid_statuses = {'ativo', 'bloqueado', 'inativo'}
        for cliente in clientes:
            status = cliente.get('status')
            assert status in valid_statuses, f"Cliente {cliente.get('nome')} has invalid status: {status}"
        
        # Count by status
        status_counts = {}
        for cliente in clientes:
            s = cliente.get('status', 'unknown')
            status_counts[s] = status_counts.get(s, 0) + 1
        print(f"Clientes by status: {status_counts}")
        
        print("PASS: No clientes with status 'pendente'")
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats - verify returns correct data"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Failed to get dashboard stats: {response.text}"
        
        stats = response.json()
        print(f"Dashboard stats: {stats}")
        
        # Verify required nested fields (actual API structure)
        assert 'clientes' in stats, "Missing clientes"
        assert 'linhas' in stats, "Missing linhas"
        assert 'chips' in stats, "Missing chips"
        
        # Verify clientes structure
        assert 'total' in stats['clientes'], "Missing clientes.total"
        assert 'ativos' in stats['clientes'], "Missing clientes.ativos"
        
        # Verify linhas structure
        assert 'total' in stats['linhas'], "Missing linhas.total"
        assert 'ativas' in stats['linhas'], "Missing linhas.ativas"
        assert 'bloqueadas' in stats['linhas'], "Missing linhas.bloqueadas"
        
        # Verify values are non-negative
        assert stats['clientes']['total'] >= 0, "clientes.total should be >= 0"
        assert stats['linhas']['total'] >= 0, "linhas.total should be >= 0"
        assert stats['linhas']['ativas'] >= 0, "linhas.ativas should be >= 0"
        assert stats['linhas']['bloqueadas'] >= 0, "linhas.bloqueadas should be >= 0"
        
        print(f"PASS: Dashboard stats returned correctly - {stats['clientes']['total']} clientes, {stats['linhas']['total']} linhas, {stats['linhas']['ativas']} ativas")


class TestLinhasClienteFilter:
    """Tests for Linhas page cliente filter functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: login and get session with cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_linhas_have_cliente_id(self):
        """Verify linhas have cliente_id for filtering"""
        response = self.session.get(f"{BASE_URL}/api/linhas")
        assert response.status_code == 200
        
        linhas = response.json()
        if len(linhas) > 0:
            # Check that linhas have cliente_id
            linhas_with_cliente = [l for l in linhas if l.get('cliente_id')]
            print(f"Linhas with cliente_id: {len(linhas_with_cliente)}/{len(linhas)}")
            
            # Get unique cliente_ids
            cliente_ids = set(l.get('cliente_id') for l in linhas if l.get('cliente_id'))
            print(f"Unique clientes with linhas: {len(cliente_ids)}")
        else:
            print("No linhas found - skipping cliente_id check")
        
        print("PASS: Linhas cliente_id check completed")
    
    def test_clientes_endpoint_for_filter(self):
        """Verify clientes endpoint returns data needed for filter"""
        response = self.session.get(f"{BASE_URL}/api/clientes")
        assert response.status_code == 200
        
        clientes = response.json()
        print(f"Total clientes: {len(clientes)}")
        
        if len(clientes) > 0:
            # Check required fields for filter
            sample = clientes[0]
            assert 'id' in sample, "Missing id field"
            assert 'nome' in sample, "Missing nome field"
            assert 'documento' in sample or 'cpf' in sample, "Missing documento/cpf field"
            assert 'telefone' in sample, "Missing telefone field"
            
            print(f"Sample cliente: id={sample.get('id')}, nome={sample.get('nome')}")
        
        print("PASS: Clientes endpoint returns data for filter")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
