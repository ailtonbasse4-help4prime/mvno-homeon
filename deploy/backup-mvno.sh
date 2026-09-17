#!/bin/bash
set -e

BACKUP_DIR="/opt/backups/mvno"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
MAX_BACKUPS=10
MONGO_DB="mvno_management"
MONGO_CONTAINER="homeon-crm-mongodb-1"

# Credenciais do Mongo (auth habilitado desde 17/09/2026 apos ataque ransomware)
MONGO_USER="mvnoadmin"
MONGO_PASS="AxvSjy1itILbGBbnc8ezVxaJUuct"
MONGO_AUTH_DB="admin"

# Backblaze B2 (rclone remote 'b2', bucket homeon-mvno-backup)
B2_REMOTE="b2:homeon-mvno-backup"
B2_ENABLED=1  # 0 para desligar upload externo

echo "=== MVNO Manager - Backup Seguro (Local + B2) ==="
echo "Data: $(date '+%d/%m/%Y %H:%M:%S')"
echo "Destino local: $BACKUP_PATH"
[ "$B2_ENABLED" = "1" ] && echo "Destino externo: $B2_REMOTE/$TIMESTAMP"
echo ""

mkdir -p "$BACKUP_PATH"

echo "[1/6] Backup do banco de dados MongoDB ($MONGO_DB)..."
if docker ps --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
    docker exec "$MONGO_CONTAINER" mongodump \
        -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase "$MONGO_AUTH_DB" \
        --db "$MONGO_DB" --out /tmp/mvno_backup_$TIMESTAMP 2>/dev/null
    docker cp "$MONGO_CONTAINER:/tmp/mvno_backup_$TIMESTAMP/$MONGO_DB" "$BACKUP_PATH/mongodb"
    docker exec "$MONGO_CONTAINER" rm -rf /tmp/mvno_backup_$TIMESTAMP
    DOCS=$(docker exec "$MONGO_CONTAINER" mongosh "$MONGO_DB" \
        -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase "$MONGO_AUTH_DB" \
        --quiet --eval "
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

echo "[2/6] Backup do backend (server.py + services/)..."
mkdir -p "$BACKUP_PATH/backend"
cp /opt/mvno-homeon/backend/server.py "$BACKUP_PATH/backend/" 2>/dev/null || cp /app/backend/server.py "$BACKUP_PATH/backend/" 2>/dev/null || true
cp -r /opt/mvno-homeon/backend/services "$BACKUP_PATH/backend/services" 2>/dev/null || cp -r /app/backend/services "$BACKUP_PATH/backend/services" 2>/dev/null || true

echo "[3/6] Backup das configuracoes (.env)..."
mkdir -p "$BACKUP_PATH/config"
cp /opt/mvno-homeon/backend/.env "$BACKUP_PATH/config/backend.env" 2>/dev/null || cp /app/backend/.env "$BACKUP_PATH/config/backend.env" 2>/dev/null || true
cp /etc/nginx/sites-enabled/app-ativacao "$BACKUP_PATH/config/nginx-config" 2>/dev/null || true

echo "[4/6] Backup do frontend (build)..."
if [ -d "/var/www/mvno/frontend" ]; then
    tar -czf "$BACKUP_PATH/frontend-build.tar.gz" -C /var/www/mvno/frontend . 2>/dev/null
    echo "  -> Frontend compactado"
else
    echo "  AVISO: /var/www/mvno/frontend nao encontrado"
fi

echo "[5/6] Upload para Backblaze B2 (offsite backup)..."
if [ "$B2_ENABLED" = "1" ] && command -v rclone >/dev/null 2>&1; then
    if rclone lsd b2: >/dev/null 2>&1; then
        rclone sync "$BACKUP_PATH" "$B2_REMOTE/$TIMESTAMP" \
            --transfers 4 --checkers 8 --progress=false --stats=0 2>&1 | tail -10
        # Rotacao offsite: mantem apenas os MAX_BACKUPS mais recentes no B2
        rclone lsf "$B2_REMOTE" --dirs-only 2>/dev/null | sort -r | tail -n +$((MAX_BACKUPS + 1)) | while read old; do
            old_clean=$(echo "$old" | sed 's|/$||')
            echo "  Removendo backup antigo no B2: $old_clean"
            rclone purge "$B2_REMOTE/$old_clean" 2>/dev/null || true
        done
        echo "  -> Upload concluido para $B2_REMOTE/$TIMESTAMP"
    else
        echo "  ERRO: rclone nao consegue conectar ao B2. Backup so local."
    fi
else
    echo "  B2 desabilitado ou rclone nao instalado. Pulando upload externo."
fi

echo "[6/6] Rotacao de backups antigos locais (mantendo ultimos $MAX_BACKUPS)..."
BACKUP_COUNT=$(ls -1d "$BACKUP_DIR"/20* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1d "$BACKUP_DIR"/20* | head -n "$REMOVE_COUNT" | while read old_backup; do
        echo "  Removendo backup antigo local: $(basename $old_backup)"
        rm -rf "$old_backup"
    done
fi

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" 2>/dev/null | cut -f1)
echo ""
echo "=== BACKUP CONCLUIDO COM SUCESSO! ==="
echo "Local: $BACKUP_PATH ($BACKUP_SIZE)"
[ "$B2_ENABLED" = "1" ] && echo "Externo: $B2_REMOTE/$TIMESTAMP"
echo "Backups locais existentes: $(ls -1d "$BACKUP_DIR"/20* 2>/dev/null | wc -l)"
echo ""
echo "Para restaurar o banco:"
echo "  bash /opt/mvno-homeon/deploy/restaurar-backup.sh $TIMESTAMP"
