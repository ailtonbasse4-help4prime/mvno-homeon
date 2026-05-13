#!/bin/bash
# ============================================================================
# SCRIPT FORENSE DE RECUPERACAO - Coluna "Recarga Ta"
# Rodar na VPS para tentar recuperar os valores manuais perdidos.
# ============================================================================
# Uso: bash RECUPERAR_RECARGA_TA.sh
# Nao modifica nada. Apenas LE. So gera relatorios.
# ============================================================================

set -e
cd /app/backend 2>/dev/null || cd /opt/mvno/backend 2>/dev/null || { echo "ERRO: pasta backend nao encontrada"; exit 1; }

# Carrega variaveis do .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "==============================================================="
echo "RELATORIO FORENSE - RECUPERACAO DA COLUNA 'Recarga Ta'"
echo "Data: $(date)"
echo "==============================================================="
echo ""

# ----------------------------------------------------------------------------
# 1. Estado atual do banco
# ----------------------------------------------------------------------------
echo "### 1. ESTADO ATUAL DO BANCO ###"
mongosh "$MONGO_URL" --quiet --eval "
use('$DB_NAME');
const total = db.linhas.countDocuments({});
const com_data = db.linhas.countDocuments({expirar_dados: {\$ne: null}});
const sem_data = db.linhas.countDocuments({\$or: [{expirar_dados: null}, {expirar_dados: {\$exists: false}}]});
const com_flag = db.linhas.countDocuments({expirar_dados_manual: true});
print('  Total de linhas: ' + total);
print('  Com expirar_dados preenchido: ' + com_data);
print('  Sem expirar_dados: ' + sem_data);
print('  Com flag expirar_dados_manual=true: ' + com_flag);
"
echo ""

# ----------------------------------------------------------------------------
# 2. Audit log de edicoes manuais
# ----------------------------------------------------------------------------
echo "### 2. AUDIT LOGS DE EDICOES MANUAIS ###"
mongosh "$MONGO_URL" --quiet --eval "
use('$DB_NAME');
const cnt = db.logs.countDocuments({action: 'expirar_dados_manual_edit'});
print('  Logs de edicao manual encontrados: ' + cnt);
if (cnt > 0) {
  print('  Ultimas 20 edicoes:');
  db.logs.find({action: 'expirar_dados_manual_edit'}).sort({timestamp: -1}).limit(20).forEach(l => {
    print('    - ' + l.timestamp.toISOString() + ' | ' + (l.description || l.descricao || ''));
  });
}
"
echo ""

# ----------------------------------------------------------------------------
# 3. Manual overrides (backup imutavel)
# ----------------------------------------------------------------------------
echo "### 3. BACKUP IMUTAVEL (manual_overrides) ###"
mongosh "$MONGO_URL" --quiet --eval "
use('$DB_NAME');
const cnt = db.manual_overrides.countDocuments({});
print('  Total de overrides: ' + cnt);
if (cnt > 0) {
  db.manual_overrides.find({}).sort({updated_at: -1}).limit(20).forEach(o => {
    print('    - linha=' + o.linha_id + ' valor=' + o.value + ' em ' + (o.updated_at && o.updated_at.toISOString()));
  });
}
"
echo ""

# ----------------------------------------------------------------------------
# 4. MongoDB Oplog (se for replica set)
# ----------------------------------------------------------------------------
echo "### 4. MONGODB OPLOG (replica set) ###"
HAS_OPLOG=$(mongosh "$MONGO_URL" --quiet --eval "db.getSiblingDB('local').oplog.rs ? 'YES' : 'NO'" 2>/dev/null || echo "NO")
if [ "$HAS_OPLOG" = "YES" ]; then
  echo "  Oplog detectado. Procurando UPDATEs em db.linhas com expirar_dados..."
  mongosh "$MONGO_URL" --quiet --eval "
  const local = db.getSiblingDB('local');
  const cnt = local.oplog.rs.countDocuments({ns: '$DB_NAME.linhas', op: 'u'});
  print('  Total de UPDATEs em linhas no oplog: ' + cnt);
  if (cnt > 0) {
    print('  Ultimos 10 UPDATEs com expirar_dados:');
    local.oplog.rs.find({
      ns: '$DB_NAME.linhas',
      op: 'u',
      \$or: [
        {'o.diff.u.expirar_dados': {\$exists: true}},
        {'o.\$set.expirar_dados': {\$exists: true}}
      ]
    }).sort({ts: -1}).limit(10).forEach(o => {
      print('    - ts=' + o.ts.toString() + ' op2=' + JSON.stringify(o.o2 || {}) + ' diff=' + JSON.stringify(o.o.diff || o.o.\$set || {}));
    });
  }
  "
