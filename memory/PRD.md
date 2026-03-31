# PRD - Sistema MVNO Manager

## Problema Original
Criar um sistema web completo para gestão de telefonia móvel (MVNO), independente de qualquer ERP externo, com backend próprio e preparado para integração com API de operadora (como Surf Telecom).

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticação**: JWT com httpOnly cookies
- **Serviço de Operadora**: OperadoraService isolado (mock/real)

## Personas
1. **Administrador**: Acesso total ao sistema (CRUD completo, gerenciamento de planos)
2. **Atendente**: Acesso limitado (consultas, ativações, mas sem exclusões)

## Requisitos Core (Implementados)

### Autenticação ✅
- Login com email e senha
- JWT com cookies httpOnly
- Controle de acesso por role (admin/atendente)
- Proteção contra brute force

### Módulo de Clientes ✅
- Cadastro: Nome, CPF, Telefone, Status
- CRUD completo
- Busca por nome, CPF ou telefone

### Módulo de Chips ✅
- Cadastro de ICCID
- Status: Disponível, Ativado, Bloqueado
- Filtro por status

### Módulo de Planos ✅
- Nome, Valor, Franquia (GB)
- CRUD (apenas admin pode criar/editar/excluir)
- Cards visuais

### Módulo de Ativação ✅
- Seleção de Cliente, Chip e Plano
- Integração com OperadoraService
- Retorna: sucesso, pendente ou erro
- Registra no banco de dados com detalhes da API

### Módulo de Linhas ✅ (MELHORADO)
- Lista linhas com número, cliente, plano, status
- Cards de estatísticas (Total, Ativas, Pendentes, Bloqueadas)
- Consulta de status via API com tempo de resposta
- Botões de Bloqueio/Desbloqueio
- Status com cores: ativo (verde), pendente (amarelo), bloqueado (vermelho), erro (rosa)

### Logs do Sistema ✅ (MELHORADO)
- Registra todas as ações
- Cards de estatísticas (Total, Ativações, Erros, Chamadas API)
- Detalhes completos da requisição e resposta da API
- Indicador MOCK/REAL para cada log
- Tempo de resposta da API

### OperadoraService ✅ (NOVO)
- Serviço isolado em /app/backend/services/operadora_service.py
- Facilita troca entre mock e API real
- Configurável via .env (USE_MOCK_API, OPERADORA_API_URL, OPERADORA_API_TOKEN)
- Mock com probabilidades realistas (70% sucesso, 20% pendente, 10% erro)

## O que foi implementado

### Backend (/app/backend/)
- server.py: 20+ endpoints REST
- services/operadora_service.py: Serviço isolado de integração
- Autenticação JWT completa
- CRUD para todas as entidades
- Logs avançados com request/response

### Frontend (/app/frontend/src/)
- 7 páginas completas
- Tema escuro profissional
- Interface em português do Brasil
- Componentes Shadcn/UI
- Responsivo

## Configuração para API Real

Para usar a API real da Surf Telecom:
1. Editar /app/backend/.env:
   - USE_MOCK_API="false"
   - OPERADORA_API_URL="https://api.surftelecom.com.br"
   - OPERADORA_API_TOKEN="seu-token-aqui"
2. Implementar métodos _real_* em operadora_service.py

## Dados de Teste
- Credenciais: admin@mvno.com / admin123

## Backlog (Próximas Fases)

### P0 - Crítico
- [ ] Integração real com API Surf Telecom
- [ ] Dashboard de métricas avançadas com gráficos

### P1 - Alta Prioridade
- [ ] Suporte a múltiplas empresas (multifilial)
- [ ] Notificações por email/SMS
- [ ] Relatórios exportáveis (PDF/Excel)

### P2 - Média Prioridade
- [ ] Integração com pagamento (PIX)
- [ ] App mobile (React Native)
- [ ] Portal do cliente
- [ ] Recarga online

### P3 - Baixa Prioridade
- [ ] Chat de suporte
- [ ] Integração com WhatsApp
- [ ] Analytics avançados

## Data de Implementação
- MVP Inicial: 31/03/2026
- Melhorias v2: 31/03/2026
