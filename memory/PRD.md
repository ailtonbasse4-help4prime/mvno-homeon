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
- [x] JWT Auth, dark theme, CRUD completo (clientes, planos, ofertas, chips, linhas)
- [x] OperadoraService real Ta Telecom (ativar, bloquear, desbloquear, alterar plano)
- [x] Perfis admin/atendente, brute force, session timeout, audit logs
- [x] Categorizacao ofertas (movel/m2m), vinculacao oferta ao chip

### Carteira Movel + Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro, webhook

### Mobile + Deploy (02/04/2026)
- [x] Layout responsivo, menu hamburguer
- [x] Scripts deploy VPS (Nginx + Systemd)

### Programacao Defensiva + Fix Login VPS (03/04/2026)
- [x] ErrorBoundary, safeArray/safeObject em todas as paginas
- [x] URLs relativas no build, cookies HTTPS configuraveis

### Sincronizacao Clientes Ta Telecom (03/04/2026)
- [x] POST /api/operadora/sincronizar-clientes (ativos + bloqueados)
- [x] 94 clientes, 108 linhas, 104 chips sincronizados

### Gestao de Cobrancas + Revendedores (04/04/2026)
- [x] Integracao real Asaas (producao)
- [x] Pagina Gestao de Cobrancas: avulsa + lote, editar, cancelar, filtros
- [x] Cards resumo financeiro (receita, pendente, vencido)
- [x] Modulo Revendedores: CRUD + vincular chips + desconto na ativacao

### Ativacao Self-Service + QR Code (04-05/04/2026)
- [x] Pagina publica /ativar (sem auth) com leitor QR Code e entrada manual ICCID
- [x] Fluxo completo: escanear chip -> validar -> preencher dados -> pagar (Pix/Boleto) -> ativar
- [x] Desconto automatico para chips de revendedor
- [x] Consulta CEP automatica (ViaCEP)
- [x] Integracao Asaas para gerar pagamento (Pix QR Code / Boleto)
- [x] Polling automatico de status do pagamento
- [x] Ativacao automatica na Ta Telecom apos pagamento confirmado
- [x] Pagina admin /ativacoes-selfservice: listar, confirmar pagamento, cancelar
- [x] Geracao de QR Codes por revendedor (individual + em lote)
- [x] SITE_URL configuravel via .env

### Portal do Cliente (05/04/2026)
- [x] Backend: Login CPF+telefone com JWT tipo "portal" (24h expiry)
- [x] Backend: Dashboard com linhas, planos, cobrancas/faturas
- [x] Backend: Consulta saldo de dados e consumo consolidado (Ta Telecom)
- [x] Frontend: Tela login publica /portal + Dashboard /portal/dashboard
- [x] Frontend: Linhas expandiveis com saldo/consumo, faturas com links Asaas
- [x] Link do Portal nas etiquetas QR Code e na descricao das faturas Asaas
- [x] Botao "Ativar por QR Code" na pagina de Ativacoes

### Polish Visual / UX (05/04/2026)
- [x] Cards interativos: hover lift (-translate-y-0.5), active scale (0.98), border glow
- [x] Stat cards com hover color (valor muda para azul no hover)
- [x] Texto mais visivel: zinc-500->zinc-400, zinc-400->zinc-300 em labels, tabelas, sidebar
- [x] Badges com rounded-md e cores mais vivas
- [x] Botoes com active:scale[0.97] e rounded-md
- [x] Transicao de pagina suave com framer-motion (fade-in + slide-up)
- [x] Scroll suave (scroll-behavior: smooth)
- [x] Sidebar links com hover bg-white/5 e active com box-shadow inset

## Backlog

### P1 - Alta Prioridade
- [ ] Leitura de ICCID por codigo de barras na interface de ativacao manual do Admin
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes

### Refatoracao
- [ ] Desmembrar server.py (3000+ linhas) em roteadores separados
