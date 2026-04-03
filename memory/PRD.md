# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom para ativacao, consulta, bloqueio/desbloqueio e alteracao de planos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (secure/samesite configuraveis)
- **Integracao**: OperadoraService com padrao Adapter (Mock/Real Ta Telecom)

## Deploy VPS
- Frontend: Build React servido pelo Nginx (URLs relativas via `REACT_APP_BACKEND_URL || ''`)
- Backend: FastAPI via Systemd + venv Python
- Cookies: COOKIE_SECURE=true e COOKIE_SAMESITE=lax para HTTPS
- Pacote: `/app/deploy/mvno-vps-deploy.tar.gz`

## Perfis de Acesso

### Admin
- Gerenciar usuarios, sincronizar operadora
- Ativar, bloquear, desbloquear linhas, alterar plano
- Gerenciar planos, ofertas e chips
- Ver logs completos

### Atendente
- Cadastrar e editar clientes
- Consultar chips e linhas, ativar linha
- Sem acesso a configuracoes, gestao de usuarios, logs

## Modelo de Dados
- usuarios, clientes, planos, ofertas, chips, linhas
- asaas_cobrancas, asaas_assinaturas
- login_attempts (brute force protection)

## Endpoints da API
- Auth: login, register, logout, me, refresh, change-password
- CRUD: clientes, planos, ofertas, chips, usuarios
- Operacoes: ativacao, ativar-chip, linhas (consultar, bloquear, desbloquear, alterar-plano)
- Carteira: resumo, cobrancas, assinaturas, webhooks
- Dashboard: stats
- Operadora: sincronizar-planos, sincronizar-estoque, config, motivos-bloqueio, test
- Logs

## Seguranca Implementada
- JWT httpOnly cookies com secure/samesite configuraveis via env
- Brute force protection (5 tentativas, 15 min lockout)
- Session timeout 30 min inatividade (frontend)
- Hash bcrypt para senhas
- Role-based access control
- Validacao CPF/CNPJ/CEP
- Audit logs completos
- ErrorBoundary React + safeArray/safeObject

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456

## Implementado

### MVP Inicial (31/03/2026)
- [x] JWT Auth, dark theme, CRUD completo

### OperadoraService v2 (31/03/2026)
- [x] Interface com Mock/Real adapters

### Reestruturacao Planos vs Ofertas (01/04/2026)
- [x] Separacao tecnico/comercial, ativacao automatica

### Integracao Ta Telecom (01/04/2026)
- [x] OperadoraService real, modelo expandido, sincronizacao, bloqueio/desbloqueio

### Hardening Producao (01/04/2026)
- [x] Indicador Mock/Real, payload completo, validacoes

### Seguranca e Controle de Acesso (01/04/2026)
- [x] Perfis admin/atendente, gestao usuarios, brute force, session timeout

### Categorizacao de Ofertas (01/04/2026)
- [x] Campo categoria (movel/m2m), 7 ofertas reais, abas filtro

### Vinculacao de Oferta ao Chip (01/04/2026)
- [x] PUT /api/chips/{chip_id}, Modal vincular oferta

### Carteira Movel - Asaas (01/04/2026)
- [x] AsaasService (sandbox/production), CRUD cobrancas/assinaturas, dashboard, webhook
- [x] MOCK local ativo (aguardando chave real)

### Layout Responsivo Mobile (02/04/2026)
- [x] Menu hamburguer, touch targets 44px, grids adaptivos, dialogs responsivos

### Deploy VPS (02/04/2026)
- [x] Docker + Nginx + Systemd scripts, README_DEPLOY

### Tela Ativar Chip (02/04/2026)
- [x] Pagina /ativar-chip mobile-first com proxy backend

### Programacao Defensiva API (03/04/2026)
- [x] ErrorBoundary React, safeArray/safeObject em todas as 12 paginas
- [x] Testado: 12/12 paginas sem erros

### Fix Login VPS + Deploy Package v2 (03/04/2026)
- [x] CORRIGIDO: Frontend usava URL hardcoded do preview nas chamadas API
- [x] 15 arquivos alterados: `process.env.REACT_APP_BACKEND_URL || ''` (fallback URL relativa)
- [x] Cookies configuraveis: COOKIE_SECURE e COOKIE_SAMESITE via .env
- [x] Build de producao sem URL hardcoded (verificado: 0 ocorrencias)
- [x] Pacote VPS atualizado: /app/deploy/mvno-vps-deploy.tar.gz
- [x] Testado: 100% (login, logout, re-login, 10 paginas, 12 APIs)

## Backlog

### P1 - Alta Prioridade
- [ ] Configurar chave API do Asaas (sandbox/producao)
- [ ] Leitor codigo de barras/QR code para ICCID
- [ ] Webhooks para callbacks da operadora
- [ ] Retry automatico para ativacoes pendentes

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (via Carteira Movel)
- [ ] Historico de ativacoes recentes
- [ ] Consulta de saldo e consumo
- [ ] Dashboard metricas API
- [ ] Pix Automatico (quando disponivel no Asaas)
