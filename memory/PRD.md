# PRD - Sistema MVNO Manager - HomeOn Internet / HELP4PRIME MVNO

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (Python) + slowapi (rate limiting)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies
- **Integracoes**: Ta Telecom, Asaas (producao), Gmail SMTP

## Implementado

### Sistema Completo (31/03 - 14/04/2026)
- [x] Dashboard, CRUD clientes/chips/planos/ofertas/linhas
- [x] Cobrancas integradas Asaas (Boleto, PIX, Cartao)
- [x] Portal do Cliente PWA (CPF+telefone, saldo, consumo, faturas)
- [x] Ativacao Self-Service via QR Code
- [x] Rede de Revendedores com cartoes imprimiveis 8x5cm (grid 2x5 por A4, download PDF)
- [x] Notificacoes por Email (Gmail SMTP) - cobrancas, ativacoes, lembretes
- [x] Retry automatico de ativacoes (backoff progressivo)
- [x] Seguranca: rate limiting, bloqueio progressivo login, security headers
- [x] Backup diario automatico + pre-deploy
- [x] Landing Page SaaS HELP4PRIME MVNO (/saas)

### Landing Page HELP4PRIME MVNO (14/04/2026)
- [x] Hero com screenshot do dashboard e CTA WhatsApp
- [x] Grid Bento de funcionalidades (6 principais + 6 extras)
- [x] Carousel de screenshots interativo (Dashboard, Clientes, Cobrancas, Ativacoes)
- [x] Planos: 12 meses R$600/mes, 24 meses R$500/mes (destacado)
- [x] WhatsApp FAB fixo, navbar glassmorphism
- [x] Fontes Outfit + Manrope, Framer Motion animations
- [x] Contato: (11) 91532-2526

## Backlog

### P1 - Alta Prioridade
- [ ] Desmembrar server.py (4700+ linhas) em roteadores separados

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
