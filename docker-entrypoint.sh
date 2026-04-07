#!/bin/sh
set -e
cd /app

needs_npm_install() {
  [ ! -f node_modules/class-transformer/package.json ] \
    || [ ! -f node_modules/class-validator/package.json ] \
    || [ ! -f node_modules/typescript/package.json ]
}

if needs_npm_install; then
  echo "[docker-entrypoint] npm install (node_modules incompleto ou desatualizado)"
  npm install --legacy-peer-deps --ignore-scripts
fi

if [ "${ALWAYS_BUILD_DIST:-}" = "1" ] || [ ! -f dist/main.js ]; then
  echo "[docker-entrypoint] prisma generate + npm run build"
  npx prisma generate
  npm run build
fi

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

if [ "${SKIP_PRISMA_SCHEMA_SYNC:-0}" != "1" ]; then
  echo "[docker-entrypoint] sincronizar schema Prisma (STOKIO_DATABASE_URL / DB_*)"
  if find prisma/migrations -type f -name migration.sql 2>/dev/null | grep -q .; then
    npx prisma migrate deploy
  else
    if [ "${PRISMA_COMPAT_LEGACY_LOGIN_UNIQUE:-1}" = "1" ]; then
      echo "[docker-entrypoint] compat Prisma/Postgres (login_login_key) antes de db push"
      npx prisma db execute --file prisma/compat-before-db-push.sql --schema prisma/schema.prisma
    fi
    npx prisma db push --skip-generate --accept-data-loss
  fi
fi

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
  if find prisma/migrations -type f -name migration.sql 2>/dev/null | grep -q .; then
    STOKIO_DATABASE_URL="$E2E_DATABASE_URL" DATABASE_URL="$E2E_DATABASE_URL" npx prisma migrate deploy
  else
    STOKIO_DATABASE_URL="$E2E_DATABASE_URL" DATABASE_URL="$E2E_DATABASE_URL" npx prisma db push --skip-generate --accept-data-loss
  fi
  npm run test:e2e
fi

exec "$@"
