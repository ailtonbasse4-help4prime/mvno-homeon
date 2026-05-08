#!/bin/bash
set -e

echo "============================================"
echo "  MVNO Manager - Empacotamento para VPS"
echo "  Frontend (build) + Backend + Scripts"
echo "============================================"
echo ""

DEPLOY_DIR="/app/deploy"
PACKAGE_DIR="/tmp/mvno-vps-deploy"
BUILD_DIR="/app/frontend/build"

# Verificar se o build existe
if [ ! -d "$BUILD_DIR" ]; then
    echo "[ERRO] Build do frontend nao encontrado em $BUILD_DIR"
    echo "  Execute 'cd /app/frontend && yarn build' antes"
    exit 1
fi

# Limpar pasta temporaria
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "[1/5] Copiando build do frontend..."
cp -r "$BUILD_DIR" "$PACKAGE_DIR/frontend-build"

echo "[2/5] Copiando backend..."
mkdir -p "$PACKAGE_DIR/backend"
cp /app/backend/server.py "$PACKAGE_DIR/backend/"
cp /app/backend/requirements.txt "$PACKAGE_DIR/backend/"
cp -r /app/backend/services "$PACKAGE_DIR/backend/services/"
find "$PACKAGE_DIR/backend" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "[3/5] Copiando scripts de instalacao..."
cp "$DEPLOY_DIR/vps-backend/install.sh" "$PACKAGE_DIR/"
cp "$DEPLOY_DIR/vps-backend/mvno-backend.service" "$PACKAGE_DIR/"
cp "$DEPLOY_DIR/vps-backend/nginx-mvno.conf" "$PACKAGE_DIR/"
cp "$DEPLOY_DIR/vps-backend/.env.example" "$PACKAGE_DIR/"

echo "[4/5] Copiando documentacao..."
# Gerar README completo
cat > "$PACKAGE_DIR/README.md" << 'READMEEOF'
# MVNO Manager - Deploy VPS

## Conteudo do Pacote
```
mvno-vps-deploy/
├── frontend-build/    # Build de producao React (pronto p/ Nginx)
├── backend/
│   ├── server.py      # FastAPI backend
│   ├── requirements.txt
│   └── services/      # Servicos (operadora, asaas)
├── install.sh         # Script de instalacao automatica
├── mvno-backend.service  # Servico systemd
├── nginx-mvno.conf    # Config Nginx (HTTPS + proxy)
├── .env.example       # Variaveis de ambiente
└── README.md          # Este arquivo
```

## Requisitos
- Ubuntu 20.04+ ou Debian 11+
- Dominio apontando para o IP da VPS
- Certbot/SSL configurado (ou adapte nginx-mvno.conf para HTTP)

## Instalacao Rapida

### 1. Envie o pacote para a VPS
```bash
scp mvno-vps-deploy.tar.gz usuario@SEU_IP:/tmp/
```

### 2. Na VPS, descompacte
```bash
cd /tmp
tar -xzf mvno-vps-deploy.tar.gz
cd mvno-vps-deploy
```

### 3. Edite o .env ANTES de instalar
```bash
cp .env.example .env
nano .env
# Preencha: JWT_SECRET, TATELECOM_USER_TOKEN
# Gere JWT_SECRET com:
# python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Execute o instalador
```bash
chmod +x install.sh
sudo bash install.sh
```

O script instala automaticamente:
- Python 3 + venv
- MongoDB 7
- Dependencias pip
- Servico systemd (mvno-backend)
- Frontend no Nginx
- Configuracao SSL

### 5. Verificacao
```bash
# Status do backend
sudo systemctl status mvno-backend

# Logs em tempo real
sudo journalctl -u mvno-backend -f

# Teste da API
curl https://mvno.homeonapp.com.br/api/health
```

## Credenciais Iniciais
- **Email**: admin@mvno.com
- **Senha**: admin123
- **ALTERE A SENHA NO PRIMEIRO ACESSO**

## Comandos Uteis
```bash
# Reiniciar backend
sudo systemctl restart mvno-backend

# Atualizar frontend
sudo cp -r frontend-build/* /var/www/mvno/frontend/

# Atualizar backend
sudo cp server.py /opt/mvno-backend/
sudo cp -r services /opt/mvno-backend/
sudo systemctl restart mvno-backend

# Logs
sudo journalctl -u mvno-backend -f
sudo tail -f /var/log/nginx/error.log
```

## SSL com Certbot
Se o SSL ainda nao estiver configurado:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mvno.homeonapp.com.br
```

## Nota sobre Asaas
A integracao com Asaas esta preparada mas em modo local (mock).
Para ativar, adicione no .env:
```
ASAAS_API_KEY=sua_chave_aqui
ASAAS_ENVIRONMENT=sandbox
```
E reinicie o backend.
READMEEOF

echo "[5/5] Gerando pacote tar.gz..."
cd /tmp
tar -czf "$DEPLOY_DIR/mvno-vps-deploy.tar.gz" mvno-vps-deploy/

# Limpar
rm -rf "$PACKAGE_DIR"

SIZE=$(du -h "$DEPLOY_DIR/mvno-vps-deploy.tar.gz" | cut -f1)
echo ""
echo "============================================"
echo "  Pacote gerado com sucesso!"
echo "============================================"
echo "  Arquivo: /app/deploy/mvno-vps-deploy.tar.gz"
echo "  Tamanho: $SIZE"
echo "============================================"
