# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=None)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - producao)

## Ambiente de Producao (VPS Hostinger)
- Docker: CRM Atendimento (homeon-crm) nas portas 3001/8001 - NAO MEXER
- MVNO Backend: uvicorn na porta 3002 (virtualenv /app/venv)
- MVNO Frontend: Nginx servindo /var/www/mvno/frontend (estático)
- Nginx config: /etc/nginx/sites-enabled/app-ativacao
- MongoDB: Docker (porta 27017), DB: mvno_management
- Script atualizacao: bash /opt/mvno-homeon/atualizar.sh

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
- [x] Sync automatico de status no Portal do Cliente
- [x] Endpoint POST /api/carteira/sincronizar-status (admin)

### Correcoes Criticas (07/04/2026)
- [x] Fix MockTaTelecomAdapter.ativar_chip
- [x] Busca automatica de CEP via ViaCEP
- [x] FIX DEFINITIVO Asaas API Key (leitura raw do .env)
- [x] FIX navegacao travando (removido PageTransition framer-motion)

### UX e Padronizacao (07/04/2026)
- [x] Campo email no cadastro de clientes
- [x] Padronizacao visual de TODAS as tabelas
- [x] Componente SearchableSelect criado e aplicado em Ativacoes, Assinaturas e Cobrancas

### Controle de Notificacoes Asaas (08/04/2026)
- [x] notificationDisabled: true em todo novo cliente criado no Asaas
- [x] Botao "Desabilitar Notificacoes de Todos os Clientes" na config Asaas

### Portabilidade Self-Service (08/04/2026)
- [x] Novo status "portabilidade_em_andamento" diferenciando portabilidade de ativacao normal
- [x] Tela informativa para cliente: aviso SMS, janela de portabilidade, status em tempo real
- [x] Polling inteligente com consulta a Ta Telecom
- [x] Compatibilidade retroativa para ativacoes antigas
- [x] Endpoint POST /api/chips/{iccid}/verificar-portabilidade (admin)
- [x] Endpoint POST /api/chips/{iccid}/resetar (admin - volta chip para disponivel)
- [x] Botao laranja verificar portabilidade na pagina Chips
- [x] Botao vermelho resetar chip na pagina Chips
- [x] Fix ativacao gratuita (valor R$0) - disparo imediato sem esperar pagamento
- [x] Correcao fluxo admin para portabilidade

### Mobile Fix (08/04/2026)
- [x] Removido table-fixed de TODAS as tabelas
- [x] min-w definido por tabela para scroll horizontal correto no mobile

## Deploy VPS
- Script: bash /opt/mvno-homeon/atualizar.sh (NAO toca no Docker CRM)
- Backup CRM: /opt/backups/

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom
- [ ] Desmembrar server.py (3700+ linhas) em roteadores separados
- [ ] Configurar Asaas no .env da VPS (/app/.env)

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
