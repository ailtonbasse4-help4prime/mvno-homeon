# PRD - Sistema MVNO Manager - Ta Telecom

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom para ativacao, consulta, bloqueio/desbloqueio e alteracao de planos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies
- **Integracao**: OperadoraService com padrao Adapter (Mock/Real Ta Telecom)

## Perfis de Acesso

### Admin
- Gerenciar usuarios
- Sincronizar operadora
- Ativar, bloquear, desbloquear linhas
- Alterar plano
- Gerenciar planos, ofertas e chips
- Ver logs completos

### Atendente
- Cadastrar e editar clientes
- Consultar chips e linhas
- Ativar linha
- Sem acesso a configuracoes
- Sem gestao de usuarios
- Sem acesso a logs

## Modelo de Dados

### Planos (Tecnicos)
- id, nome, franquia, descricao, plan_code, created_at

### Ofertas (Comerciais)
- id, nome, plano_id, valor, descricao, ativo, created_at

### Clientes (Expandido para Ta Telecom)
- id, nome, tipo_pessoa, documento, telefone, data_nascimento
- cep, endereco, numero_endereco, bairro, cidade, estado, city_code, complemento
- status, dados_completos (calculado), created_at

### Chips
- id, iccid, status (disponivel/reservado/ativado/bloqueado/cancelado)
- oferta_id, cliente_id, msisdn, created_at

### Linhas
- id, numero, status, cliente_id, chip_id, plano_id, oferta_id, msisdn, created_at

### Usuarios
- id, email, password_hash, name, role (admin/atendente), created_at

## Endpoints da API

### Auth
- POST /api/auth/login, /api/auth/register, /api/auth/logout
- GET /api/auth/me, POST /api/auth/refresh
- POST /api/auth/change-password

### Usuarios (admin only)
- GET/POST /api/usuarios, PUT/DELETE /api/usuarios/{id}

### Clientes
- GET/POST /api/clientes (both roles), PUT /api/clientes/{id} (both)
- DELETE /api/clientes/{id} (admin only)

### Planos
- GET /api/planos (both), POST/PUT/DELETE (admin only)

### Ofertas
- GET /api/ofertas (both), POST/PUT/DELETE (admin only)

### Chips
- GET /api/chips (both), POST/DELETE (admin only)

### Ativacao
- POST /api/ativacao (both roles)

### Linhas
- GET /api/linhas (both)
- GET /api/linhas/{id}/consultar (admin only)
- POST /api/linhas/{id}/bloquear-parcial (admin only)
- POST /api/linhas/{id}/bloquear-total (admin only)
- POST /api/linhas/{id}/desbloquear (admin only)
- POST /api/linhas/{id}/alterar-plano (admin only)

### Operadora (admin only)
- POST /api/operadora/sincronizar-planos
- POST /api/operadora/sincronizar-estoque
- GET /api/operadora/config
- POST /api/operadora/test

### Logs (admin only)
- GET /api/logs

## Seguranca Implementada
- JWT httpOnly cookies
- Brute force protection (5 tentativas, 15 min lockout)
- Session timeout 30 min inatividade (frontend)
- Hash bcrypt para senhas
- Token operadora apenas no backend
- Role-based access control em todas as rotas
- Validacao CPF/CNPJ/CEP
- Audit logs completos

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
- [x] Perfis admin/atendente com permissoes distintas
- [x] Gestao de usuarios (CRUD admin only)
- [x] Troca de senha com validacao
- [x] Session timeout 30 min inatividade
- [x] Role-based UI (sidebar, botoes, acoes)
- [x] Audit logs com usuario responsavel
- [x] Brute force protection
- [x] Backend 100% (33/33), Frontend 100%

## Implementado (01/04/2026 - Continuacao)

### Categorizacao de Ofertas (Movel vs M2M)
- [x] Campo `categoria` (movel/m2m) no modelo de Ofertas
- [x] 7 ofertas reais vinculadas aos plan_codes da Ta Telecom
- [x] Pagina Ofertas com abas filtro Todas/Movel/M2M com contadores
- [x] Badges de categoria (azul=Movel, violeta=M2M) nos cards

### Vinculacao de Oferta ao Chip
- [x] PUT /api/chips/{chip_id} para alterar oferta vinculada
- [x] Regra: apenas chips disponiveis/reservados podem ter oferta alterada
- [x] Regra: chips ativados bloqueados para alteracao
- [x] Botao Editar na tabela de chips (apenas para disponiveis/reservados)
- [x] Modal "Vincular Oferta ao Chip" com info do chip e dropdown
- [x] Dropdown agrupado por categoria (Movel/M2M) em Chips e Novo Chip
- [x] Coluna Categoria com badges na tabela de chips
- [x] Indicacao "Sem oferta" em amarelo para chips sem vinculo

### Carteira Movel - Asaas (01/04/2026)
- [x] Servico AsaasService com adapter (sandbox/production)
- [x] Modelos: cobrancas, assinaturas no MongoDB
- [x] CRUD cobrancas avulsas (PIX/Boleto/Cartao)
- [x] CRUD assinaturas recorrentes (Mensal/Trimestral/etc)
- [x] Dashboard financeiro (Receita, Pendente, Vencido, Assinaturas)
- [x] Endpoint webhook para callbacks do Asaas
- [x] Badge indicador de status Asaas (Pendente/Conectado)
- [x] Paginas frontend: Carteira Movel + Assinaturas
- [x] Sidebar atualizado com novos links
- [x] Preparado para ativacao: basta definir ASAAS_API_KEY no .env

### Layout Responsivo Mobile (02/04/2026)
- [x] Menu hamburguer no mobile (slide-in com overlay)
- [x] Sidebar fecha ao navegar ou clicar overlay
- [x] Header mobile fixo com logo
- [x] Botoes e inputs com min-h 44px (touch targets)
- [x] Tabelas com scroll horizontal no mobile
- [x] Grids adaptivos (1 col mobile -> 5 col desktop)
- [x] Dialogs responsivos (max-width calc, scroll vertical)
- [x] Todas as telas criticas adaptadas: Dashboard, Clientes, Chips, Ativacao, Linhas, Carteira Movel, Assinaturas
- [x] Viewport meta tag otimizado para iOS/Android

### Deploy VPS (02/04/2026)
- [x] Dockerizacao completa (backend + frontend + MongoDB)
- [x] docker-compose.yml com healthchecks
- [x] Dockerfile backend (Python 3.11 + uvicorn workers)
- [x] Dockerfile frontend (build React + nginx)
- [x] nginx.conf com proxy reverso e cache de assets
- [x] .env.example com todas as variaveis documentadas
- [x] nginx-ssl.conf template para HTTPS/Certbot
- [x] setup.sh script de instalacao automatica
- [x] package.sh gera tar.gz pronto para deploy
- [x] README_DEPLOY.md com guia completo (passo a passo)

## Backlog

### P0 - Concluido
- [x] Token real configurado (TATELECOM_USER_TOKEN)
- [x] USE_MOCK_API=false ativo

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
