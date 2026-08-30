#!/bin/bash
# ============================================================================
# DEPLOY SCRIPT - MVNO Manager
# ============================================================================
# Como usar na sua VPS:
#   1. cd /opt/mvno-homeon
#   2. bash deploy.sh
# ============================================================================
# REGRAS CRITICAS (validadas por SAFETY GUARDS no inicio do script):
#  - NUNCA toca /opt/homeon-crm (CRM Atendimento)
#  - NUNCA toca Docker (homeon-crm-*)
#  - NUNCA toca portas 3001, 8001, 27017 (reservadas do CRM)
#  - NUNCA modifica nginx sites do atendimento
#  - NUNCA roda 'docker compose down'
#  - Rollback automatico se backend nao subir
# ============================================================================

set -e  # aborta no primeiro erro

REPO=/opt/mvno-homeon
WEB_DIR=/var/www/mvno/frontend
LOG=/var/log/mvno-backend.log
MVNO_PORT=3002
MVNO_SERVICE=mvno-backend.service
MVNO_NGINX=/etc/nginx/sites-enabled/app-ativacao

# ============================================================================
# SAFETY GUARDS — abortam ANTES de qualquer mudanca se algo estiver errado
# ============================================================================
echo "→ Verificando regras de seguranca..."

# Guard 1: estamos na pasta certa
if [ "$(pwd)" != "$REPO" ] && [ -d "$REPO" ]; then
    cd "$REPO"
fi
if [ ! -d "$REPO/backend" ] || [ ! -d "$REPO/frontend" ]; then
    echo "❌ SAFETY: nao estamos em $REPO ou estrutura invalida"
    exit 1
fi

# Guard 2: o repo git deve ser 'mvno-homeon' (nunca CRM)
REMOTE_URL=$(git -C "$REPO" remote get-url origin 2>/dev/null || echo "")
if [[ "$REMOTE_URL" == *"homeon-crm"* ]] || [[ "$REMOTE_URL" == *"atendimento"* ]]; then
    echo "❌ SAFETY: git remote aponta para repo do CRM Atendimento — abortando"
    echo "   URL detectada: $REMOTE_URL"
    exit 1
fi
if [[ "$REMOTE_URL" != *"mvno-homeon"* ]]; then
    echo "⚠️  AVISO: git remote nao parece ser mvno-homeon: $REMOTE_URL"
    echo "   Continue apenas se tiver certeza. Pressione Ctrl+C para abortar."
    sleep 3
fi

# Guard 3: containers do CRM Atendimento devem estar rodando (sinal que nao vamos atropela-los)
CRM_CONTAINERS=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -c "^homeon-crm-" || echo "0")
if [ "$CRM_CONTAINERS" -eq 0 ]; then
    echo "⚠️  AVISO: containers homeon-crm-* nao encontrados. CRM Atendimento pode estar parado."
fi

# Guard 4: portas reservadas do CRM devem estar ocupadas pelo Docker (nao pelo nosso backend)
CRM_PORT_8001=$(ss -tlnp 2>/dev/null | awk '$4 ~ /:8001$/{print $NF}' | head -1 || echo "")
if [[ -n "$CRM_PORT_8001" ]] && [[ "$CRM_PORT_8001" != *"docker-proxy"* ]]; then
    echo "❌ SAFETY: porta 8001 (CRM) esta ocupada por processo NAO-Docker — perigo"
    echo "   Detectado: $CRM_PORT_8001"
    exit 1
fi

# Guard 5: WEB_DIR deve ser /var/www/mvno/frontend (nao qualquer outro)
if [[ "$WEB_DIR" != "/var/www/mvno/"* ]]; then
    echo "❌ SAFETY: WEB_DIR fora de /var/www/mvno/ — abortando"
    exit 1
fi

echo "   ✓ SAFETY OK — deploy vai afetar SOMENTE MVNO"
echo "   ✓ Repo git: mvno-homeon"
echo "   ✓ Alvo: $WEB_DIR + porta $MVNO_PORT + $MVNO_SERVICE"
echo ""

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

# 4.5 Instalar/atualizar dependencias Python do backend
echo "→ Instalando dependencias Python..."
# Detecta venv (checa locais conhecidos, incluindo /app/venv onde o systemd aponta)
VENV_ACTIVATE=""
for path in \
    "/app/venv/bin/activate" \
    "$REPO/backend/venv/bin/activate" \
    "$REPO/backend/.venv/bin/activate" \
    "$REPO/venv/bin/activate" \
    "$REPO/.venv/bin/activate"
do
    if [ -f "$path" ]; then
        VENV_ACTIVATE="$path"
        break
    fi
done
if [ -n "$VENV_ACTIVATE" ]; then
    echo "   venv: $VENV_ACTIVATE"
    # shellcheck disable=SC1090
    source "$VENV_ACTIVATE"
    pip install --disable-pip-version-check -q -r "$REPO/backend/requirements.txt" || {
        echo "❌ pip install (venv) falhou — abortando"
        deactivate
        exit 1
    }
    deactivate
else
    echo "   Python do sistema (sem venv)"
    # --break-system-packages: Ubuntu 24+ protege system Python
    # --ignore-installed: nao mexe em pacotes gerenciados pelo apt (urllib3, pillow, etc)
    python3 -m pip install --disable-pip-version-check -q \
        --break-system-packages --ignore-installed \
        -r "$REPO/backend/requirements.txt" 2>/dev/null || \
    python3 -m pip install --disable-pip-version-check -q \
        --ignore-installed \
        -r "$REPO/backend/requirements.txt" || {
        echo "❌ pip install (sistema) falhou — abortando"
        exit 1
    }
fi
echo "   ✓ Dependencias Python instaladas/atualizadas"

# 5. Reiniciar backend via systemd (mvno-backend.service)
echo "→ Reiniciando backend via systemd..."
# Force-kill de processo stale APENAS da porta MVNO (nunca 8001 do CRM)
STALE=$(ss -tlnp 2>/dev/null | awk -v p=":$MVNO_PORT" '$4 ~ p{print $NF}' | grep -oP 'pid=\K\d+' | head -1)
if [ -n "$STALE" ]; then
    echo "   Detectado processo antigo (PID $STALE) na porta $MVNO_PORT — killando"
    kill -9 "$STALE" 2>/dev/null || true
    sleep 2
fi
systemctl restart "$MVNO_SERVICE"
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
