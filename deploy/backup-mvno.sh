#!/bin/bash
set -e

BACKUP_DIR="/opt/backups/mvno"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
MAX_BACKUPS=10
MONGO_DB="mvno_management"
MONGO_CONTAINER="homeon-crm-mongodb-1"

echo "=== MVNO Manager - Backup Seguro ==="
echo "Data: $(date '+%d/%m/%Y %H:%M:%S')"
echo "Destino: $BACKUP_PATH"
echo ""

mkdir -p "$BACKUP_PATH"

echo "[1/5] Backup do banco de dados MongoDB ($MONGO_DB)..."
if docker ps --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
    docker exec "$MONGO_CONTAINER" mongodump --db "$MONGO_DB" --out /tmp/mvno_backup_$TIMESTAMP 2>/dev/null
    docker cp "$MONGO_CONTAINER:/tmp/mvno_backup_$TIMESTAMP/$MONGO_DB" "$BACKUP_PATH/mongodb"
    docker exec "$MONGO_CONTAINER" rm -rf /tmp/mvno_backup_$TIMESTAMP
    DOCS=$(docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" --quiet --eval "
        const cols = db.getCollectionNames();
        let total = 0;
        cols.forEach(c => { total += db[c].countDocuments(); });
        print(total);
    " 2>/dev/null || echo "?")
    echo "  -> $DOCS documentos salvos"
else
    echo "  AVISO: Container MongoDB ($MONGO_CONTAINER) nao encontrado."
    echo "  Tentando mongodump local..."
    mongodump --db "$MONGO_DB" --out "$BACKUP_PATH/mongodb" 2>/dev/null || echo "  ERRO: mongodump falhou"
fi

echo "[2/5] Backup do backend (server.py + services/)..."
mkdir -p "$BACKUP_PATH/backend"
cp /app/server.py "$BACKUP_PATH/backend/" 2>/dev/null || cp /app/backend/server.py "$BACKUP_PATH/backend/" 2>/dev/null || true
cp -r /app/services "$BACKUP_PATH/backend/services" 2>/dev/null || cp -r /app/backend/services "$BACKUP_PATH/backend/services" 2>/dev/null || true

echo "[3/5] Backup das configuracoes (.env)..."
mkdir -p "$BACKUP_PATH/config"
cp /app/.env "$BACKUP_PATH/config/backend.env" 2>/dev/null || cp /app/backend/.env "$BACKUP_PATH/config/backend.env" 2>/dev/null || true
cp /etc/nginx/sites-enabled/app-ativacao "$BACKUP_PATH/config/nginx-config" 2>/dev/null || true

echo "[4/5] Backup do frontend (build)..."
if [ -d "/var/www/mvno/frontend" ]; then
    tar -czf "$BACKUP_PATH/frontend-build.tar.gz" -C /var/www/mvno/frontend . 2>/dev/null
    echo "  -> Frontend compactado"
else
    echo "  AVISO: /var/www/mvno/frontend nao encontrado"
fi

echo "[5/5] Rotacao de backups antigos (mantendo ultimos $MAX_BACKUPS)..."
BACKUP_COUNT=$(ls -1d "$BACKUP_DIR"/20* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1d "$BACKUP_DIR"/20* | head -n "$REMOVE_COUNT" | while read old_backup; do
        echo "  Removendo backup antigo: $(basename $old_backup)"
        rm -rf "$old_backup"
    done
fi

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" 2>/dev/null | cut -f1)
echo ""
echo "=== BACKUP CONCLUIDO COM SUCESSO! ==="
echo "Local: $BACKUP_PATH"
echo "Tamanho: $BACKUP_SIZE"
echo "Backups existentes: $(ls -1d "$BACKUP_DIR"/20* 2>/dev/null | wc -l)"
echo ""
echo "Para restaurar o banco:"
echo "  docker exec -i $MONGO_CONTAINER mongorestore --db $MONGO_DB --drop $BACKUP_PATH/mongodb/"
