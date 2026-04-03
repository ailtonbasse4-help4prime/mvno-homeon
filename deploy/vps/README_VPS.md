# Deploy do Frontend MVNO na VPS

## Arquivos incluidos
- `frontend-build/` — Build de producao do React (pronto para servir)
- `nginx-mvno.conf` — Configuracao do Nginx (frontend + API no mesmo dominio)
- `deploy.sh` — Script automatico de deploy

---

## Passo a passo

### 1. Enviar o pacote para a VPS

No seu computador local (onde baixou o arquivo):

```bash
scp mvno-frontend-deploy.tar.gz root@187.127.11.235:/tmp/
```

### 2. Conectar na VPS e extrair

```bash
ssh root@187.127.11.235
cd /tmp
tar -xzf mvno-frontend-deploy.tar.gz
```

### 3. IMPORTANTE — Ajustar o Nginx antes de rodar

Antes de executar o script, verifique no arquivo `nginx-mvno.conf`:

**Porta do seu backend Node atual** (linha 33):
```nginx
proxy_pass http://127.0.0.1:3001;
```
Se seu backend Node roda em outra porta, altere `3001` para a porta correta:
```bash
nano /tmp/mvno-deploy/nginx-mvno.conf
```

**Caminho do certificado SSL** (linhas 12-13):
Confirme se os caminhos batem com o Certbot da sua VPS:
```nginx
ssl_certificate /etc/letsencrypt/live/mvno.homeonapp.com.br/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/mvno.homeonapp.com.br/privkey.pem;
```

### 4. Executar o deploy

```bash
cd /tmp/mvno-deploy
chmod +x deploy.sh
./deploy.sh
```

### 5. Verificar

Abra no navegador:
```
https://mvno.homeonapp.com.br
```

Deve exibir a tela de login do painel MVNO.

---

## Como funciona o roteamento

| URL | Destino |
|---|---|
| `https://mvno.homeonapp.com.br/` | Frontend React (painel MVNO) |
| `https://mvno.homeonapp.com.br/api/*` | Backend FastAPI (porta 8001) |
| `https://mvno.homeonapp.com.br/ativar-chip` | Backend Node (porta 3001) |
| `https://mvno.homeonapp.com.br/webhooks/asaas` | Backend FastAPI webhooks |

---

## Backend FastAPI (se ainda nao esta rodando)

Se o backend FastAPI ainda nao esta na VPS, voce vai precisar:

1. Copiar os arquivos do backend (server.py, services/, requirements.txt)
2. Instalar dependencias:
```bash
cd /opt/mvno-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
3. Criar o .env:
```bash
cp .env.example .env
nano .env  # preencher credenciais
```
4. Rodar com systemd ou pm2:
```bash
# Opcao A: direto
uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2

# Opcao B: com systemd (recomendado)
# Criar /etc/systemd/system/mvno-backend.service
```

---

## Troubleshooting

**Tela em branco:**
```bash
# Verificar se os arquivos existem
ls /var/www/mvno/frontend/index.html

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

**API nao responde:**
```bash
# Verificar se o backend FastAPI esta rodando
curl http://127.0.0.1:8001/api/health

# Verificar se o backend Node esta rodando
curl http://127.0.0.1:3001/ativar-chip
```

**Erro 502 Bad Gateway:**
```bash
# O backend nao esta acessivel na porta configurada
# Verifique as portas no nginx-mvno.conf
```
