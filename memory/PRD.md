# PRD - Sistema MVNO Manager

## Problema Original
Criar um sistema web completo para gestão de telefonia móvel (MVNO), independente de qualquer ERP externo, com backend próprio e preparado para integração com API de operadora (como Surf Telecom).

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticação**: JWT com httpOnly cookies
- **Integração**: OperadoraService com padrão Adapter (Mock/Real)

## OperadoraService - Arquitetura

### Estrutura
```
/app/backend/services/operadora_service.py
├── IOperadoraAdapter (Interface abstrata)
├── MockOperadoraAdapter (Para desenvolvimento/testes)
├── RealOperadoraAdapter (Para produção - HTTP com httpx)
└── OperadoraService (Serviço principal com logs)
```

### Funções Disponíveis
- `ativar_chip(cpf, nome, iccid, plano, ...)` - Ativa chip na operadora
- `consultar_linha(numero)` - Consulta status da linha
- `bloquear_linha(numero, motivo)` - Bloqueia linha
- `desbloquear_linha(numero)` - Desbloqueia linha

### Configuração (.env)
```
USE_MOCK_API="true"           # "true" para mock, "false" para real
OPERADORA_API_URL="https://api.surftelecom.com.br"
OPERADORA_API_TOKEN=""        # Token Bearer
OPERADORA_TIMEOUT="30"        # Timeout em segundos

# Endpoints configuráveis
ENDPOINT_ATIVAR_CHIP="/api/v1/chip/ativar"
ENDPOINT_CONSULTAR_LINHA="/api/v1/linha/status"
ENDPOINT_BLOQUEAR_LINHA="/api/v1/linha/bloquear"
ENDPOINT_DESBLOQUEAR_LINHA="/api/v1/linha/desbloquear"
```

### Tratamento de Erros
- `ERR_TIMEOUT` - Timeout de requisição
- `ERR_CONNECTION` - Erro de conexão
- `ERR_AUTH` - Erro de autenticação (401/403)
- `ERR_NOT_FOUND` - Recurso não encontrado (404)
- `ERR_VALIDATION` - Erro de validação (4xx)
- `ERR_SERVER` - Erro do servidor (5xx)
- `ERR_UNKNOWN` - Erro desconhecido

### Logs Detalhados
Cada chamada registra:
- Endpoint chamado
- Método HTTP
- Payload enviado
- Resposta completa
- Tempo de resposta (ms)
- Código de erro (se houver)
- Indicador mock/real

## Status Suportados
- `ativo` - Linha funcionando
- `pendente` - Aguardando processamento
- `bloqueado` - Linha suspensa
- `erro` - Falha na operação

## Endpoints da API

### Operadora
- `GET /api/operadora/config` - Configuração atual do serviço
- `POST /api/operadora/test` - Testa conexão com operadora

### Core
- Auth: login, logout, register, me, refresh
- Clientes: CRUD completo
- Chips: CRUD (sem update)
- Planos: CRUD (admin only)
- Ativação: POST /api/ativacao
- Linhas: GET, status, bloquear, desbloquear
- Logs: GET com filtros
- Dashboard: stats

## Como Usar API Real

1. Obter credenciais da operadora (Surf Telecom)
2. Editar `/app/backend/.env`:
   ```
   USE_MOCK_API="false"
   OPERADORA_API_URL="https://api.surftelecom.com.br"
   OPERADORA_API_TOKEN="seu-token-bearer"
   ```
3. Reiniciar o backend: `sudo supervisorctl restart backend`
4. Verificar: `GET /api/operadora/config`

## Credenciais de Teste
- **Admin**: admin@mvno.com / admin123

## Backlog

### P0 - Pronto para Produção
- [x] OperadoraService com interface abstrata
- [x] Mock para desenvolvimento
- [x] Real adapter com httpx
- [x] Tratamento completo de erros
- [x] Logs detalhados
- [x] Configuração via .env

### P1 - Alta Prioridade
- [ ] Integração real com Surf Telecom
- [ ] Webhook para callbacks
- [ ] Retry automático em falhas

### P2 - Média Prioridade
- [ ] Cache de consultas
- [ ] Rate limiting
- [ ] Dashboard de métricas de API

## Data de Implementação
- MVP Inicial: 31/03/2026
- OperadoraService v2: 31/03/2026
