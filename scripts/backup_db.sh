#!/usr/bin/env bash
# ==============================================================================
# AOTUC-TRANSPORT v2.0 — Automated Linux / Docker Database Backup Script
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/aotuc}"
CONTAINER_NAME="${CONTAINER_NAME:-aotuc_postgres_postgis}"
DB_USER="${POSTGRES_USER:-aotuc_admin}"
DB_NAME="${POSTGRES_DB:-aotuc_transport}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/aotuc_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[AOTUC] Démarrage de la sauvegarde de la base PostGIS..."
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip -9 > "${BACKUP_FILE}"

echo "✓ Sauvegarde générée avec succès : ${BACKUP_FILE}"
ls -lh "${BACKUP_FILE}"

# Retention policy: Delete backups older than 30 days
find "${BACKUP_DIR}" -type f -name "aotuc_backup_*.sql.gz" -mtime +30 -delete
echo "Nettoyage des sauvegardes de plus de 30 jours terminé."
