#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"

echo "Starting TeamUp production deployment..."
cd "${INFRA_DIR}"

docker compose -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.prod.yml up -d --build

echo "Deployment complete."
echo "Health checks:"
echo " - Backend: /health"
echo " - Frontend: /"

