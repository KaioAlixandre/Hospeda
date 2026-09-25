#!/usr/bin/env bash
# Exemplo de deploy do catálogo público via rsync.
# Ajuste USER, HOST e DEST conforme o servidor.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USER="${DEPLOY_USER:-deploy}"
HOST="${DEPLOY_HOST:-staydesk.com.br}"
DEST="${DEPLOY_DEST:-/var/www/staydesck-catalogo}"

cd "$ROOT"
npm ci
npm run build

rsync -avz --delete \
  "$ROOT/dist/" \
  "${USER}@${HOST}:${DEST}/"

echo "Deploy concluído → ${HOST}:${DEST}"
