# PRD - Sistema MVNO Manager

## Problema Original
Criar um sistema web completo para gestão de telefonia móvel (MVNO), independente de qualquer ERP externo, com backend próprio e preparado para integração com API de operadora (como Surf Telecom).

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticação**: JWT com httpOnly cookies

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
- Integração com API mock de operadora
- Retorna: sucesso, pendente ou erro
- Registra no banco de dados

### Módulo de Linhas ✅
- Lista linhas com número, cliente, plano, status
- Consulta de status via API
- Bloqueio/Desbloqueio

### Logs do Sistema ✅
- Registra todas as ações
- Filtro por tipo de ação
- Data e hora

## O que foi implementado

### Backend (/app/backend/server.py)
- 20+ endpoints REST
- Autenticação JWT completa
- CRUD para todas as entidades
- Mock de API de operadora
- Seed de dados de exemplo
- Logs automáticos

### Frontend (/app/frontend/src/)
- 7 páginas completas
- Tema escuro profissional
- Interface em português do Brasil
- Componentes Shadcn/UI
- Responsivo

### Dados de Exemplo
- 4 clientes
- 5 chips disponíveis
- 4 planos (Básico 5GB, Essencial 10GB, Plus 20GB, Premium 50GB)

## APIs Mock (Operadora)
A integração com operadora está SIMULADA com endpoints mock que retornam:
- 70% sucesso (linha ativa com número)
- 20% pendente (processando)
- 10% erro (falha de comunicação)

**Para integração real**, substituir `MockOperadoraAPI` no server.py pela implementação real da Surf Telecom.

## Backlog (Próximas Fases)

### P0 - Crítico
- [ ] Integração real com API Surf Telecom
- [ ] Dashboard de métricas avançadas

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

## Credenciais de Teste
- **Admin**: admin@mvno.com / admin123

## Data de Implementação
- Início: 31/03/2026
- MVP Completo: 31/03/2026
