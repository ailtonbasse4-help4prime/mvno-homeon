#!/bin/bash
# =====================================================
# MVNO Manager - Configuracao de Backup Automatico
# =====================================================
# Execute este script UMA VEZ na VPS para configurar
# backup automatico diario as 3:00 da manha
# =====================================================

echo "=== Configurando Backup Automatico MVNO ==="

# Verificar se o cron job ja existe
if crontab -l 2>/dev/null | grep -q "backup-mvno.sh"; then
    echo "Backup automatico ja esta configurado!"
    echo "Configuracao atual:"
    crontab -l | grep "backup-mvno"
    exit 0
fi

# Adicionar cron job - backup diario as 3:00 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /bin/bash /opt/mvno-homeon/deploy/backup-mvno.sh >> /var/log/mvno-backup.log 2>&1") | crontab -

echo "Backup automatico configurado!"
echo "  Horario: Todo dia as 03:00"
echo "  Script: /opt/mvno-homeon/deploy/backup-mvno.sh"
echo "  Log: /var/log/mvno-backup.log"
echo "  Retencao: Ultimos 10 backups"
echo ""
echo "Para verificar: crontab -l"
echo "Para remover: crontab -e (e apagar a linha do backup)"
