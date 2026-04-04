# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
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
- [x] Integracao real Asaas (sandbox key configurada)
- [x] Pagina Gestao de Cobrancas: avulsa + lote, editar, cancelar, filtros
- [x] Cards resumo financeiro (receita, pendente, vencido)
- [x] Link fatura Asaas, copiar link, consultar status
- [x] Modulo Revendedores: CRUD + vincular chips + desconto na ativacao
- [x] Testado: 13/13 paginas sem erros

## Backlog

### P1 - Alta Prioridade
- [ ] Portal de Ativacao Self-Service (pagina publica com leitor codigo de barras)
- [ ] Pagamento antes da ativacao (Pix/Boleto via Asaas)
- [ ] Desconto automatico para chips de revendedor
- [ ] Webhook Asaas -> ativacao automatica na Ta Telecom
- [ ] Portal do Cliente (login CPF + numero, consulta plano/boletos)

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia
- [ ] Historico de ativacoes
- [ ] Consulta de saldo e consumo
- [ ] Retry automatico ativacoes pendentes
