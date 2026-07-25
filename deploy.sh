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

# 2. Atualizar codigo — com auto-merge de conflict branches (recorrencia Emergent)
echo "→ Sincronizando com GitHub..."
git fetch --all --quiet
git stash 2>/dev/null || true

CONFLICT_BRANCH=$(git branch -r | grep -i "origin/conflict_" | head -1 | tr -d ' ' || true)

if [ -n "$CONFLICT_BRANCH" ]; then
    echo "   ⚠ Detectada branch conflict: $CONFLICT_BRANCH — fazendo merge automatico"
    git checkout main --quiet 2>/dev/null || git checkout -b main
    git merge "$CONFLICT_BRANCH" --allow-unrelated-histories --no-edit -m "auto-merge deploy $(date '+%Y-%m-%d %H:%M')" || {
        echo "   ❌ Merge falhou. Resolva manualmente e rode de novo."
        exit 1
    }
    git push origin main --quiet
    # Limpa branch conflict remota
    BRANCH_NAME=$(echo "$CONFLICT_BRANCH" | sed 's|origin/||')
    git push origin --delete "$BRANCH_NAME" --quiet 2>/dev/null || echo "   (branch conflict remota mantida)"
    echo "   ✓ Conflict mergeado e main sincronizada"
else
    git pull origin main || {
        echo "⚠️  git pull abortou. Tentando limpar yarn.lock e retentar..."
        rm -f frontend/yarn.lock yarn.lock
        git pull origin main
    }
fi

# 3. Build frontend
echo "→ Build frontend..."
cd "$REPO/frontend"
# Forca REACT_APP_BACKEND_URL pra producao (sobrescreve qualquer URL de preview/dev vinda do Emergent)
PROD_BACKEND_URL="https://mvno.homeonapp.com.br"
if [ -f .env ]; then
    # Remove linha antiga e adiciona a correta
    grep -v '^REACT_APP_BACKEND_URL=' .env > .env.tmp 2>/dev/null || true
    mv .env.tmp .env 2>/dev/null || true
fi
echo "REACT_APP_BACKEND_URL=$PROD_BACKEND_URL" >> .env
echo "   .env configurado: REACT_APP_BACKEND_URL=$PROD_BACKEND_URL"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

# Valida que a URL correta esta no bundle
if grep -rq "$PROD_BACKEND_URL" build/static/js/*.js 2>/dev/null; then
    echo "   ✓ Build contem a URL de producao"
else
    echo "   ⚠ AVISO: URL de producao nao encontrada no bundle"
fi

# 4. Copiar build para nginx
echo "→ Copiando build para $WEB_DIR..."
# Preserva a pasta homeon-assets/ (logo HomeOn)
sudo find "$WEB_DIR" -mindepth 1 -maxdepth 1 ! -name 'homeon-assets' -exec rm -rf {} + 2>/dev/null || true
sudo cp -r "$REPO/frontend/build/." "$WEB_DIR/"
sudo chown -R www-data:www-data "$WEB_DIR"

# 5. Reiniciar backend via systemd (mvno-backend.service)
echo "→ Reiniciando backend via systemd..."
systemctl restart mvno-backend.service
sleep 5

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
    echo "  3. Va em Cobrancas e teste o botao 'WhatsApp Lote'"
    echo ""
else
    echo ""
    echo "========================================="
    echo "  ❌ BACKEND NAO RESPONDEU - REVERTENDO"
    echo "========================================="
    cd "$REPO"
    git reset --hard "$LAST_OK"
    cd frontend && yarn build
    sudo cp -r "$REPO/frontend/build/." "$WEB_DIR/"
    systemctl restart mvno-backend.service
    echo ""
    echo "↩️  Revertido para o commit anterior: $LAST_OK"
    echo "    Veja o erro: tail -n 80 $LOG"
    exit 1
fi
