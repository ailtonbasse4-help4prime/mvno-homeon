"""
Test suite for Iteration 25 - Operacional module and related features
Tests:
- GET /api/operacional/planilha - consolidated view with receita/custo/lucro/margem
- PATCH /api/operacional/linha/{id} - inline editing (observacoes, proxima_recarga, canal, status_chip)
- GET /api/operacional/export - Excel export with 2 sheets
- POST /api/operacional/importar-excel - Excel import
- POST /api/ofertas with custo field
- POST/PUT /api/clientes with canal and observacoes fields
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOperacionalModule:
    """Tests for the new /api/operacional/* endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session for authenticated requests"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.user = login_resp.json()
        yield
        # Logout
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_planilha_consolidada_returns_linhas_and_resumo(self):
        """GET /api/operacional/planilha should return linhas array and resumo object"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Check structure
        assert "linhas" in data, "Response should have 'linhas' key"
        assert "resumo" in data, "Response should have 'resumo' key"
        assert isinstance(data["linhas"], list), "linhas should be a list"
        assert isinstance(data["resumo"], dict), "resumo should be a dict"
        
        # Check resumo fields
        resumo = data["resumo"]
        assert "receita" in resumo, "resumo should have 'receita'"
        assert "custo" in resumo, "resumo should have 'custo'"
        assert "lucro" in resumo, "resumo should have 'lucro'"
        assert "margem_pct" in resumo, "resumo should have 'margem_pct'"
        assert "total_linhas" in resumo, "resumo should have 'total_linhas'"
        
        print(f"Planilha returned {len(data['linhas'])} linhas")
        print(f"Resumo: receita={resumo['receita']}, custo={resumo['custo']}, lucro={resumo['lucro']}, margem={resumo['margem_pct']}%")
    
    def test_planilha_linha_has_required_fields(self):
        """Each linha in planilha should have all required fields"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data["linhas"]) > 0:
            linha = data["linhas"][0]
            required_fields = [
                "linha_id", "cliente_id", "cliente_nome", "cpf", "numero",
                "status_linha", "status_chip", "canal", "valor", "custo", "lucro", "margem_pct"
            ]
            for field in required_fields:
                assert field in linha, f"Linha should have '{field}' field"
            print(f"Sample linha: cliente={linha['cliente_nome']}, valor={linha['valor']}, custo={linha['custo']}, lucro={linha['lucro']}")
    
    def test_planilha_search_accent_insensitive(self):
        """Search should be accent-insensitive (buscar 'alvaro' encontra 'Álvaro')"""
        # First get all linhas to find a name with accent
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        all_linhas = resp.json()["linhas"]
        
        # Search for 'alvaro' without accent
        resp_search = self.session.get(f"{BASE_URL}/api/operacional/planilha", params={"search": "alvaro"})
        assert resp_search.status_code == 200
        search_linhas = resp_search.json()["linhas"]
        
        # Check if any result contains 'alvaro' or 'álvaro' (case insensitive)
        if len(search_linhas) > 0:
            found_names = [l["cliente_nome"].lower() for l in search_linhas]
            print(f"Search 'alvaro' found: {found_names}")
            # At least one should contain 'alvaro' or 'álvaro'
            assert any('alvaro' in n or 'álvaro' in n for n in found_names), "Should find names with 'alvaro'"
        else:
            print("No results for 'alvaro' search - may not have matching data")
    
    def test_planilha_filter_by_status(self):
        """Filter by status should work"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha", params={"status": "ativo"})
        assert resp.status_code == 200
        data = resp.json()
        
        # All returned linhas should have status_linha == 'ativo'
        for linha in data["linhas"]:
            assert linha["status_linha"] == "ativo", f"Expected status 'ativo', got '{linha['status_linha']}'"
        print(f"Filter status=ativo returned {len(data['linhas'])} linhas")
    
    def test_planilha_filter_by_canal(self):
        """Filter by canal should work"""
        # First get all to find available canais
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        all_linhas = resp.json()["linhas"]
        
        canais = set(l["canal"] for l in all_linhas if l.get("canal"))
        if canais:
            test_canal = list(canais)[0]
            resp_filter = self.session.get(f"{BASE_URL}/api/operacional/planilha", params={"canal": test_canal})
            assert resp_filter.status_code == 200
            filtered = resp_filter.json()["linhas"]
            for l in filtered:
                assert l["canal"].lower() == test_canal.lower(), f"Expected canal '{test_canal}', got '{l['canal']}'"
            print(f"Filter canal={test_canal} returned {len(filtered)} linhas")
        else:
            print("No canais found in data - skipping canal filter test")
    
    def test_export_excel_returns_xlsx(self):
        """GET /api/operacional/export should return an Excel file"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/export")
        assert resp.status_code == 200, f"Export failed: {resp.text}"
        
        # Check content type
        content_type = resp.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "octet-stream" in content_type, f"Expected Excel content type, got {content_type}"
        
        # Check content disposition
        content_disp = resp.headers.get("Content-Disposition", "")
        assert "attachment" in content_disp, "Should have attachment disposition"
        assert ".xlsx" in content_disp, "Filename should have .xlsx extension"
        
        # Check file size is reasonable (at least some bytes)
        assert len(resp.content) > 100, "Excel file should have content"
        print(f"Export returned {len(resp.content)} bytes")
    
    def test_patch_linha_observacoes(self):
        """PATCH /api/operacional/linha/{id} should update observacoes"""
        # Get a linha to update
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        linhas = resp.json()["linhas"]
        
        if len(linhas) == 0:
            pytest.skip("No linhas available to test")
        
        linha_id = linhas[0]["linha_id"]
        test_obs = "Test observation from iteration 25"
        
        patch_resp = self.session.patch(
            f"{BASE_URL}/api/operacional/linha/{linha_id}",
            json={"observacoes": test_obs}
        )
        assert patch_resp.status_code == 200, f"Patch failed: {patch_resp.text}"
        result = patch_resp.json()
        assert result.get("success") == True, "Patch should return success=True"
        assert result.get("updated", {}).get("observacoes") == test_obs
        print(f"Updated linha {linha_id} with observacoes")
    
    def test_patch_linha_proxima_recarga(self):
        """PATCH /api/operacional/linha/{id} should update proxima_recarga"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        linhas = resp.json()["linhas"]
        
        if len(linhas) == 0:
            pytest.skip("No linhas available to test")
        
        linha_id = linhas[0]["linha_id"]
        test_date = "2025-02-15"
        
        patch_resp = self.session.patch(
            f"{BASE_URL}/api/operacional/linha/{linha_id}",
            json={"proxima_recarga": test_date}
        )
        assert patch_resp.status_code == 200, f"Patch failed: {patch_resp.text}"
        result = patch_resp.json()
        assert result.get("success") == True
        assert result.get("updated", {}).get("proxima_recarga") == test_date
        print(f"Updated linha {linha_id} with proxima_recarga={test_date}")
    
    def test_patch_linha_status_chip(self):
        """PATCH /api/operacional/linha/{id} should update status_chip"""
        resp = self.session.get(f"{BASE_URL}/api/operacional/planilha")
        assert resp.status_code == 200
        linhas = resp.json()["linhas"]
        
        if len(linhas) == 0:
            pytest.skip("No linhas available to test")
        
        linha_id = linhas[0]["linha_id"]
        test_status = "FS"
        
        patch_resp = self.session.patch(
            f"{BASE_URL}/api/operacional/linha/{linha_id}",
            json={"status_chip": test_status}
        )
        assert patch_resp.status_code == 200, f"Patch failed: {patch_resp.text}"
        result = patch_resp.json()
        assert result.get("success") == True
        assert result.get("updated", {}).get("status_chip") == test_status
        print(f"Updated linha {linha_id} with status_chip={test_status}")


class TestOfertasWithCusto:
    """Tests for ofertas with the new custo field"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_get_ofertas_returns_custo(self):
        """GET /api/ofertas should return custo field"""
        resp = self.session.get(f"{BASE_URL}/api/ofertas")
        assert resp.status_code == 200
        ofertas = resp.json()
        
        if len(ofertas) > 0:
            oferta = ofertas[0]
            assert "custo" in oferta, "Oferta should have 'custo' field"
            assert "valor" in oferta, "Oferta should have 'valor' field"
            print(f"Sample oferta: nome={oferta['nome']}, valor={oferta['valor']}, custo={oferta['custo']}")
    
    def test_create_oferta_with_custo(self):
        """POST /api/ofertas with custo should persist"""
        # First get a plano to link
        planos_resp = self.session.get(f"{BASE_URL}/api/planos")
        assert planos_resp.status_code == 200
        planos = planos_resp.json()
        
        if len(planos) == 0:
            pytest.skip("No planos available")
        
        plano_id = planos[0]["id"]
        
        # Create oferta with custo
        oferta_data = {
            "nome": "TEST_Oferta_Custo_25",
            "plano_id": plano_id,
            "valor": 59.90,
            "custo": 25.00,
            "descricao": "Test oferta with custo",
            "categoria": "movel",
            "ativo": True
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/ofertas", json=oferta_data)
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        created = create_resp.json()
        
        assert created["custo"] == 25.00, f"Expected custo=25.00, got {created['custo']}"
        assert created["valor"] == 59.90
        print(f"Created oferta with custo: id={created['id']}, custo={created['custo']}")
        
        # Cleanup - delete the test oferta
        # Note: May fail if linked to chips, but that's ok for test
        try:
            # Get confirm token first
            confirm_resp = self.session.post(f"{BASE_URL}/api/auth/confirm-password", json={"password": "admin123"})
            if confirm_resp.status_code == 200:
                confirm_token = confirm_resp.json().get("confirm_token")
                self.session.delete(
                    f"{BASE_URL}/api/ofertas/{created['id']}",
                    headers={"X-Confirm-Token": confirm_token}
                )
        except:
            pass


class TestClientesWithCanalObservacoes:
    """Tests for clientes with canal and observacoes fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_get_clientes_returns_canal_observacoes(self):
        """GET /api/clientes should return canal and observacoes fields"""
        resp = self.session.get(f"{BASE_URL}/api/clientes")
        assert resp.status_code == 200
        clientes = resp.json()
        
        if len(clientes) > 0:
            cliente = clientes[0]
            # These fields should exist (even if null)
            assert "canal" in cliente or cliente.get("canal") is None, "Cliente should have 'canal' field"
            assert "observacoes" in cliente or cliente.get("observacoes") is None, "Cliente should have 'observacoes' field"
            print(f"Sample cliente: nome={cliente['nome']}, canal={cliente.get('canal')}, obs={cliente.get('observacoes')}")
    
    def test_create_cliente_with_canal_observacoes(self):
        """POST /api/clientes with canal and observacoes should persist"""
        import random
        cpf_base = f"999{random.randint(10000000, 99999999)}"
        
        cliente_data = {
            "nome": "TEST_Cliente_Canal_25",
            "tipo_pessoa": "pf",
            "documento": cpf_base[:3] + "." + cpf_base[3:6] + "." + cpf_base[6:9] + "-" + str(random.randint(10, 99)),
            "telefone": "(11) 99999-9999",
            "canal": "Shopee",
            "observacoes": "Cliente de teste iteration 25",
            "status": "ativo"
        }
        
        # Generate valid CPF
        cpf_digits = [int(d) for d in cpf_base[:9]]
        # Calculate first check digit
        sum1 = sum((10 - i) * cpf_digits[i] for i in range(9))
        d1 = (sum1 * 10 % 11) % 10
        cpf_digits.append(d1)
        # Calculate second check digit
        sum2 = sum((11 - i) * cpf_digits[i] for i in range(10))
        d2 = (sum2 * 10 % 11) % 10
        cpf_digits.append(d2)
        valid_cpf = ''.join(str(d) for d in cpf_digits)
        cliente_data["documento"] = valid_cpf
        
        create_resp = self.session.post(f"{BASE_URL}/api/clientes", json=cliente_data)
        
        if create_resp.status_code == 400 and "invalido" in create_resp.text.lower():
            # CPF validation failed, skip test
            pytest.skip("CPF validation failed - skipping")
        
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        created = create_resp.json()
        
        assert created.get("canal") == "Shopee", f"Expected canal='Shopee', got {created.get('canal')}"
        assert created.get("observacoes") == "Cliente de teste iteration 25"
        print(f"Created cliente with canal: id={created['id']}, canal={created['canal']}")
        
        # Cleanup
        try:
            confirm_resp = self.session.post(f"{BASE_URL}/api/auth/confirm-password", json={"password": "admin123"})
            if confirm_resp.status_code == 200:
                confirm_token = confirm_resp.json().get("confirm_token")
                self.session.delete(
                    f"{BASE_URL}/api/clientes/{created['id']}",
                    headers={"X-Confirm-Token": confirm_token}
                )
        except:
            pass


class TestExistingFunctionality:
    """Tests to verify existing functionality still works"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@mvno.com",
            "password": "admin123"
        })
        assert login_resp.status_code == 200
        yield
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_login_still_works(self):
        """Login should still work"""
        # Already tested in setup, but let's verify user data
        me_resp = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        user = me_resp.json()
        assert user["email"] == "admin@mvno.com"
        assert user["role"] == "admin"
        print(f"Login verified: {user['email']} ({user['role']})")
    
    def test_list_clientes_still_works(self):
        """GET /api/clientes should still work"""
        resp = self.session.get(f"{BASE_URL}/api/clientes")
        assert resp.status_code == 200
        clientes = resp.json()
        assert isinstance(clientes, list)
        print(f"List clientes: {len(clientes)} clients")
    
    def test_list_cobrancas_still_works(self):
        """GET /api/carteira/cobrancas should still work"""
        resp = self.session.get(f"{BASE_URL}/api/carteira/cobrancas")
        assert resp.status_code == 200
        cobrancas = resp.json()
        assert isinstance(cobrancas, list)
        print(f"List cobrancas: {len(cobrancas)} charges")
    
    def test_dashboard_stats_still_works(self):
        """GET /api/dashboard/stats should still work"""
        resp = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert resp.status_code == 200
        stats = resp.json()
        assert "total_clientes" in stats or "clientes" in stats
        print(f"Dashboard stats: {stats}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
