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

### Envio de Cobrancas em Lote via WhatsApp - Z-API (05/05/2026)
- [x] Service `services/zapi_service.py` integrado com Z-API (instance + token + Client-Token)
- [x] Router `routes/whatsapp.py` com endpoints: `/config`, `/status`, `/template`, `/enviar-cobranca`, `/enviar-lote`, `/job-status`, `/cancelar-job`, `/historico`
- [x] Envio em background com delay aleatorio 5-8s anti-banimento, suporta cancelamento
- [x] Componente `WhatsAppLoteDialog` na Gestao de Cobrancas: filtros (vencidas/hoje/3d/7d/pendentes), checkboxes, progresso em tempo real, edicao de template e credenciais
- [x] Template configuravel com variaveis {nome}, {primeiro_nome}, {valor}, {data}, {link}, {pix}
- [x] Envios registrados em db.zapi_envios para auditoria
- [x] Testado: status da instancia retorna `connected: true`, modal renderiza com 44 cobrancas vencidas selecionadas

### Recuperacao e Protecao Tripla "Recarga Ta" (01/05/2026)
- [x] Sync `POST /api/operacional/sincronizar-tatelecom` agora aceita `?force=true` para sobrescrever edicoes manuais (recuperacao) e respeita a flag por padrao (protege novas edicoes)
- [x] Sync retorna `protegidas_manual` no status para mostrar quantas linhas foram preservadas
- [x] Modal "Restaurar Recarga Ta" tem 3 opcoes: ⭐ Recuperar via Tá (FORCE) [recomendado], Restaurar do log/backup, Colar lista CSV/JSON
- [x] Endpoint `POST /api/operacional/restaurar-edicoes-manuais` le `manual_overrides` (backup imutavel) + `db.logs`
- [x] Novo endpoint `POST /api/operacional/restaurar-edicoes-lote` aceita lista CSV/JSON com matching por linha_id, ICCID, CPF, numero ou nome
- [x] Toda edicao manual gravada em 3 lugares: `linhas.expirar_dados_manual=true`, `db.logs` E `db.manual_overrides` (upsert imutavel)
- [x] Script forense `/app/memory/RECUPERAR_RECARGA_TA.sh` para investigar oplog, dumps e backups na VPS
- [x] Testado: sync com e sem force, restauracao em lote por nome (1/1 OK), modal renderiza corretamente

### Geracao em Massa de Cobrancas por Data de Vencimento (07/06/2026)
- [x] Novo endpoint `GET /api/carteira/cobrancas/lote/preview?dia_vencimento=&mes=&ano=` retorna assinaturas ACTIVE agrupadas por dia (extraido de `proximo_vencimento`), marcando `ja_tem_cobranca` para anti-duplicidade. Inclui `counts_by_dia` para chips de filtro
- [x] Novo endpoint `POST /api/carteira/cobrancas/lote/por-vencimento` gera boletos/PIX em massa no Asaas para assinaturas selecionadas. Anti-duplicidade: pula se ja existe cobranca com mesmo vencimento exato para o cliente. Retorna {created, skipped, errors, items}
- [x] REFATORADO: fonte de dados mudou de `assinaturas` para `ultima cobranca de cada cliente` (mais confiavel - nem todo cliente tem assinatura). Valor + descricao herdados do ultimo boleto, com descricao_sugerida trocando o mes/ano automaticamente
- [x] Frontend componente `CobrancaLotePorVencimentoDialog` com filtros, chips clickaveis por dia, busca, checkboxes, valor E descricao editaveis por linha
- [x] Otimizado: batch lookups com `$in` (clientes, linhas, ofertas) evita N+1

### Portal do Cliente - Fix Portabilidade (07/21/2026)
- [x] BUG resolvido: Cliente que fazia portabilidade perdia acesso ao Portal (msisdn Ta Telecom original era sobrescrito pelo numero portado)
- [x] Backend: `verificar_portabilidade_chip` agora faz `$addToSet msisdn_historico` do msisdn anterior antes de sobrescrever (chip + linha)
- [x] Backend: `portal_login` busca msisdn atual + `numero` + array `msisdn_historico` (linha e chip)
- [x] Novo endpoint admin `POST /api/linhas/{linha_id}/msisdn-historico` body `{numero}` para backfill manual
- [x] Frontend: botao History (cyan) na lista de linhas abre dialog para gerenciar numeros historicos
- [x] Testado (iteration_27): 13/13 backend + 100% frontend

