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

### Carteira Movel + Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro, webhook

### Mobile + Deploy (02/04/2026)
- [x] Layout responsivo, scripts deploy VPS (Nginx + Systemd)

### Programacao Defensiva + Fix Login VPS (03/04/2026)
- [x] ErrorBoundary, safeArray/safeObject, cookies HTTPS configuraveis

### Sincronizacao Clientes Ta Telecom (03/04/2026)
- [x] 94 clientes, 108 linhas, 104 chips sincronizados

### Gestao de Cobrancas + Revendedores (04/04/2026)
- [x] Integracao real Asaas producao, Gestao de Cobrancas avulsa/lote
- [x] Modulo Revendedores: CRUD + vincular chips + desconto na ativacao

### Ativacao Self-Service + QR Code (04-05/04/2026)
- [x] Pagina publica /ativar com leitor QR Code e entrada manual ICCID
- [x] Fluxo completo: escanear -> validar -> preencher dados -> pagar -> ativar
- [x] Geracao de QR Codes por revendedor (individual + lote) + etiquetas

### Portal do Cliente (05/04/2026)
- [x] Login CPF+telefone, Dashboard com linhas, saldo, consumo, faturas
- [x] Link do Portal nas etiquetas QR Code e descricao das faturas Asaas

### Polish Visual / UX (05/04/2026)
- [x] Cards interativos com hover/active, texto mais visivel, transicoes suaves (framer-motion)
- [x] Badges, botoes e inputs com rounded-md e micro-animacoes

### Portabilidade de Numero (05/04/2026)
- [x] Toggle "Com Portabilidade" na ativacao manual do Admin (DDD + numero a portar)
- [x] Toggle "Portabilidade (manter meu numero)" no fluxo self-service publico
- [x] Backend: ActivationRequest com portability, port_ddd, port_number
- [x] Backend: SelfServiceActivationRequest com campos de portabilidade
- [x] Backend: Payload de ativacao envia portability=true + cn_contract_line + contract_line para Ta Telecom
- [x] Backend: GET /api/portabilidade/status/{numero_ou_iccid} para consultar status
- [x] Dados de portabilidade salvos na linha ativada

### Melhorias Adicionais (05/04/2026)
- [x] Busca por ICCID na pagina de Chips (filtro automatico ao digitar)
- [x] Fix QR Code: URL absoluta com window.location.origin como fallback
- [x] Botao "Ativar por QR Code" na pagina de Ativacoes

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes

### Refatoracao
- [ ] Desmembrar server.py (3000+ linhas) em roteadores separados
