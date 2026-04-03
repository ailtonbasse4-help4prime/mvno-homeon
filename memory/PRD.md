# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom para ativacao, consulta, bloqueio/desbloqueio e alteracao de planos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=None)
- **Integracao**: OperadoraService com padrao Adapter (Mock/Real Ta Telecom)

## Deploy VPS
- Frontend: Build React servido pelo Nginx (URLs relativas)
- Backend: FastAPI via Systemd + venv Python
- Cookies: COOKIE_SECURE=true e COOKIE_SAMESITE=None para HTTPS
- Pacote: `/app/deploy/mvno-vps-deploy.tar.gz`

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456

## Implementado

### MVP Inicial (31/03/2026)
- [x] JWT Auth, dark theme, CRUD completo

### Integracao Ta Telecom (01/04/2026)
- [x] OperadoraService real, sincronizacao planos/estoque, bloqueio/desbloqueio

### Seguranca e Controle de Acesso (01/04/2026)
- [x] Perfis admin/atendente, brute force, session timeout, audit logs

### Carteira Movel - Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro (MOCK local)

### Layout Responsivo Mobile (02/04/2026)
- [x] Menu hamburguer, touch targets 44px, grids adaptivos

### Programacao Defensiva API (03/04/2026)
- [x] ErrorBoundary, safeArray/safeObject em 12 paginas

### Fix Login VPS + Cookies HTTPS (03/04/2026)
- [x] URLs relativas no build (sem hardcode)
- [x] COOKIE_SECURE=true, COOKIE_SAMESITE=None

### Sincronizacao de Clientes da Ta Telecom (03/04/2026)
- [x] POST /api/operadora/sincronizar-clientes
- [x] Importa clientes dos chips EM USO por CPF (cria ou atualiza)
- [x] Cria linhas com numero, plano, ICCID
- [x] Vincula chips aos clientes
- [x] Botao "Sincronizar Clientes" na pagina Clientes
- [x] Resultado: 75 clientes criados, 86 linhas, 86 chips vinculados
- [x] Sem conflito com ativacoes novas (match por CPF = upsert)

## Backlog

### P1 - Alta Prioridade
- [ ] Configurar chave API do Asaas (sandbox/producao)
- [ ] Leitor codigo de barras/QR code para ICCID
- [ ] Retry automatico para ativacoes pendentes

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (via Carteira Movel)
- [ ] Historico de ativacoes recentes
- [ ] Consulta de saldo e consumo
- [ ] Dashboard metricas API
- [ ] Pix Automatico (quando disponivel no Asaas)