### Automacao Bloqueio/Desbloqueio por Inadimplencia (07/24/2026)
- [x] Novo modulo `/app/backend/routes/automacao_bloqueio.py` com worker background (asyncio task) que roda diariamente
- [x] Job de bloqueio: as 23h (config) varre cobrancas vencidas do dia -> `bloqueio_total` Ta Telecom + WhatsApp opcional
- [x] Job de aviso: as 09h envia WhatsApp para clientes com cobranca vencendo amanha
- [x] Desbloqueio automatico via webhook Asaas: `POST /api/webhooks/asaas` foi ampliado para chamar `desbloquear_por_pagamento` ao receber CONFIRMED/RECEIVED (best-effort)
- [x] Endpoints admin: GET/PUT /config, GET/POST/DELETE /whitelist, GET /simular (dry-read), POST /executar (dry_run opcional), GET /historico
- [x] Feature vem DESATIVADA por padrao (ativo=false) - salvaguarda maxima
- [x] Whitelist VIP: clientes marcados nunca sao bloqueados automaticamente. Ordenacao alfabetica. Adicao em lote via POST /whitelist/lote
- [x] Frontend: nova pagina `/automacao-bloqueio` (menu Financeiro) com toggle master, config, simulador, whitelist (lote), historico, botoes em portugues
- [x] Lista de simulacao mostra TODOS os inadimplentes (sem limite 20) + botao Exportar CSV
- [x] BACKUP mongodb feito antes do deploy: /root/backup-20260724-003051 (21MB) + git tag before-automacao-20260724-003056
- [x] Testado (iterations 28-31): 32/32 backend + 100% frontend. Zero dados alterados.

### FIX CRITICA - Anti-Bloqueio-Indevido (07/24/2026)
- [x] BUG resolvido: Cliente que pagava no Asaas continuava com status PENDING no banco (webhook nao configurado) -> risco de bloqueio indevido
- [x] Backend: dupla-checagem individual `_verificar_pagamento_final_asaas(cobranca_id)` - consulta Asaas para CADA cobranca antes de bloquear
- [x] Fail-safe: em caso de erro/timeout/rate-limit na consulta, PULA o bloqueio (protege o cliente)
- [x] Retry com backoff exponencial em 429 (rate limit Asaas)
- [x] Sync global antes do bloqueio: aumentou limite 500->5000, delay 0.5s a cada 10 requests para evitar 429
- [x] Frontend: botao "Sincronizar TODAS as cobrancas com Asaas" (cyan) + aviso emerald "Proteção fail-safe ativa"
- [x] Testado (iteration_31-34): 32/32 + fix Clarice + fix reconciliar

### Reconciliar Cliente + Diagnostico (07/24/2026)
- [x] Novo endpoint POST /api/carteira/reconciliar-cliente/{cliente_id}: puxa payments RECEIVED do cliente no Asaas e concilia cobrancas locais com matching por valor + janela +-45 dias (resolve caso "cliente pagou boleto do proximo mes")
- [x] Novo endpoint GET /api/automacao/bloqueio/diagnosticar/{cliente_id}: auditoria completa do cliente (cobrancas, linhas, motivo)
- [x] Frontend: botao ShieldCheck (purpura) em cada cobranca pendente + modal 🔍 diagnostico com tabela completa

### Fase A - Auto-bloqueio via Expiracao Ta Telecom (07/24/2026)
- [x] Novo endpoint POST /api/automacao/bloqueio/sincronizar-expiracao-ta: consulta /estoque/{iccid} Ta para cada linha e salva `linhas.data_expiracao_ta`
- [x] Helper _extrair_data_expiracao: reconhece varios formatos DD/MM/YYYY, YYYY-MM-DD, ISO, e nomes: data_expiracao, expiration_date, plan_expiration, expira_em, expiresAt, etc
- [x] Nova logica _find_via_expiracao_ta: bloqueia D-2 da expiracao Ta (2 dias antes)
- [x] Fallback _find_via_cobranca_legacy para linhas sem data_expiracao_ta (skip clientes ja tratados na rota nova)
- [x] Novo endpoint POST /api/automacao/bloqueio/linhas/{linha_id}/desbloqueio-confianca: admin desbloqueia temporariamente (1-30 dias)
- [x] Worker _executar_reblock_confianca_expirada: a cada 5min re-bloqueia linhas com confianca expirada e ainda inadimplentes
- [x] Frontend: botao verde "Sync Expiracao Ta" no header de /linhas, botao amber Unlock em linhas bloqueadas abre dialog confianca-dialog
- [x] Testado (iteration_36): 13/13 backend + 100% frontend

