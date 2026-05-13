#!/bin/bash
set -e

echo "======================================="
echo "  Empacotando MVNO Manager para Deploy"
echo "======================================="

OUTPUT_DIR="/app/deploy"
PACKAGE_DIR="/tmp/mvno-manager-deploy"

# Limpar pasta temporaria
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copiar estrutura de deploy
cp "$OUTPUT_DIR/docker-compose.yml" "$PACKAGE_DIR/"
cp "$OUTPUT_DIR/.env.example" "$PACKAGE_DIR/"
cp "$OUTPUT_DIR/setup.sh" "$PACKAGE_DIR/"
cp "$OUTPUT_DIR/nginx-ssl.conf" "$PACKAGE_DIR/"
cp "$OUTPUT_DIR/README_DEPLOY.md" "$PACKAGE_DIR/"

# Copiar backend
mkdir -p "$PACKAGE_DIR/backend"
cp "$OUTPUT_DIR/backend/Dockerfile" "$PACKAGE_DIR/backend/"
cp /app/backend/server.py "$PACKAGE_DIR/backend/"
cp /app/backend/requirements.txt "$PACKAGE_DIR/backend/"
cp -r /app/backend/services "$PACKAGE_DIR/backend/services/"
find "$PACKAGE_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Copiar frontend
mkdir -p "$PACKAGE_DIR/frontend"
cp "$OUTPUT_DIR/frontend/Dockerfile" "$PACKAGE_DIR/frontend/"
cp "$OUTPUT_DIR/frontend/nginx.conf" "$PACKAGE_DIR/frontend/"
cp /app/frontend/package.json "$PACKAGE_DIR/frontend/"
cp /app/frontend/yarn.lock "$PACKAGE_DIR/frontend/"
cp -r /app/frontend/src "$PACKAGE_DIR/frontend/src/"
cp -r /app/frontend/public "$PACKAGE_DIR/frontend/public/"

# Copiar configs do tailwind/etc
for f in tailwind.config.js postcss.config.js jsconfig.json; do
    [ -f "/app/frontend/$f" ] && cp "/app/frontend/$f" "$PACKAGE_DIR/frontend/"
done

# Gerar pacote tar.gz
cd /tmp
tar -czf /app/deploy/mvno-manager-deploy.tar.gz -C /tmp mvno-manager-deploy/

# Limpar
rm -rf "$PACKAGE_DIR"

SIZE=$(du -h /app/deploy/mvno-manager-deploy.tar.gz | cut -f1)
echo ""
echo "======================================="
echo "  Pacote gerado com sucesso!"
echo "  Arquivo: /app/deploy/mvno-manager-deploy.tar.gz"
echo "  Tamanho: $SIZE"
echo "======================================="
echo ""
echo "Para fazer download, use o botao 'Download' no painel"
echo "ou copie via SCP:"
echo "  scp usuario@preview:/app/deploy/mvno-manager-deploy.tar.gz ."
