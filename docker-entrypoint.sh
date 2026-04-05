#!/bin/sh
set -e
cd /app

# Com ../backend:/app o bind mount substitui o código; o volume anónimo em /app/node_modules
# pode nascer vazio (primeira subida) ou desatualizado — sem class-transformer o tsc falha.
needs_npm_install() {
  [ ! -f node_modules/class-transformer/package.json ] \
    || [ ! -f node_modules/class-validator/package.json ] \
    || [ ! -f node_modules/typescript/package.json ]
}

if needs_npm_install; then
  echo "[docker-entrypoint] npm install (node_modules incompleto ou desatualizado)"
  npm install --legacy-peer-deps --ignore-scripts
fi

# Com ../backend:/app o código vem do host; um volume em /app/dist pode ficar com JS antigo
# (aliases errados, etc.). ALWAYS_BUILD_DIST=1 força tsc+tsc-alias em cada arranque.
if [ "${ALWAYS_BUILD_DIST:-}" = "1" ] || [ ! -f dist/main.js ]; then
  echo "[docker-entrypoint] prisma generate + npm run build"
  npx prisma generate
  npm run build
fi

# No Compose, DB_HOST=postgres vem do ambiente; o .env montado do host costuma ter localhost e
# quebra prisma db push / runtime (Prisma usa STOKIO_DATABASE_URL no schema.prisma).
if [ -n "${DB_HOST:-}" ] && [ -n "${DB_USER:-}" ] && [ -n "${DB_NAME:-}" ]; then
  _MAIN_PG_URL="$(
    node -e "
      const u = encodeURIComponent(process.env.DB_USER || '');
      const p = encodeURIComponent(process.env.DB_PASSWORD || '');
      const h = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const db = process.env.DB_NAME || 'estoque';
      console.log(
        'postgresql://' + u + ':' + p + '@' + h + ':' + port + '/' + encodeURIComponent(db) + '?schema=public',
      );
    "
  )"
  export STOKIO_DATABASE_URL="$_MAIN_PG_URL"
  export DATABASE_URL="$_MAIN_PG_URL"
elif [ -z "${STOKIO_DATABASE_URL:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  export STOKIO_DATABASE_URL="$DATABASE_URL"
elif [ -z "${DATABASE_URL:-}" ] && [ -n "${STOKIO_DATABASE_URL:-}" ]; then
  export DATABASE_URL="$STOKIO_DATABASE_URL"
fi

# Base principal: sem isto o Postgres novo fica vazio e queries falham (ex.: public.tenant).
if [ "${SKIP_PRISMA_SCHEMA_SYNC:-0}" != "1" ]; then
  echo "[docker-entrypoint] sincronizar schema Prisma (STOKIO_DATABASE_URL / DB_*)"
  if find prisma/migrations -type f -name migration.sql 2>/dev/null | grep -q .; then
    npx prisma migrate deploy
  else
    npx prisma db push --skip-generate
  fi
fi

# Schema no DB de teste + e2e (TEST_DB_NAME). Desative com RUN_E2E_ON_START=0.
if [ "${RUN_E2E_ON_START:-0}" = "1" ]; then
  echo "[docker-entrypoint] sincronizar schema (DB de teste) + npm run test:e2e (RUN_E2E_ON_START=1)"
  E2E_DATABASE_URL="$(
    node -e "
      const u = encodeURIComponent(process.env.DB_USER || '');
      const p = encodeURIComponent(process.env.DB_PASSWORD || '');
      const h = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '5432';
      const db = process.env.TEST_DB_NAME || 'estoque_test';
      console.log(
        'postgresql://' + u + ':' + p + '@' + h + ':' + port + '/' + encodeURIComponent(db) + '?schema=public',
      );
    "
  )"
  # Sem prisma/migrations/*/**/migration.sql, migrate deploy não cria tabelas — db push alinha ao schema.prisma.
  if find prisma/migrations -type f -name migration.sql 2>/dev/null | grep -q .; then
    STOKIO_DATABASE_URL="$E2E_DATABASE_URL" DATABASE_URL="$E2E_DATABASE_URL" npx prisma migrate deploy
  else
    STOKIO_DATABASE_URL="$E2E_DATABASE_URL" DATABASE_URL="$E2E_DATABASE_URL" npx prisma db push --skip-generate --accept-data-loss
  fi
  npm run test:e2e
fi

exec "$@"
