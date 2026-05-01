#!/bin/bash
# ============================================================================
# DEPLOY SCRIPT - MVNO Manager
# ============================================================================
# Como usar na sua VPS:
#   1. cd /opt/mvno-homeon
#   2. git pull   (pra pegar a versao mais recente do deploy.sh)
#   3. bash deploy.sh
# ============================================================================
# REGRAS CRITICAS:
#  - NUNCA roda comandos destrutivos no MongoDB ($unset, deleteMany)
#  - Preserva todas as edicoes manuais do usuario
#  - Faz rollback automatico se backend nao subir
# ============================================================================

set -e  # aborta no primeiro erro

REPO=/opt/mvno-homeon
WEB_DIR=/var/www/mvno/frontend
LOG=/var/log/mvno-backend.log

cd "$REPO"

echo "========================================="
echo "  DEPLOY MVNO - Iniciando..."
echo "  $(date)"
echo "========================================="

# 1. Salvar commit atual (pra eventual rollback)
LAST_OK=$(git rev-parse HEAD)
echo "→ Commit atual: $LAST_OK"

# 2. Atualizar codigo
echo "→ Pull do GitHub..."
git stash 2>/dev/null || true
git pull || {
    echo "⚠️  git pull abortou. Tentando limpar yarn.lock e retentar..."
    rm -f frontend/yarn.lock yarn.lock
    git pull
}

# 3. Build frontend
echo "→ Build frontend..."
cd "$REPO/frontend"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

# 4. Copiar build para nginx
echo "→ Copiando build para $WEB_DIR..."
# Preserva a pasta homeon-assets/ (logo HomeOn)
sudo find "$WEB_DIR" -mindepth 1 -maxdepth 1 ! -name 'homeon-assets' -exec rm -rf {} + 2>/dev/null || true
sudo cp -r "$REPO/frontend/build/." "$WEB_DIR/"
sudo chown -R www-data:www-data "$WEB_DIR"

# 5. Reiniciar backend
echo "→ Reiniciando backend (porta 3002)..."
pkill -9 -f "uvicorn server:app.*3002" 2>/dev/null || true
sleep 2
cd "$REPO/backend"
nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > "$LOG" 2>&1 &
sleep 6

# 6. Validar backend
echo "→ Validando backend..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/api/auth/login \
    -H "Content-Type: application/json" -d '{}' || echo "000")
echo "   HTTP code: $HTTP"

if [[ "$HTTP" =~ ^(200|401|422)$ ]]; then
    sudo systemctl reload nginx
    NEW_COMMIT=$(git rev-parse HEAD)
    echo ""
    echo "========================================="
    echo "  ✅ DEPLOY CONCLUIDO COM SUCESSO"
    echo "  Commit: $NEW_COMMIT"
    echo "========================================="
    echo ""
    echo "PROXIMO PASSO:"
    echo "  1. Acesse https://mvno.homeonapp.com.br"
    echo "  2. CTRL+SHIFT+R (ou no celular: feche e reabra o navegador)"
    echo "     -> isso bypassa o cache do PWA"
    echo "  3. Va em Planilha Operacional"
    echo "  4. Clique em 'Restaurar Recarga Tá' (botao roxo com escudo)"
    echo "  5. Clique no botao verde '⭐ Recuperar via Tá (FORCE)'"
    echo ""
else
    echo ""
    echo "========================================="
    echo "  ❌ BACKEND NAO RESPONDEU - REVERTENDO"
    echo "========================================="
    pkill -9 -f "uvicorn server:app.*3002" 2>/dev/null || true
    cd "$REPO"
    git reset --hard "$LAST_OK"
    cd frontend && yarn build
    sudo cp -r "$REPO/frontend/build/." "$WEB_DIR/"
    cd "$REPO/backend"
    nohup /app/venv/bin/uvicorn server:app --host 0.0.0.0 --port 3002 > "$LOG" 2>&1 &
    echo ""
    echo "↩️  Revertido para o commit anterior: $LAST_OK"
    echo "    Veja o erro: tail -n 80 $LOG"
    exit 1
fi
