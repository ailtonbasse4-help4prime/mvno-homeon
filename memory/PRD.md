# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react + framer-motion
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=None)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - producao)

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456
- **Portal Cliente (teste)**: CPF 02962261493 / Tel 83999056284

## Implementado

### MVP + Integracoes Basicas (31/03 - 01/04/2026)
- [x] JWT Auth, dark theme, CRUD completo

### Carteira Movel + Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro, webhook

### Mobile + Deploy (02/04/2026)
- [x] Layout responsivo, scripts deploy VPS

### Sincronizacao Clientes Ta Telecom (03/04/2026)
- [x] 94 clientes, 108 linhas, 104 chips sincronizados

### Gestao de Cobrancas + Revendedores (04/04/2026)
- [x] Integracao real Asaas producao + Revendedores

### Ativacao Self-Service + QR Code (04-05/04/2026)
- [x] Pagina publica /ativar com leitor QR Code e ativacao automatica

### Portal do Cliente (05/04/2026)
- [x] Login CPF+telefone, Dashboard com linhas, saldo, consumo, faturas

### Portabilidade de Numero (05/04/2026)
- [x] Toggle portabilidade no admin e self-service

### Confiabilidade Asaas - Sync Status (06/04/2026)
- [x] Sync automatico de status no Portal do Cliente (consulta Asaas em tempo real ao abrir dashboard)
- [x] Endpoint POST /api/carteira/sincronizar-status (admin) para sincronizar todas cobrancas pendentes
- [x] Botao "Sincronizar Status" na pagina Gestao de Cobrancas
- [x] Status RECEIVED_IN_CASH adicionado nos labels e badges
- [x] Campo paid_at salvo quando pagamento confirmado
- [x] Campos asaas_bankslip_url e paid_at no retorno do portal

### Correcoes Criticas (07/04/2026)
- [x] Fix MockTaTelecomAdapter.ativar_chip (corrupcao do agente anterior corrigida)
- [x] Busca automatica de CEP via ViaCEP no formulario de Clientes (Clientes.jsx)
- [x] Paginacao de estoque Ta Telecom validada (525 chips sincronizados vs. 50 anterior)
- [x] Fix Enter no campo CEP nao submete mais o formulario
- [x] FIX DEFINITIVO Asaas API Key: leitura raw do .env (imune a corrupcao por $ do shell/dotenv), validacao robusta, load_dotenv(interpolate=False), aspas simples, endpoint de diagnostico
- [x] Botao "Diagnostico da Conexao" na tela de Cobrancas > API Asaas

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes

### Refatoracao
- [ ] Desmembrar server.py (3400+ linhas) em roteadores separados
