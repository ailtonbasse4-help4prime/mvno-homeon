# PRD - Sistema MVNO Manager - HomeOn Internet

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
- MVNO Frontend: Nginx servindo /var/www/mvno/frontend (estatico)
- Nginx config: /etc/nginx/sites-enabled/app-ativacao
- MongoDB: Docker (porta 27017), DB: mvno_management
- Script atualizacao: bash /opt/mvno-homeon/atualizar.sh
- Script backup: bash /opt/mvno-homeon/deploy/backup-mvno.sh
- DNS: Registro A mvno.homeonapp.com.br -> 187.127.11.235 (Hostinger DNS, NAO Cloudflare)

## Deploy VPS
- Script: bash /opt/mvno-homeon/atualizar.sh (NAO toca no Docker CRM)
- O script compila frontend com REACT_APP_BACKEND_URL="" (URLs relativas via Nginx)
- Nginx faz proxy /api/ -> porta 3002 (backend MVNO)
- Backup: bash /opt/mvno-homeon/deploy/backup-mvno.sh
- Backup dir: /opt/backups/mvno/

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456
- **Admin (producao)**: ailtonhomeon@gmail.com / gi157258
- **Portal Cliente (teste)**: CPF 02962261493 / Tel 83999056284
- **Portal Adriana**: CPF 23211311874 / Tel 19920090179

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

### Portal do Cliente v1 (05/04/2026)
- [x] Login CPF+telefone, Dashboard com linhas, saldo, consumo, faturas

### Portabilidade de Numero (05/04/2026)
- [x] Toggle portabilidade no admin e self-service

### Confiabilidade Asaas - Sync Status (06/04/2026)
- [x] Sync automatico de status no Portal do Cliente

### Correcoes Criticas (07/04/2026)
- [x] Fix MockTaTelecomAdapter.ativar_chip, CEP ViaCEP, Asaas API Key, navegacao

### UX e Padronizacao (07/04/2026)
- [x] Campo email, padronizacao tabelas, SearchableSelect

### Controle de Notificacoes Asaas (08/04/2026)
- [x] notificationDisabled: true, botao desabilitar lote

### Portabilidade Self-Service (08/04/2026)
- [x] Fluxo completo portabilidade via QR Code

### Correcao Status + Busca + Backup (09/04/2026)
- [x] Fix mapeamento status sync: pendente->ativo, ok->ativo
- [x] SearchableSelect em Linhas.jsx, busca geral (nome, CPF, ICCID, numero)
- [x] Script backup robusto (deploy/backup-mvno.sh)
- [x] Clientes ordenados alfabeticamente em todas as paginas
- [x] Tabelas Clientes e Chips ajustadas para notebook (whitespace-nowrap, min-w)

### Favicon + Logo + Portal v2 Premium (09/04/2026)
- [x] Favicon e icones PWA configurados com logo HomeOn
- [x] manifest.json para instalacao como app no celular
- [x] Titulo "HomeOn Internet - Telefonia Movel" na aba
- [x] Portal do Assinante v2 redesenhado nivel operadora grande

### Correcoes Robustez Portal + Deploy (10/04/2026)
- [x] Portal login defensivo: try/except em ObjectId, .get() em todos campos, log de erros
- [x] Portal dashboard defensivo: ObjectId.is_valid(), .get() com defaults em cobrancas, created_at type-safe
- [x] Listagem de clientes defensiva: ObjectId.is_valid() em chip_ids e plano_ids
- [x] Fix DNS: CNAME mvno apontava para chip-manager-3.emergent.host (preview) -> Alterado para registro A 187.127.11.235
- [x] Fix deploy script: REACT_APP_BACKEND_URL="" (URLs relativas), proxy Nginx /api -> porta 3002
- [x] Fix Nginx: headers no-cache para HTML, CDN-Cache-Control no-store
- [x] Fix CORS: allow_credentials com origins especificas (nao wildcard)
- [x] Fix dados Adriana: chip_id invalido removido, numero/msisdn corrigido

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom
- [ ] Desmembrar server.py (3800+ linhas) em roteadores separados

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
