#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "${BACKUP_DIR}"

DATE_TAG="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/teamup_${DATE_TAG}.sql.gz"

POSTGRES_USER="${POSTGRES_USER:-teamup}"
POSTGRES_DB="${POSTGRES_DB:-teamup}"

docker exec teamup_postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${FILE}"
echo "Backup created: ${FILE}"

# Keep last 14 backups
ls -1t "${BACKUP_DIR}"/teamup_*.sql.gz | tail -n +15 | xargs -r rm -f

