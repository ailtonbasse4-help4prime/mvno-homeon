#!/bin/bash
# =====================================================
# MVNO Manager - Restauracao de Backup MongoDB
# =====================================================
# Uso: bash restaurar-backup.sh [data_backup]
# Exemplo: bash restaurar-backup.sh 20260411_120000
# Sem argumento: lista backups disponiveis
# =====================================================
set -e

BACKUP_DIR="/opt/backups/mvno"
MONGO_DB="mvno_management"
MONGO_CONTAINER="homeon-crm-mongodb-1"

echo "=== MVNO Manager - Restauracao de Backup ==="
echo ""

# Se nenhum argumento, listar backups disponiveis
if [ -z "$1" ]; then
    echo "Backups disponiveis:"
    echo "-------------------"
    if [ -d "$BACKUP_DIR" ]; then
        ls -1d "$BACKUP_DIR"/20* 2>/dev/null | while read backup; do
            name=$(basename "$backup")
            size=$(du -sh "$backup" 2>/dev/null | cut -f1)
            has_db="NAO"
            if [ -d "$backup/mongodb" ]; then
                has_db="SIM"
            fi
            echo "  $name  (Tamanho: $size, DB: $has_db)"
        done
    else
        echo "  Nenhum backup encontrado em $BACKUP_DIR"
    fi
    echo ""
    echo "Uso: bash restaurar-backup.sh <nome_backup>"
    echo "Exemplo: bash restaurar-backup.sh 20260411_120000"
    exit 0
fi

BACKUP_NAME="$1"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

if [ ! -d "$BACKUP_PATH" ]; then
    echo "ERRO: Backup '$BACKUP_NAME' nao encontrado em $BACKUP_DIR"
    exit 1
fi

echo "Backup selecionado: $BACKUP_NAME"
echo "Caminho: $BACKUP_PATH"
echo ""

# Confirmar restauracao
echo "ATENCAO: Isso vai SUBSTITUIR todo o banco de dados atual!"
echo "Dados atuais serao PERDIDOS e substituidos pelo backup."
echo ""
read -p "Deseja continuar? (digite SIM para confirmar): " confirm
if [ "$confirm" != "SIM" ]; then
    echo "Restauracao cancelada."
    exit 0
fi

# Fazer backup de seguranca antes de restaurar
echo ""
echo "[1/3] Fazendo backup de seguranca do estado atual..."
SAFETY_BACKUP="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SAFETY_BACKUP"
if docker ps --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
    docker exec "$MONGO_CONTAINER" mongodump --db "$MONGO_DB" --out /tmp/pre_restore_backup 2>/dev/null || true
    docker cp "$MONGO_CONTAINER:/tmp/pre_restore_backup/$MONGO_DB" "$SAFETY_BACKUP/mongodb" 2>/dev/null || true
    docker exec "$MONGO_CONTAINER" rm -rf /tmp/pre_restore_backup 2>/dev/null || true
else
    mongodump --db "$MONGO_DB" --out "$SAFETY_BACKUP/mongodb" 2>/dev/null || true
fi
echo "  -> Backup de seguranca salvo em: $SAFETY_BACKUP"

# Restaurar banco de dados
echo "[2/3] Restaurando banco de dados MongoDB..."
if [ -d "$BACKUP_PATH/mongodb" ]; then
    if docker ps --format '{{.Names}}' | grep -q "$MONGO_CONTAINER"; then
        # Copy backup to container and restore
        docker cp "$BACKUP_PATH/mongodb" "$MONGO_CONTAINER:/tmp/restore_data"
        docker exec "$MONGO_CONTAINER" mongorestore --db "$MONGO_DB" --drop /tmp/restore_data/ 2>/dev/null
        docker exec "$MONGO_CONTAINER" rm -rf /tmp/restore_data
    else
        mongorestore --db "$MONGO_DB" --drop "$BACKUP_PATH/mongodb/" 2>/dev/null
    fi
    echo "  -> Banco restaurado com sucesso!"
else
    echo "  AVISO: Backup do banco nao encontrado neste backup"
fi

# Restaurar backend se existir
echo "[3/3] Restaurando arquivos do backend..."
if [ -d "$BACKUP_PATH/backend" ]; then
    if [ -f "$BACKUP_PATH/backend/server.py" ]; then
        cp "$BACKUP_PATH/backend/server.py" /opt/mvno-homeon/backend/server.py 2>/dev/null || true
        echo "  -> server.py restaurado"
    fi
    if [ -d "$BACKUP_PATH/backend/services" ]; then
        cp -r "$BACKUP_PATH/backend/services/"* /opt/mvno-homeon/backend/services/ 2>/dev/null || true
        echo "  -> services/ restaurado"
    fi
    # Restart backend
    kill $(pgrep -f "uvicorn server:app") 2>/dev/null || true
    sleep 2
    cd /opt/mvno-homeon/backend && source /app/venv/bin/activate && nohup uvicorn server:app --host 0.0.0.0 --port 3002 --reload > /var/log/mvno-backend.log 2>&1 &
    echo "  -> Backend reiniciado"
else
    echo "  AVISO: Backup do backend nao encontrado"
fi

echo ""
echo "=== RESTAURACAO CONCLUIDA! ==="
echo "Backup de seguranca (pre-restore): $SAFETY_BACKUP"
echo "Se algo deu errado, restaure o backup de seguranca:"
echo "  bash restaurar-backup.sh $(basename $SAFETY_BACKUP)"
