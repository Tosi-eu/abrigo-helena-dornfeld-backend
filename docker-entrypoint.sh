#!/bin/sh
set -e
cd /app

# Com ../backend:/app o código vem do host; um volume em /app/dist pode ficar com JS antigo
# (aliases errados, etc.). ALWAYS_BUILD_DIST=1 força tsc+tsc-alias em cada arranque.
if [ "${ALWAYS_BUILD_DIST:-}" = "1" ] || [ ! -f dist/main.js ]; then
  echo "[docker-entrypoint] prisma generate + npm run build"
  npx prisma generate
  npm run build
fi

exec "$@"
