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

### Cobranca Recorrente no Cartao (20/04/2026)
- [x] Endpoint POST /api/carteira/assinaturas com billing_type=CREDIT_CARD retorna invoice_url (link do Asaas onde o cliente cadastra o cartao 1 vez)
- [x] Campo invoice_url adicionado em AssinaturaResponse
- [x] Botao "Cartao Recorrente" em /cobrancas (data-testid="cartao-recorrente-btn")
- [x] Modal com formulario (cliente, valor mensal, 1 vencimento, descricao)
- [x] Dialog resultado com link copiavel, botao Abrir e botao WhatsApp
- [x] Cliente cadastra cartao 1 vez e Asaas cobra automaticamente todo mes (cycle MONTHLY)

### Ambiente Demo /demo + Captura de Leads (21/04/2026)
- [x] Rota `/demo` agora aberta (sem senha) para reduzir friccao comercial
- [x] DemoLogin redireciona direto pro dashboard da demo
- [x] Dados 100% ficticios em `fakeData.js` com margens reais da Ta Telecom (30%)
- [x] Componente `LeadCaptureModal` dispara automaticamente 1.2s apos carregar paginas com "Diferencial Exclusivo" (Ativacoes, Linhas, Self-Service), so 1x por sessao
- [x] Backend `POST /api/demo/lead` salva nome, WhatsApp, interesse, IP, user-agent, referrer em colecao `demo_leads`
- [x] Pagina admin `/demo-acessos` agora mostra card "Leads capturados" + tabela com nome, WhatsApp, interesse (tag) e botao de WhatsApp direto
- [x] Endpoint `GET /api/demo-admin/stats` retorna `total_leads` e `leads[]` alem das estatisticas de acesso
- [x] Textos ajustados: removidas promessas de "demo ao vivo com dados do cliente" — modal so coleta contato, sem promessa de simulacao
- [x] Testado: curl (POST valido/invalido + GET admin) + screenshots modal aparece + leads aparecem no painel

### Portfolio Publico HomeOn /homeon (21/04/2026)
- [x] Rota publica `/homeon` (acesso livre, sem login) com identidade HomeOn Internet (navy + laranja)
- [x] Hero com card de destaque do plano de entrada (10GB por R$ 39,99)
- [x] Grid de 9 beneficios (TIM+VIVO, WhatsApp, Waze, Uber, 1000min, 300 SMS, cobertura nacional, portabilidade, portal)
- [x] 6 planos HomeOn (START/PLUS/SMART/POWER/ULTRA/MAX) com link Shopee especifico por plano; SMART (20GB) destacado como "Mais vendido"
- [x] Botao "Assinar pela Shopee" abre link Shopee em nova aba (target=_blank rel=noopener)
- [x] FAB flutuante WhatsApp + CTA final com numero (19) 97005-1397
- [x] Secao "Por que HomeOn" explicando dupla cobertura + rodape com endereco de Santa Rita do Passa Quatro/SP
- [x] Logo HomeOn em container branco para contraste com fundo navy

### Rastreamento de Cliques HomeOn (21/04/2026)
- [x] `POST /api/homeon/click` (publico) grava cada clique em "Assinar pela Shopee" na colecao `homeon_clicks` (plano, source, IP, UA, referrer, timestamp)
- [x] `GET /api/homeon-admin/stats` (admin) retorna total, unicos, 24h/7d/30d, ranking por plano, cliques por dia, ultimos 30 cliques
- [x] Frontend `/homeon` dispara fire-and-forget antes de abrir Shopee (nao bloqueia)
- [x] Painel admin `/demo-acessos` ganhou secao "Portfolio HomeOn — Cliques pra Shopee" com 5 stat cards, ranking por plano (com %), cliques por dia e tabela dos ultimos 30 cliques
- [x] Botao "Abrir HomeOn" adicionado no header admin
- [x] Testado via UI: cliques disparados no SMART/POWER/Hero sao registrados e aparecem no painel com % de conversao correto

### Recuperacao e Protecao Tripla "Recarga Ta" (01/05/2026)
- [x] Endpoint `POST /api/operacional/restaurar-edicoes-manuais` agora le DUAS fontes: `manual_overrides` (backup imutavel) + `db.logs`
- [x] Novo endpoint `POST /api/operacional/restaurar-edicoes-lote` aceita lista CSV/JSON com matching por linha_id, ICCID, CPF, numero ou nome
- [x] Modal "Restaurar Recarga Ta" (botao violet com escudo) na Planilha Operacional com 2 opcoes: restaurar do log OU colar lista CSV/JSON
- [x] Toda edicao manual agora gravada em 3 lugares: `linhas.expirar_dados_manual=true`, `db.logs` (action=expirar_dados_manual_edit) E `db.manual_overrides` (upsert imutavel)
- [x] Script forense `/app/memory/RECUPERAR_RECARGA_TA.sh` para rodar na VPS (verifica logs, manual_overrides, oplog do MongoDB e mongodumps locais)
- [x] Testado backend (curl): restauracao por nome funcionando (restauradas=1 em 1 envio)

## Backlog

### P1 - Alta Prioridade
- [ ] Desmembrar server.py (5300+ linhas) em roteadores separados
- [ ] Geracao automatica de cobrancas mensais (regra de negocio pendente)

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
