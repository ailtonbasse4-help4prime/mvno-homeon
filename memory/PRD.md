# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=None)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - sandbox)

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456

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
- [x] Integracao real Asaas (sandbox key $aact_hmlg_ configurada)
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
- [x] Preview de etiquetas com grid 3 colunas e botao de impressao
- [x] Auto-fill ICCID via URL query string (/ativar?iccid=XXX)
- [x] SITE_URL configuravel via .env (https://mvno.homeonapp.com.br)
- [x] Fix sidebar: scroll correto com h-screen + overflow-y-auto

## Backlog

### P1 - Alta Prioridade
- [ ] Portal do Cliente (login CPF + numero, consulta plano/boletos)
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Consulta de saldo e consumo

### Refatoracao
- [ ] Desmembrar server.py (2700+ linhas) em roteadores separados