### Fix Bug D-2 Simulacao Auto-Bloqueio (07/24/2026 - iteration_37)
- [x] **BUG RCA**: `_find_cobrancas_para_bloquear` concatenava resultado do caminho v2 (expiracao_ta) com fallback legacy (por vencimento de cobranca). Legacy pegava clientes com boletos antigos em atraso e os injetava na simulacao mesmo com expiracao futura (ex.: Joelson exp 02/08 aparecia em 24/07).
- [x] **Fix**: REMOVIDO fallback legacy. `_find_cobrancas_para_bloquear` agora usa APENAS `_find_via_expiracao_ta`. Linhas sem data_expiracao_ta NUNCA sao bloqueadas por esta rotina (fail-safe).
- [x] `_find_via_expiracao_ta`: adicionada validacao STRICT de formato ISO (YYYY-MM-DD) + recheck em Python para evitar comparacoes lexicograficas com dados corrompidos + logging DEBUG.
- [x] `_cliente_ja_pagou_no_mes` agora aceita `origem`: para expiracao_ta usa janela [exp - 30d, exp + 3d] (ciclo Ta real); legacy mantem 60d retroativos.
- [x] `_build_simulacao` retorna `data_expiracao_ta` e `origem` no payload; UI mostra `exp Ta:` na lista e no CSV exportado.
- [x] Teste de regressao: `/app/backend/tests/test_auto_bloqueio_v2_expiracao_math.py` valida (a) exp+10d NAO aparece, (b) exp+1d APARECE, (c) exp-3d APARECE, (d) sem data_expiracao_ta NAO aparece.
- [x] Verificado pelo bug_testing_agent (verdict=fixed): 100% dos casos passaram, incluindo whitelist, dry-run e diagnostico.

### Painel Central + Automacao Escalonada D-3/D-0/D-Bloqueio (07/25/2026 - iteration_38)
- [x] Novo endpoint `GET /api/automacao/bloqueio/painel`: retorna todas as linhas ativas+bloqueadas com Boleto vigente, Expiracao Ta, Bloqueio HOMEON (= exp-2), Dias, Situacao, e KPIs (ativas / a_vencer_7d / vence_hoje / bloqueadas / sem_expiracao).
- [x] 8 situacoes calculadas: em_dia, avisar (D-3 a D-1), vence_hoje (D-0), vencido (< D-0), bloqueado, confianca, vip, sem_expiracao (fail-safe).
- [x] Novos endpoints: `POST /enviar-lembrete` (massa manual), `POST /executar-lembrete-d3`, `POST /executar-alerta-d0`.
- [x] Nova collection `automacao_lembretes_log` para dedup D-3 (1x por ciclo Ta por cliente — evita spam de WhatsApp).
- [x] Worker atualizado com 3 crons: 09h D-3 (WhatsApp lembrete), 12h D-0 (alerta vence hoje), 14h Bloqueio automatico — cada um com toggle independente.
- [x] Textos WhatsApp profissionais anti-banimento: sem CAPS, tom cordial, sem emojis excessivos. Placeholders: {nome}, {msisdn}, {valor}, {data_bloqueio}, {data_expiracao}, {link}.
- [x] Frontend: componente `PainelAutoBloqueio.jsx` — nova aba "Painel Central" com 5 KPIs, tabela consolidada, 9 filtros por situacao, busca livre, checkbox de acao em massa, botoes de envio D-3/D-0 selecionados, disparo manual dos jobs completos, export CSV completo, badges coloridos por situacao.
- [x] Frontend: aba "Configuracoes" ampliada com toggles independentes (enviar_lembrete_d3, enviar_alerta_d0, executar_bloqueio_auto), novo hora_alerta_d0, novo textarea mensagem_alerta_d0.
- [x] Regra critica reforcada: bloqueio SEMPRE pela coluna "Bloqueio HOMEON" (= data_expiracao_ta - 2 dias), NUNCA pelo vencimento do boleto. Status do boleto e usado apenas como filtro de "pagou/nao pagou".
- [x] Testado (iteration_38): 6/6 pytest backend + Playwright frontend 100% funcional, 0 issues, painel real com 116 linhas.

