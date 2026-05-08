# MVNO Manager - Guia de Deploy em VPS

## Requisitos da VPS

- **SO**: Ubuntu 22.04+ (ou Debian 12+)
- **RAM**: Minimo 2GB (recomendado 4GB)
- **Disco**: 20GB+
- **Portas abertas**: 80 (HTTP), 443 (HTTPS), 22 (SSH)

---

## 1. Preparar o Codigo na VPS

### Opcao A: Via Git (recomendado)
```bash
# Na VPS
cd /opt
git clone SEU_REPOSITORIO mvno-manager
cd mvno-manager/deploy
```

### Opcao B: Via SCP (upload direto)
```bash
# No seu computador local
scp -r deploy/ usuario@SEU_IP:/opt/mvno-manager/

# Na VPS
cd /opt/mvno-manager
```

---

## 2. Copiar os Arquivos do Projeto

A pasta `deploy/` contem apenas a configuracao Docker.
Voce precisa copiar o codigo-fonte para dentro dela:

```bash
cd /opt/mvno-manager

# O backend/ e frontend/ devem estar ao lado do docker-compose.yml
# Estrutura esperada:
# /opt/mvno-manager/
#   docker-compose.yml
#   .env
#   setup.sh
#   backend/
#     Dockerfile
#     server.py
#     services/
#     requirements.txt
#   frontend/
#     Dockerfile
#     nginx.conf
#     package.json
#     yarn.lock
#     src/
#     public/
```

---

## 3. Configurar Variaveis de Ambiente

```bash
cp .env.example .env
nano .env
```

Preencha os campos obrigatorios:

| Variavel | Descricao | Exemplo |
|---|---|---|
| `JWT_SECRET` | Chave secreta para tokens | Gere com: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `TATELECOM_USER_TOKEN` | Token da API Ta Telecom | `G0tSHj2OXEaM` |
| `REACT_APP_BACKEND_URL` | URL publica do sistema | `https://mvno.seudominio.com.br` |
| `DOMAIN` | Seu dominio | `mvno.seudominio.com.br` |
| `ASAAS_API_KEY` | Chave API do Asaas (opcional) | `$aact_...` |
| `ASAAS_ENVIRONMENT` | `sandbox` ou `production` | `sandbox` |

---

## 4. Executar o Deploy

```bash
chmod +x setup.sh
./setup.sh
```

O script ira:
1. Verificar/instalar Docker
2. Construir as imagens (backend + frontend)
3. Iniciar MongoDB + Backend + Frontend
4. Verificar se esta tudo saudavel

---

## 5. Configurar SSL (HTTPS) com Certbot

### 5.1 Instalar Certbot
```bash
sudo apt update
sudo apt install -y certbot
```

### 5.2 Gerar o certificado
```bash
# Pare o container frontend temporariamente
docker compose stop frontend

# Gere o certificado
sudo certbot certonly --standalone -d SEU_DOMINIO

# Reinicie o frontend
docker compose start frontend
```

### 5.3 Configurar Nginx da VPS como reverse proxy com SSL
```bash
sudo apt install -y nginx

# Copie o template e edite
sudo cp nginx-ssl.conf /etc/nginx/sites-available/mvno
sudo sed -i 's/SEU_DOMINIO/mvno.seudominio.com.br/g' /etc/nginx/sites-available/mvno
sudo ln -s /etc/nginx/sites-available/mvno /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5.4 Renovacao automatica
```bash
sudo crontab -e
# Adicione:
0 3 * * * certbot renew --quiet && systemctl restart nginx
```

---

## 6. Configurar DNS

No painel do seu provedor de dominio, crie um registro:

| Tipo | Nome | Valor |
|---|---|---|
| A | mvno | IP_DA_SUA_VPS |

---

## 7. Configurar Webhook do Asaas

No painel do Asaas:
1. Acesse **Configuracoes > Integracoes > Webhooks**
2. URL: `https://SEU_DOMINIO/api/webhooks/asaas`
3. Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`

---

## 8. Comandos Uteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Ver logs de um servico especifico
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo

# Reiniciar tudo
docker compose restart

# Parar tudo
docker compose down

# Reconstruir e reiniciar (apos atualizacao de codigo)
docker compose up -d --build

# Acessar o MongoDB
docker exec -it mvno-mongo mongosh mvno_management

# Backup do banco de dados
docker exec mvno-mongo mongodump --db mvno_management --archive > backup_$(date +%Y%m%d).dump

# Restaurar backup
docker exec -i mvno-mongo mongorestore --archive < backup_20260402.dump
```

---

## 9. Atualizacao do Sistema

```bash
cd /opt/mvno-manager

# Puxar atualizacoes (se usa Git)
git pull origin main

# Reconstruir e reiniciar
docker compose up -d --build
```

---

## 10. Credenciais Iniciais

| Email | Senha | Perfil |
|---|---|---|
| admin@mvno.com | admin123 | Administrador |

**ALTERE A SENHA IMEDIATAMENTE apos o primeiro login!**

---

## Estrutura Final na VPS

```
/opt/mvno-manager/
  docker-compose.yml
  .env                     # Suas credenciais (NAO commitar!)
  .env.example
  setup.sh
  nginx-ssl.conf
  README_DEPLOY.md
  backend/
    Dockerfile
    server.py
    services/
      operadora_service.py
      asaas_service.py
    requirements.txt
  frontend/
    Dockerfile
    nginx.conf
    package.json
    yarn.lock
    src/
    public/
```

---

## Troubleshooting

**Backend nao inicia:**
```bash
docker compose logs backend
# Verifique se MONGO_URL aponta para mongodb://mongo:27017
```

**Frontend mostra pagina em branco:**
```bash
docker compose logs frontend
# Verifique se REACT_APP_BACKEND_URL esta correto no .env
# Reconstrua: docker compose up -d --build frontend
```

**Erro de CORS:**
```bash
# Verifique se REACT_APP_BACKEND_URL no .env bate com o dominio real
# O backend aceita CORS de qualquer origem por padrao
```

**MongoDB sem dados:**
```bash
# O sistema cria o admin automaticamente no primeiro acesso
# Se precisar, acesse o mongo e verifique:
docker exec -it mvno-mongo mongosh mvno_management --eval "db.usuarios.find()"
```
