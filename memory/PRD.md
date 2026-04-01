# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom para ativacao, consulta, bloqueio/desbloqueio e alteracao de planos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies
- **Integracao**: OperadoraService com padrao Adapter (Mock/Real Ta Telecom)

## Modelo de Dados

### Planos (Tecnicos)
- id, nome, franquia, descricao, **plan_code** (codigo na Ta Telecom), created_at

### Ofertas (Comerciais)
- id, nome, plano_id, valor, descricao, ativo, created_at

### Clientes (Expandido para Ta Telecom)
- id, nome, **tipo_pessoa** (pf/pj), **documento** (CPF/CNPJ), telefone
- **data_nascimento**, **cep**, **endereco**, **numero_endereco**
- **bairro**, **cidade**, **estado**, **city_code**, **complemento**
- status, **dados_completos** (calculado), created_at

### Chips
- id, iccid, status (disponivel/reservado/ativado/bloqueado/cancelado)
- oferta_id, cliente_id, **msisdn**, created_at

### Linhas
- id, numero, status, cliente_id, chip_id, plano_id, oferta_id, msisdn, created_at

## OperadoraService - Integracao Ta Telecom

### Metodos
- listarPlanos() - GET /planos?user_token={token}
- listarEstoque() - GET /estoque/listar?user_token={token}
- ativarChip(iccid, payload) - POST /simcard/{iccid}/ativar?user_token={token}
- consultarLinha(iccid) - GET /estoque/{iccid}?user_token={token}
- bloquearParcial(iccid) - POST /simcard/{iccid}/bloquear/parcial
- bloquearTotal(iccid, reason) - POST /simcard/{iccid}/bloquear/total
- desbloquear(iccid) - POST /simcard/{iccid}/desbloquear
- alterarPlano(iccid, plan_code) - POST /simcard/{iccid}/plano/alterar

### Configuracao (.env)
```
USE_MOCK_API=true
TATELECOM_API_URL=http://sistema.tatelecom.com.br/api/public
TATELECOM_USER_TOKEN=
TATELECOM_TIMEOUT=30
```

### Mapeamento Status Estoque
- 1 = disponivel
- 2 = cancelado
- 3 = ativado

### Motivos Bloqueio Total
- 1 = Roubo
- 2 = Perda
- 3 = Uso indevido
- 4 = Inadimplencia
- 5 = Suspensao temporaria

## Endpoints da API

### Auth
- POST /api/auth/login, /api/auth/register, /api/auth/logout
- GET /api/auth/me, POST /api/auth/refresh

### Clientes (expandido)
- GET/POST /api/clientes, GET/PUT/DELETE /api/clientes/{id}
- Validacao: CPF, CNPJ, CEP, dados_completos

### Planos (com plan_code)
- GET/POST /api/planos, PUT/DELETE /api/planos/{id}

### Ofertas
- GET/POST /api/ofertas, GET/PUT/DELETE /api/ofertas/{id}

### Chips (com msisdn)
- GET/POST /api/chips, DELETE /api/chips/{id}

### Ativacao
- POST /api/ativacao (cliente_id + chip_id)
  - Valida dados completos do cliente
  - Valida plan_code no plano vinculado
  - Monta payload completo para Ta Telecom

### Linhas
- GET /api/linhas
- GET /api/linhas/{id}/consultar (consulta operadora)
- POST /api/linhas/{id}/bloquear-parcial
- POST /api/linhas/{id}/bloquear-total (body: {reason: 1-5})
- POST /api/linhas/{id}/desbloquear
- POST /api/linhas/{id}/alterar-plano (body: {oferta_id})

### Operadora
- POST /api/operadora/sincronizar-planos
- POST /api/operadora/sincronizar-estoque
- GET /api/operadora/config
- POST /api/operadora/test
- GET /api/operadora/motivos-bloqueio

## Credenciais
- **Admin**: admin@mvno.com / admin123

## Implementado

### MVP Inicial (31/03/2026)
- [x] JWT Auth, dark theme, CRUD completo

### OperadoraService v2 (31/03/2026)
- [x] Interface com Mock/Real adapters

### Reestruturacao Planos vs Ofertas (01/04/2026)
- [x] Separacao tecnico/comercial, ativacao automatica

### Integracao Ta Telecom (01/04/2026)
- [x] OperadoraService reescrito para API Ta Telecom
- [x] Modelo cliente expandido (endereco, DOB, tipo_pessoa)
- [x] plan_code nos planos, msisdn nos chips
- [x] Sincronizacao de planos e estoque
- [x] Ativacao com validacao de dados completos
- [x] Bloqueio parcial e total com motivos
- [x] Desbloqueio e alteracao de plano
- [x] Consulta de linha via operadora
- [x] Validacao CPF/CNPJ/CEP
- [x] Frontend completo com formularios expandidos
- [x] Logs detalhados de API
- [x] Backend 100% (23/23 testes), Frontend 100%

## Backlog

### P0 - Configurar Token Real
- [ ] Inserir TATELECOM_USER_TOKEN no .env
- [ ] Mudar USE_MOCK_API=false
- [ ] Testar integracao real

### P1 - Alta Prioridade
- [ ] Leitor de codigo de barras/QR code para ICCID
- [ ] Webhooks para callbacks da operadora
- [ ] Consulta de saldo e consumo (servico preparado)

### P2 - Media Prioridade
- [ ] Historico de ativacoes recentes
- [ ] Dashboard de metricas de API
- [ ] Retry automatico em falhas
- [ ] Cache de consultas
