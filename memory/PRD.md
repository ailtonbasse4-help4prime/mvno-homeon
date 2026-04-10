# PRD - Sistema MVNO Manager - HomeOn Internet

## Problema Original
Sistema web completo para gestao de telefonia movel (MVNO), com integracao real com a API da Ta Telecom e Asaas para pagamentos.

## Arquitetura
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + html5-qrcode + qrcode.react
- **Backend**: FastAPI (Python)
- **Banco de Dados**: MongoDB
- **Autenticacao**: JWT com httpOnly cookies (COOKIE_SECURE=true, COOKIE_SAMESITE=lax)
- **Integracoes**: Ta Telecom (telefonia), Asaas (pagamentos - producao)

## Ambiente de Producao (VPS Hostinger)
- Docker: CRM Atendimento (homeon-crm) nas portas 3001/8001 - NAO MEXER
- MVNO Backend: uvicorn na porta 3002 (virtualenv /app/venv)
- MVNO Frontend: Nginx servindo /var/www/mvno/frontend (estatico)
- Nginx config: /etc/nginx/sites-enabled/app-ativacao
- MongoDB: Docker (porta 27017), DB: mvno_management
- DNS: Registro A mvno.homeonapp.com.br -> 187.127.11.235 (Hostinger DNS)
- Deploy: cd /tmp/mvno-homeon && git pull && bash /opt/mvno-homeon/atualizar.sh
- .env VPS: /opt/mvno-homeon/backend/.env (COOKIE_SECURE=true, COOKIE_SAMESITE=lax)

## Credenciais
- **Admin**: admin@mvno.com / admin123
- **Atendente**: carlos@mvno.com / nova456
- **Admin (producao)**: ailtonhomeon@gmail.com / gi157258
- **Admin (producao)**: elizpestilho@gmail.com / eliz22
- **Portal Adriana**: CPF 23211311874 / Tel 19920090179

## Implementado

### MVP + Integracoes Basicas (31/03 - 01/04/2026)
- [x] JWT Auth, dark theme, CRUD completo

### Carteira Movel + Asaas (01/04/2026)
- [x] CRUD cobrancas/assinaturas, dashboard financeiro, webhook

### Sincronizacao Clientes Ta Telecom (03/04/2026)
- [x] 94 clientes, 108 linhas, 104 chips sincronizados

### Portal do Cliente v2 Premium (05-09/04/2026)
- [x] Login CPF+telefone, Dashboard com linhas, saldo, consumo, faturas
- [x] PWA instalavel, barra circular de consumo de dados reais

### Ativacao Self-Service + QR Code (04-05/04/2026)
- [x] Pagina publica /ativar com leitor QR Code e ativacao automatica

### Correcoes Producao (10/04/2026)
- [x] DNS corrigido: CNAME preview -> Registro A VPS
- [x] Deploy script corrigido: URLs relativas, proxy Nginx /api -> porta 3002
- [x] Nginx: headers no-cache para HTML, CDN-Cache-Control no-store
- [x] CORS: allow_credentials com origins especificas
- [x] Cookie: SameSite=lax para mesmo dominio
- [x] Modelos Pydantic defensivos: todos campos Optional com defaults
- [x] ObjectId.is_valid() em todas queries com IDs de referencia
- [x] Dados Adriana corrigidos na VPS (chip_id invalido, numero/msisdn)
- [x] Asaas reconfigurado na VPS (chave producao reinserida no MongoDB)
- [x] ErrorBoundary reseta ao navegar entre paginas
- [x] Linhas em ordem alfabetica e sem quebra de linha (min-w-[1400px])
- [x] Service Worker v2 com auto-limpeza de cache

## Bugs Conhecidos
- [ ] Bug de navegacao no menu: ao clicar rapidamente em varios itens, pode travar na tela anterior (parcialmente corrigido com ErrorBoundary reset, investigar race conditions nas chamadas de API)

## Backlog

### P1 - Alta Prioridade
- [ ] Retry automatico ativacoes pendentes/falhas na Ta Telecom
- [ ] Desmembrar server.py (3800+ linhas) em roteadores separados
- [ ] Investigar/corrigir bug de navegacao do menu definitivamente

### P2 - Media Prioridade
- [ ] Bloqueio automatico por inadimplencia (webhook Asaas)
- [ ] Historico de ativacoes
- [ ] Expansao Multi-Tenant (SaaS)
