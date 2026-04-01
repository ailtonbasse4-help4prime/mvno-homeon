# PRD - Sistema MVNO Manager

## Problema Original
Criar um sistema web completo para gestão de telefonia móvel (MVNO), independente de qualquer ERP externo, com backend próprio e preparado para integração com API de operadora (como Surf Telecom).

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticação**: JWT com httpOnly cookies
- **Integração**: OperadoraService com padrão Adapter (Mock/Real)

## Modelo de Dados (Planos vs Ofertas)

### Planos (Técnicos - sem valor comercial)
- id, nome, franquia, descricao, created_at
- Exemplo: "Plano 10GB" com franquia "10GB"

### Ofertas (Comerciais - com valor)
- id, nome, plano_id (referência ao plano técnico), valor, descricao, ativo, created_at
- Exemplo: "Chip 10GB Essencial" R$ 49,90 vinculado ao "Plano 10GB"

### Chips (vinculados a Ofertas)
- id, iccid, status, oferta_id (obrigatório), cliente_id, created_at
- Cada chip DEVE estar vinculado a uma oferta

### Ativação (automatizada)
- Entrada: cliente_id + chip_id (SEM plano_id manual)
- O sistema detecta automaticamente: chip -> oferta -> plano
- Resultado: linha criada com número, status, oferta e plano

## OperadoraService - Arquitetura

### Estrutura
```
/app/backend/services/operadora_service.py
├── IOperadoraAdapter (Interface abstrata)
├── MockOperadoraAdapter (Para desenvolvimento/testes)
├── RealOperadoraAdapter (Para produção - HTTP com httpx)
└── OperadoraService (Serviço principal com logs)
```

### Configuração (.env)
```
USE_MOCK_API="true"
OPERADORA_API_URL="https://api.surftelecom.com.br"
OPERADORA_API_TOKEN=""
OPERADORA_TIMEOUT="30"
```

## Endpoints da API

### Auth
- POST /api/auth/login, /api/auth/register, /api/auth/logout
- GET /api/auth/me, POST /api/auth/refresh

### Planos (técnicos)
- GET/POST /api/planos, PUT/DELETE /api/planos/{id}

### Ofertas (comerciais)
- GET/POST /api/ofertas, GET/PUT/DELETE /api/ofertas/{id}

### Chips
- GET/POST /api/chips, DELETE /api/chips/{id}

### Ativação
- POST /api/ativacao (cliente_id + chip_id)

### Linhas
- GET /api/linhas, GET /api/linhas/{id}/status
- POST /api/linhas/{id}/bloquear, POST /api/linhas/{id}/desbloquear

### Logs, Dashboard, Operadora
- GET /api/logs, GET /api/dashboard/stats
- GET /api/operadora/config, POST /api/operadora/test

## Credenciais de Teste
- **Admin**: admin@mvno.com / admin123

## O que foi implementado

### MVP Inicial (31/03/2026)
- [x] JWT Auth com cookies httpOnly + brute force protection
- [x] CRUD completo: Clientes, Chips, Planos
- [x] Sistema de ativação de linhas
- [x] Gerenciamento de linhas (bloquear/desbloquear)
- [x] Logs detalhados com payloads de API
- [x] Dashboard com estatísticas
- [x] IccidInput inteligente com autocomplete

### OperadoraService v2 (31/03/2026)
- [x] Interface abstrata com Mock e Real adapters
- [x] Configuração via .env
- [x] Tratamento completo de erros
- [x] Logs de API com tempo de resposta

### Reestruturação Planos vs Ofertas (01/04/2026)
- [x] Backend reescrito: Planos (técnico) e Ofertas (comercial)
- [x] Nova página Ofertas CRUD
- [x] Planos sem campo de valor
- [x] Chips vinculados obrigatoriamente a ofertas
- [x] Ativação automática: detecta oferta/plano pelo ICCID
- [x] IccidInput mostra info da oferta nas sugestões
- [x] Dashboard com stats de ofertas
- [x] Testes: Backend 100% (19/19), Frontend 100%

## Backlog

### P1 - Alta Prioridade
- [ ] Leitor de código de barras/QR code para ICCID na ativação
- [ ] Webhooks para callbacks da operadora (auto-update status)
- [ ] Integração real com Surf Telecom

### P2 - Média Prioridade
- [ ] Histórico de ativações recentes
- [ ] Cache de consultas
- [ ] Rate limiting
- [ ] Dashboard de métricas de API
- [ ] Retry automático em falhas
