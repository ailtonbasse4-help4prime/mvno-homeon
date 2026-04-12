# PRD - Sistema MVNO Manager - HomeOn Internet

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react
- **Backend**: FastAPI (Python) + slowapi (rate limiting)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=lax)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - producao), Gmail SMTP (emails)

## Ambiente de Producao (VPS Hostinger)
- Docker: CRM Atendimento (homeon-crm) nas portas 3001/8001 - NAO MEXER
- MVNO Backend: uvicorn na porta 3002 (virtualenv /app/venv)
- MVNO Frontend: Nginx servindo /var/www/mvno/frontend (estatico)
- Nginx config: /etc/nginx/sites-enabled/app-ativacao
- MongoDB: Docker (porta 27017), DB: mvno_management
- DNS: Registro A mvno.homeonapp.com.br -> 187.127.11.235 (Hostinger DNS)
- Deploy: cd /tmp/mvno-homeon && git pull && bash /opt/mvno-homeon/atualizar.sh
- .env VPS: /opt/mvno-homeon/backend/.env (COOKIE_SECURE=true, COOKIE_SAMESITE=lax)

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Admin (producao)**: ailtonhomeon@gmail.com / gi157258
- **Admin (producao)**: elizpestilho@gmail.com / eliz22
- **Portal Adriana**: CPF 23211311874 / Tel 19920090179
- **Gmail SMTP**: homeontelecom@gmail.com (App Password configurada)

## Implementado

### MVP + Integracoes Basicas (31/03 - 01/04/2026)
- [x] JWT Auth, dark theme, CRUD completo

### Carteira Movel + Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro, webhook

### Sincronizacao Clientes Ta Telecom (03/04/2026)
- [x] 94 clientes, 108 linhas, 104 chips sincronizados

### Portal do Cliente v2 Premium (05-09/04/2026)
- [x] Login CPF+telefone, Dashboard com linhas, saldo, consumo, faturas
- [x] PWA instalavel, barra circular de consumo de dados reais

### Ativacao Self-Service + QR Code (04-05/04/2026)
- [x] Pagina publica /ativar com leitor QR Code e ativacao automatica

### Correcoes Producao (10/04/2026)
- [x] DNS, Deploy script, Nginx, CORS, Cookies, Modelos Pydantic defensivos
- [x] ObjectId.is_valid() em todas queries, ErrorBoundary, Service Worker v2

### Reparo de Dados e Rate Limit (11/04/2026)
- [x] Deteccao HTTP 429 no adaptador Ta Telecom
- [x] Sync melhorado: 5 retries, delay 0.6s, backoff exponencial para 429
- [x] Endpoint POST /api/operadora/reparar-clientes (background task)
- [x] Endpoint POST /api/operadora/completar-planos (background task)
- [x] Botao "Reparar Dados" na pagina de Clientes (2 etapas)

### Seguranca e Backup (11/04/2026)
- [x] Rate Limiting (slowapi): 10 req/min nos endpoints de login
- [x] Bloqueio Progressivo de Login: 5 falhas=15min, 10=1h, 15+=24h
- [x] Security Headers: X-Frame-Options DENY, X-Content-Type-Options, HSTS
- [x] Confirmacao de Senha para acoes destrutivas (DELETE)
- [x] ConfirmPasswordDialog integrado em 8 paginas
- [x] Backup Pre-Deploy automatico no atualizar-vps.sh
- [x] Backup Diario via cron (3:00 AM)
- [x] Script restaurar-backup.sh
- [x] Deploy atualizado: instala dependencias Python automaticamente

### Melhorias Visuais (12/04/2026)
- [x] Cards e filtros com bordas visiveis (zinc-500/60)
- [x] Textos de labels mais legiveis (zinc-300)
- [x] Aplicado em todas as 19 paginas

### Ativacao Pos-Deploy (12/04/2026)
- [x] Consulta automatica do numero pos-ativacao na Ta Telecom
- [x] Numero atribuido automaticamente apos ativar chip

### Cartao de Ativacao 8x5cm (12/04/2026)
- [x] Layout compacto: QR Code + 6 passos de ativacao
- [x] Logo HomeOn Internet, ICCID, telefone de ajuda
- [x] Impressao individual ou em lote, 10 cartoes por folha A4
- [x] Passo 4 atualizado: "Clique em Pagar e Ativar"
- [x] Info de venda automatica: Revendedor (desconto) ou Shopee (inclusa)
- [x] Contato e URL em negrito/azul, empilhados centralizado

### Retry Automatico de Ativacoes (12/04/2026)
- [x] Deteccao inteligente de erros retentaveis (timeout, 429, server error, connection)
- [x] Backoff progressivo: 2min, 5min, 15min, 30min, 1h (max 5 tentativas)
- [x] Background worker asyncio verificando fila a cada 2 minutos
- [x] Endpoint GET /api/retry-queue com stats e config
- [x] Endpoint POST /api/ativacoes-selfservice/{id}/retry para retry manual
- [x] UI atualizada: card Retry Pendente, botao Retentar, info expandivel

### Email via Gmail SMTP (12/04/2026)
- [x] Servico de email: /backend/services/email_service.py
- [x] Templates HTML personalizados com marca HomeOn (cobranca, ativacao, lembrete)
- [x] Envio automatico ao criar cobranca (boleto/PIX com link de pagamento)
- [x] Envio automatico ao ativar chip (admin e self-service)
- [x] Endpoint GET /api/email/config e POST /api/email/test
- [x] Card de configuracao na Carteira Movel com teste de email
- [x] Badge "Email Ativo" no header

## Scripts de Deploy/Backup
- /deploy/atualizar-vps.sh - Deploy com backup pre-deploy + pip install
- /deploy/backup-mvno.sh - Backup manual ou via cron
- /deploy/restaurar-backup.sh - Restauracao de backup
- /deploy/setup-backup-cron.sh - Configurar cron backup diario

## Backlog

### P1 - Alta Prioridade
- [ ] Desmembrar server.py (4600+ linhas) em roteadores separados

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
