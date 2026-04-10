#!/bin/bash
set -e
echo "=== MVNO Manager - Atualizacao Segura ==="
echo "PROTECAO: Este script NAO toca no Docker (CRM Atendimento)"
echo ""

echo "[0/5] Executando backup automatico antes de atualizar..."
bash /opt/mvno-homeon/deploy/backup-mvno.sh || bash /tmp/mvno-homeon/deploy/backup-mvno.sh || echo "AVISO: Backup nao disponivel, continuando..."
echo ""

echo "[1/5] Baixando codigo atualizado..."
cd /tmp/mvno-homeon && git pull

echo "[2/5] Compilando frontend..."
cd /tmp/mvno-homeon/frontend && yarn install --silent
echo "REACT_APP_BACKEND_URL=https://mvno.homeonapp.com.br" > .env.production.local
yarn build
rm -f .env.production.local

echo "[3/5] Atualizando frontend MVNO..."
sudo cp -r /tmp/mvno-homeon/frontend/build/* /var/www/mvno/frontend/

echo "[4/5] Atualizando backend MVNO..."
sudo cp /tmp/mvno-homeon/backend/server.py /opt/mvno-homeon/backend/server.py
sudo cp -r /tmp/mvno-homeon/backend/services/* /opt/mvno-homeon/backend/services/

echo "[5/5] Reiniciando backend MVNO..."
kill $(pgrep -f "uvicorn server:app") 2>/dev/null || true
sleep 2
cd /opt/mvno-homeon/backend && source /app/venv/bin/activate && nohup uvicorn server:app --host 0.0.0.0 --port 3002 --reload > /var/log/mvno-backend.log 2>&1 &
sleep 3
tail -3 /var/log/mvno-backend.log

echo ""
echo "=== MVNO ATUALIZADO COM SUCESSO! ==="
echo "Frontend: /var/www/mvno/frontend/"
echo "Backend: porta 3002"
echo "Docker CRM: INTOCADO"