else
  echo "  ❌ Sem oplog (MongoDB nao esta em replica set). Nao da pra recuperar via oplog."
fi
echo ""

# ----------------------------------------------------------------------------
# 5. mongodumps locais
# ----------------------------------------------------------------------------
echo "### 5. BACKUPS LOCAIS (mongodump) ###"
DUMPS=$(find / -type d -name "linhas*" 2>/dev/null | grep -i dump | head -20)
DUMP_FILES=$(find / -name "linhas.bson*" 2>/dev/null | head -10)
DUMP_DIRS=$(find / -type d \( -name "*backup*" -o -name "*dump*" -o -name "*mongodump*" \) 2>/dev/null | grep -v node_modules | grep -v ".cache" | head -20)
if [ -n "$DUMP_FILES" ]; then
  echo "  Possiveis dumps encontrados:"
  echo "$DUMP_FILES"
  echo ""
  echo "  Detalhes (data de modificacao):"
  for f in $DUMP_FILES; do
    ls -lh "$f"
  done
else
  echo "  ❌ Nenhum mongodump encontrado em /"
fi
if [ -n "$DUMP_DIRS" ]; then
  echo ""
  echo "  Pastas suspeitas de backup:"
  echo "$DUMP_DIRS"
fi
echo ""

# ----------------------------------------------------------------------------
# 6. Snapshots de VPS (Hetzner/DO/AWS)
# ----------------------------------------------------------------------------
echo "### 6. INDICATIVOS DE SNAPSHOT/BACKUP DA VPS ###"
echo "  Verifique no painel do seu provedor (Hetzner, DigitalOcean, etc)"
echo "  se existe snapshot anterior ao dia do deploy."
echo ""

# ----------------------------------------------------------------------------
# 7. Relatorio: linhas com expirar_dados suspeito
# ----------------------------------------------------------------------------
echo "### 7. LINHAS COM expirar_dados RECENTEMENTE ALTERADAS PELO AUTO-SYNC ###"
echo "  (Possivelmente sobrescritas - candidatas a re-input manual)"
mongosh "$MONGO_URL" --quiet --eval "
use('$DB_NAME');
const linhas = db.linhas.find({
  expirar_dados_updated_at: {\$exists: true},
  expirar_dados_manual: {\$ne: true}
}).sort({expirar_dados_updated_at: -1}).limit(30).toArray();
print('  Top 30 mais recentes:');
linhas.forEach(l => {
  const cli = db.clientes.findOne({_id: l.cliente_id ? (typeof l.cliente_id === 'string' ? ObjectId(l.cliente_id) : l.cliente_id) : null});
  const nome = cli ? cli.nome : '?';
  print('    - ' + nome + ' | ' + l.numero + ' | expirar=' + l.expirar_dados + ' | sync=' + (l.expirar_dados_updated_at && l.expirar_dados_updated_at.toISOString()));
});
"
echo ""

echo "==============================================================="
echo "FIM DO RELATORIO"
echo "==============================================================="
echo ""
echo "PROXIMOS PASSOS:"
echo "  1. Se houver MUITOS audit logs (item 2), execute:"
echo "     curl -X POST \$BACKEND_URL/api/operacional/restaurar-edicoes-manuais -H 'Authorization: Bearer SEU_TOKEN'"
echo "  2. Se houver mongodump (item 5), me envie a saida acima."
echo "  3. Se nada disso funcionar, infelizmente sera necessario re-input manual."
echo "     Mas a partir de AGORA, toda edicao e protegida em DOIS lugares:"
echo "     - db.logs (com action=expirar_dados_manual_edit)"
echo "     - db.manual_overrides (backup imutavel)"
