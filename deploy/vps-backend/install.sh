#!/bin/bash
set -e

echo "============================================"
echo "  MVNO Manager - Instalacao Backend FastAPI"
echo "============================================"
echo ""

# ===== 1. PYTHON =====
echo "[1/6] Verificando Python..."
if command -v python3.11 &> /dev/null; then
    PYTHON=python3.11
    echo "  Python 3.11 encontrado: $(python3.11 --version)"
elif command -v python3 &> /dev/null; then
    PY_VER=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
    PYTHON=python3
    echo "  Python encontrado: $(python3 --version)"
else
    echo "  Python nao encontrado. Instalando..."
    sudo apt update
    sudo apt install -y python3 python3-pip python3-venv
    PYTHON=python3
    echo "  Python instalado: $(python3 --version)"
fi

# ===== 2. MONGODB =====
echo ""
echo "[2/6] Verificando MongoDB..."
if command -v mongod &> /dev/null; then
    echo "  MongoDB encontrado: $(mongod --version | head -1)"
else
    echo "  MongoDB nao encontrado. Instalando MongoDB 7..."
    sudo apt update
    sudo apt install -y gnupg curl
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    sudo apt update
    sudo apt install -y mongodb-org
    sudo systemctl start mongod
    sudo systemctl enable mongod
    echo "  MongoDB instalado e iniciado"
fi

# Garantir que MongoDB esta rodando
if ! sudo systemctl is-active --quiet mongod; then
    sudo systemctl start mongod
    sudo systemctl enable mongod
    echo "  MongoDB iniciado"
fi

# ===== 3. DIRETORIO DO BACKEND =====
echo ""
echo "[3/6] Configurando diretorio..."
sudo mkdir -p /opt/mvno-backend
sudo cp server.py /opt/mvno-backend/
sudo cp requirements.txt /opt/mvno-backend/
sudo cp -r services /opt/mvno-backend/

if [ ! -f /opt/mvno-backend/.env ]; then
    sudo cp .env.example /opt/mvno-backend/.env
    echo ""
    echo "  ============================================"
    echo "  ATENCAO: Edite o arquivo .env com suas credenciais!"
    echo "  sudo nano /opt/mvno-backend/.env"
    echo ""
    echo "  Campos OBRIGATORIOS:"
    echo "  - JWT_SECRET (gere com: python3 -c \"import secrets; print(secrets.token_hex(32))\")"
    echo "  - TATELECOM_USER_TOKEN"
    echo "  ============================================"
    echo ""
else
    echo "  .env ja existe, mantendo configuracao atual"
    # Atualizar codigo sem sobrescrever .env
fi

# ===== 4. AMBIENTE VIRTUAL PYTHON =====
echo "[4/6] Configurando ambiente virtual Python..."
cd /opt/mvno-backend
if [ ! -d "venv" ]; then
    $PYTHON -m venv venv
    echo "  Ambiente virtual criado"
fi
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "  Dependencias instaladas"

# ===== 5. SERVICO SYSTEMD =====
echo ""
echo "[5/6] Configurando servico systemd..."
cd -
sudo cp mvno-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mvno-backend
sudo systemctl restart mvno-backend
sleep 3

if sudo systemctl is-active --quiet mvno-backend; then
    echo "  Servico mvno-backend ATIVO"
else
    echo "  [ERRO] Servico nao iniciou. Verificando logs..."
    sudo journalctl -u mvno-backend --no-pager -n 20
    exit 1
fi

# ===== 6. NGINX =====
echo ""
echo "[6/6] Atualizando Nginx..."
sudo cp nginx-mvno.conf /etc/nginx/sites-available/mvno
sudo ln -sf /etc/nginx/sites-available/mvno /etc/nginx/sites-enabled/mvno

sudo nginx -t
if [ $? -ne 0 ]; then
    echo "  [ERRO] Configuracao Nginx invalida!"
    exit 1
fi
sudo systemctl reload nginx
echo "  Nginx atualizado"

# ===== VERIFICACAO FINAL =====
echo ""
echo "============================================"
echo "  Verificacao Final"
echo "============================================"
sleep 2

echo -n "  Backend health: "
HEALTH=$(curl -s --max-time 5 http://127.0.0.1:8001/api/health 2>&1)
if echo "$HEALTH" | grep -q "ok\|status"; then
    echo "OK"
else
    echo "FALHOU - $HEALTH"
fi

echo ""
echo "============================================"
echo "  Instalacao concluida!"
echo "============================================"
echo ""
echo "  Dashboard: https://mvno.homeonapp.com.br"
echo "  API:       https://mvno.homeonapp.com.br/api/health"
echo ""
echo "  Credenciais iniciais:"
echo "  Email: admin@mvno.com"
echo "  Senha: admin123"
echo ""
echo "  Comandos uteis:"
echo "  sudo systemctl status mvno-backend    # Status"
echo "  sudo journalctl -u mvno-backend -f    # Logs"
echo "  sudo systemctl restart mvno-backend   # Reiniciar"
echo ""
echo "  Se o .env ainda nao foi editado:"
echo "  sudo nano /opt/mvno-backend/.env"
echo "  sudo systemctl restart mvno-backend"
echo "============================================"
