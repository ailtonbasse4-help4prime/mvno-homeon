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
- id, nome, plano_id, valor, descricao, categoria (movel/m2m), ativo, created_at

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

### Asaas Cobrancas
- id, client_id, linha_id, valor, status_financeiro, due_date, asaas_payment_id

### Asaas Assinaturas
- id, client_id, linha_id, valor, ciclo, asaas_subscription_id

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
- PUT /api/chips/{chip_id} (alterar oferta)

### Ativacao
- POST /api/ativacao (both roles)
- POST /api/ativar-chip (proxy externo)

### Linhas
- GET /api/linhas (both)
- GET /api/linhas/{id}/consultar (admin only)
- POST /api/linhas/{id}/bloquear-parcial (admin only)
- POST /api/linhas/{id}/bloquear-total (admin only)
- POST /api/linhas/{id}/desbloquear (admin only)
- POST /api/linhas/{id}/alterar-plano (admin only)

### Carteira Movel
- GET /api/carteira/resumo, /api/carteira/cobrancas, /api/carteira/assinaturas
- POST /api/carteira/cobrancas, /api/carteira/assinaturas
- DELETE /api/carteira/cobrancas/{id}
- POST /api/carteira/cobrancas/{id}/consultar
- POST /api/carteira/assinaturas/{id}/cancelar
- POST /api/webhooks/asaas

### Dashboard
- GET /api/dashboard/stats

### Operadora (admin only)
- POST /api/operadora/sincronizar-planos
- POST /api/operadora/sincronizar-estoque
- GET /api/operadora/config, /api/operadora/motivos-bloqueio
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
- ErrorBoundary React para fallback de crashes
- safeArray/safeObject para programacao defensiva de API

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

### Categorizacao de Ofertas (01/04/2026)
- [x] Campo categoria (movel/m2m) no modelo de Ofertas
- [x] 7 ofertas reais vinculadas aos plan_codes da Ta Telecom
- [x] Pagina Ofertas com abas filtro Todas/Movel/M2M

### Vinculacao de Oferta ao Chip (01/04/2026)
- [x] PUT /api/chips/{chip_id} para alterar oferta vinculada
- [x] Modal Vincular Oferta com dropdown agrupado

### Carteira Movel - Asaas (01/04/2026)
- [x] Servico AsaasService com adapter (sandbox/production)
- [x] CRUD cobrancas avulsas e assinaturas recorrentes
- [x] Dashboard financeiro e webhook
- [x] MOCK local ativo (aguardando chave real)

### Layout Responsivo Mobile (02/04/2026)
- [x] Menu hamburguer, header mobile fixo
- [x] Touch targets 44px, tabelas com scroll horizontal
- [x] Grids adaptivos, dialogs responsivos

### Deploy VPS (02/04/2026)
- [x] Docker + Nginx + Systemd scripts
- [x] README_DEPLOY com guia completo

### Tela Ativar Chip (02/04/2026)
- [x] Pagina /ativar-chip mobile-first
- [x] Proxy backend para evitar CORS

### Programacao Defensiva API (03/04/2026)
- [x] ErrorBoundary React para catches globais
- [x] safeArray() e safeObject() em /lib/api.js
- [x] Todas as 12 paginas refatoradas com chamadas seguras
- [x] Testado: 12/12 paginas passaram sem erros
- [x] Build de producao gerado sem erros
- [x] Pacote de deploy VPS atualizado: /app/deploy/mvno-vps-deploy.tar.gz

## Backlog

### P0 - Concluido
- [x] Token real configurado (TATELECOM_USER_TOKEN)
- [x] USE_MOCK_API=false ativo
- [x] Programacao defensiva frontend (safeArray/safeObject)
- [x] Build de producao + pacote deploy VPS

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
