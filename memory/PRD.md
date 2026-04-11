# PRD - Sistema MVNO Manager - HomeOn Internet

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react
- **Backend**: FastAPI (Python) + slowapi (rate limiting)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=lax)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - producao)

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
- **Atendente**: carlos@mvno.com / nova456
- **Admin (producao)**: ailtonhomeon@gmail.com / gi157258
- **Admin (producao)**: elizpestilho@gmail.com / eliz22
- **Portal Adriana**: CPF 23211311874 / Tel 19920090179

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
- [x] Botao "Reparar Dados" na pagina de Clientes

### Seguranca e Backup (11/04/2026)
- [x] **Rate Limiting** (slowapi): 10 req/min nos endpoints de login (admin e portal)
- [x] **Bloqueio Progressivo de Login**: 5 falhas=15min, 10=1h, 15+=24h com log de seguranca
- [x] **Security Headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS
- [x] **Confirmacao de Senha p/ Acoes Destrutivas**: Todas as rotas DELETE exigem X-Confirm-Token (token JWT de 10min obtido via POST /api/auth/confirm-password)
- [x] **ConfirmPasswordDialog**: Modal reutilizavel integrado em 8 paginas (Clientes, Chips, Planos, Ofertas, Usuarios, GestaoCobrancas, CarteiraMovel, Revendedores)
- [x] **Backup Pre-Deploy**: Script atualizar-vps.sh faz backup automatico do MongoDB antes de aplicar atualizacoes
- [x] **Backup Diario**: Script backup-mvno.sh para cron (3:00 AM), retencao de 10 backups
- [x] **Restauracao Rapida**: Script restaurar-backup.sh para restaurar banco + backend a partir de qualquer backup
- [x] **Setup Cron**: Script setup-backup-cron.sh para configurar backup automatico na VPS

## Scripts de Deploy/Backup
- `/deploy/atualizar-vps.sh` - Deploy com backup pre-deploy automatico
- `/deploy/backup-mvno.sh` - Backup manual ou via cron
- `/deploy/restaurar-backup.sh` - Restauracao de backup
- `/deploy/setup-backup-cron.sh` - Configurar cron para backup diario

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom
- [ ] Desmembrar server.py (4200+ linhas) em roteadores separados

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
