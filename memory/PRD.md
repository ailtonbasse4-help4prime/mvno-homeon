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

### Correção Sincronização Asaas (17/04/2026)
- [x] Fixado IndentationError em server.py que quebrava backend (endpoint injetado no meio de outra função)
- [x] Busca accent-insensitive real (regex com classes [aáàâã] etc) em GET /api/clientes?search=
- [x] Busca accent-insensitive client-side na tela Cobranças (filtro por cliente_nome/descricao)
- [x] **Fix crítico:** GET /api/carteira/cobrancas tinha limit=100 → cobranças/carnês antigos ficavam invisíveis quando havia mais de 100. Aumentado para 5000
- [x] Mesmo fix em GET /api/carteira/assinaturas
- [x] Endpoint POST /api/carteira/sincronizar-asaas importa cobrancas existentes no Asaas para MongoDB local
- [x] Botão "Importar do Asaas" em GestaoCobrancas (data-testid="import-asaas-btn") com confirmação
- [x] Testado end-to-end: todas 187 cobrancas retornam, 9 importadas de 185 no Asaas

### Fix Tela Preta Portal Cliente (18/04/2026)
- [x] sw.js v3: network-first para HTML, sem precache de /portal, auto-update via postMessage SKIP_WAITING
- [x] PortalLogin/Dashboard: JSON.parse(sessionStorage) envolto em try/catch (causava crash em iOS PWA)
- [x] navigate() movido de render para useEffect

### Planilha Operacional + Menu reorganizado + Custo/Lucro (19/04/2026)
- [x] Nova rota /operacional com tabela consolidada (114 linhas) estilo Excel
- [x] Campos novos: `custo` em Ofertas, `canal`+`observacoes` em Clientes, `proxima_recarga`+`status_chip`+`expirar_dados` em Linhas
- [x] Endpoint consolidado GET /api/operacional/planilha com resumo Receita/Custo/Lucro/Margem
- [x] Edição inline (PATCH /api/operacional/linha/{id}) para obs, proxima_recarga, canal, status_chip
- [x] Export Excel (.xlsx com 2 abas: Planilha + Resumo) e Import Excel (merge por CPF/tel/nome)
- [x] Endpoint POST /api/operacional/atualizar-expirar-dados/{iccid} consulta Ta Telecom e cacheia
- [x] Menu lateral agrupado colapsável: Operação, Clientes & Linhas, Financeiro, Cadastros, Rede, Sistema
- [x] Campo custo em Oferta com preview de lucro/margem no form
- [x] Select canal em Cliente (Próprio, Shopee, Revendedor, Mercado Livre, Outro)
- [x] Testado: 17/17 backend + 100% frontend pass

### Custos & Automações (19/04/2026)
- [x] Nova página `/custos` (menu Cadastros → Custos & Automação) para cadastro em lote de custos por oferta
- [x] Tabela com linhas ativas por oferta, cálculo automático de lucro/margem/lucro total
- [x] Salvar em batch: POST /api/operacional/custos/batch
- [x] **Automação 1**: POST /api/operacional/sincronizar-tatelecom — consulta Ta Telecom para todas linhas ativas, atualiza status_chip (FS/NP/BLOQ) + expirar_dados em lote
- [x] **Automação 2**: POST /api/operacional/auto-canal — preenche "Revendedor" se chip tem revendedor_id, "Próprio" se veio de self-service
- [x] **Automação 3**: POST /api/operacional/auto-proxima-recarga — calcula próxima recarga = último boleto pago + 30 dias

### Custos por Plano + Custos Fixos + Lucro Total (19-20/04/2026)
- [x] PATCH /api/operacional/plano/{id}/custo — aplica mesmo custo a TODAS as ofertas do plano (um clique)
- [x] CRUD completo de Custos Fixos (GET/POST/PATCH/DELETE /api/operacional/custos-fixos) — VPS, domínio, Asaas, etc.
- [x] GET /api/operacional/resumo-financeiro retorna receita + custo_variavel + custo_fixo + custo_total + lucro + margem
- [x] Frontend `/custos` reestruturado: 5 cards (Receita, Custo Variável, Custo Fixo, Custo Total, Lucro Líquido + Margem)
- [x] Seção "Custos por Plano" (edita custo uma vez, propaga em todas ofertas do plano)
- [x] Seção "Custos Fixos do Painel" com CRUD inline (adicionar, editar, ativar/desativar, remover)
- [x] Totais recalculam em tempo real conforme o admin edita
- [x] Fix deploy VPS: removido `emergentintegrations`/`openai`/`anthropic`/`google-genai`/`stripe` do requirements.txt (libs internas/não usadas que quebravam o pip install externo)

## Backlog

### P1 - Alta Prioridade
- [ ] Desmembrar server.py (5300+ linhas) em roteadores separados

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
