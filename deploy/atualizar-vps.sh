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
cd /tmp/mvno-homeon/frontend && yarn install --silent && yarn build

echo "[3/5] Atualizando frontend MVNO..."
sudo cp -r /tmp/mvno-homeon/frontend/build/* /var/www/mvno/frontend/

echo "[4/5] Atualizando backend MVNO..."
sudo cp /tmp/mvno-homeon/backend/server.py /app/server.py
sudo cp -r /tmp/mvno-homeon/backend/services/* /app/services/

echo "[5/5] Reiniciando backend MVNO..."
kill $(ps aux | grep "uvicorn.*3002" | grep -v grep | awk '{print $2}') 2>/dev/null || true
sleep 2
cd /app && source venv/bin/activate && nohup python -m uvicorn server:app --host 0.0.0.0 --port 3002 &>/var/log/mvno-backend.log &
sleep 3
tail -3 /var/log/mvno-backend.log

echo ""
echo "=== MVNO ATUALIZADO COM SUCESSO! ==="
echo "Frontend: /var/www/mvno/frontend/"
echo "Backend: porta 3002"
echo "Docker CRM: INTOCADO"