### Deploy VPS + Ajustes de Producao (07/25/2026)
- [x] Descoberta: MVNO nao usa Docker — usa systemd (mvno-backend.service) rodando uvicorn nativo na porta 3002. Frontend servido por nginx a partir de /var/www/mvno/frontend.
- [x] Deploy script `/opt/mvno-homeon/deploy.sh` refatorado:
  * Auto-merge de branches conflict_XXXX criadas pelo Emergent (Save to Github)
  * Restart via systemd (nao mais nohup)
  * Rollback automatico em caso de falha
  * Comando unico: `bash /opt/mvno-homeon/deploy.sh`
- [x] Endpoint POST /popular-expiracao-de-recarga: preenche linhas.expirar_dados a partir de linhas.proxima_recarga (calculado pela Planilha Operacional). Endpoint tambem no formato de loop Python (compatibilidade Mongo).
- [x] Helper `_resolver_expiracao_ta`: unifica leitura entre expirar_dados / data_expiracao_ta / proxima_recarga — Painel Central e Planilha Operacional agora leem a mesma fonte de verdade.
- [x] Endpoints de edicao manual (individual e em lote) gravam AMBOS os campos (expirar_dados + data_expiracao_ta) — sincronizacao bidirecional automatica.
- [x] Endpoint GET /diagnosticar-ta/{linha_id}: retorna resposta bruta da Tá para descobrir qual campo eles usam.
- [x] Botao "Preencher Expiração Tá vazia (via Próx.Recarga)" adicionado ao Painel Central.
- [x] Endpoint validado pelo bug_testing_agent (iteration_40, verdict=fixed): preview 100% funcional; issue no VPS por causa de processo uvicorn stale.

### Fix Global de Timezone UTC→BRT (16/02/2026)
- [x] Bug: backend serializa datetimes UTC sem sufixo 'Z', então `new Date(iso).toLocaleString('pt-BR')` no browser interpretava como local, mostrando datas com +/- 1 dia (ex: ativação às 22:21 BRT aparecia como 01:21 do dia seguinte).
- [x] Aplicado `dateFormat.js` (formatDateBR, formatTimeBR, formatDateTimeBR, formatDateOnlyBR) em 9 arquivos adicionais: `Logs.jsx`, `Chips.jsx`, `Usuarios.jsx`, `Assinaturas.jsx`, `CarteiraMovel.jsx`, `DemoAcessos.jsx`, `AutomacaoBloqueio.jsx`, `AtivacoesSelfService.jsx`, `IccidInput.jsx`.
- [x] Corrigido import faltante de `formatDateTimeBR` em `Dashboard.jsx` que estava causando "Erro ao carregar página".
- [x] Atualizado `formatters.js` `formatDateTimeBR` para também ser UTC-aware (afeta PlanilhaOperacional, GestaoCobrancas, CobrancaLotePorVencimentoDialog, WhatsAppLoteDialog).
- [x] Corrigido erro de parsing pré-existente em `CarteiraMovel.jsx` (stray `/div>` após fechamento da função).
- [x] Validado pelo testing_agent (iteration_44): 100% (10/10 rotas) renderizam datas em DD/MM/YYYY HH:MM BRT sem erros.


## Backlog

### P1 - Alta Prioridade
- [ ] **Fase B - Geracao de boletos por Expiracao Ta**: usar `data_expiracao_ta - 5 dias` como vencimento sugerido em CobrancaLotePorVencimentoDialog
- [ ] Configurar autenticacao interna do MongoDB (habilitar `--auth` no Docker, criar usuario root forte, atualizar `MONGO_URL` no .env)
- [ ] Desmembrar server.py (6100+ linhas) em roteadores separados (`/app/backend/routes/`)
- [ ] Backup externo do MongoDB (S3/Backblaze) - hoje so backup local na VPS

### P2 - Media Prioridade
- [ ] Dashboard Executivo com metricas de recuperacao de receita via auto-bloqueio
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS - Fase 1)
