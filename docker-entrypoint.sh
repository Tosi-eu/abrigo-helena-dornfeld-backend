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

needs_dist_rebuild() {
  [ "${ALWAYS_BUILD_DIST:-}" = "1" ] && return 0
  [ ! -f dist/main.js ] && return 0
  _any=$(find src -type f -name '*.ts' -newer dist/main.js 2>/dev/null | head -n 1)
  [ -n "$_any" ] && return 0
  return 1
}

if needs_dist_rebuild; then
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
    # P3005: base já tem tabelas (ex.: db push / restore) mas _prisma_migrations vazio ou sem baseline.
    set +e
    npx prisma migrate deploy > /tmp/prisma_migrate_deploy.log 2>&1
    MIGRATE_EXIT=$?
    set -e
    if [ "$MIGRATE_EXIT" -ne 0 ]; then
      if grep -qE 'P3005|database schema is not empty' /tmp/prisma_migrate_deploy.log 2>/dev/null; then
        cat /tmp/prisma_migrate_deploy.log
        if [ "${PRISMA_AUTO_BASELINE:-0}" = "1" ]; then
          echo "[docker-entrypoint] P3005: PRISMA_AUTO_BASELINE=1 — aplicar SQL + migrate resolve e repetir deploy"
          for mig_dir in prisma/migrations/*/; do
            [ -d "$mig_dir" ] || continue
            name=$(basename "$mig_dir")
            sql="${mig_dir}migration.sql"
            if [ -f "$sql" ]; then
              echo "[docker-entrypoint] prisma db execute + resolve --applied $name"
              npx prisma db execute --file "$sql" --schema prisma/schema.prisma
              npx prisma migrate resolve --applied "$name"
            fi
          done
          npx prisma migrate deploy
        else
          echo "[docker-entrypoint] Dica: base não vazia sem histórico Migrate. Opções:"
          echo "  - Desenvolvimento: defina PRISMA_AUTO_BASELINE=1 no serviço backend (compose)."
          echo "  - Ou volumes limpos: docker compose down -v (apaga dados Postgres)."
          echo "  - Ou baseline manual: prisma db execute --file prisma/migrations/<pasta>/migration.sql && prisma migrate resolve --applied <nome_pasta>"
          exit "$MIGRATE_EXIT"
        fi
      elif grep -qF 'relation "tenant" does not exist' /tmp/prisma_migrate_deploy.log 2>/dev/null \
        || grep -qE 'P3009|P3018' /tmp/prisma_migrate_deploy.log 2>/dev/null; then

        cat /tmp/prisma_migrate_deploy.log
        echo "[docker-entrypoint] Recuperação: migrate resolve --rolled-back, db push, migrate deploy"
        FAILED_MIG=$(sed -n 's/.*The `\([^`]*\)`.*/\1/p' /tmp/prisma_migrate_deploy.log 2>/dev/null | head -n1)
        if [ -z "$FAILED_MIG" ]; then
          FAILED_MIG=$(
            grep 'Migration name:' /tmp/prisma_migrate_deploy.log 2>/dev/null | tail -1 | sed 's/.*Migration name:[[:space:]]*//' | tr -d '\r'
          )
        fi
        if [ -z "$FAILED_MIG" ]; then
          FAILED_MIG="20260205140000_setor_catalog_and_sector_id"
        fi
        set +e
        npx prisma migrate resolve --rolled-back "$FAILED_MIG" >>/tmp/prisma_migrate_recover.log 2>&1
        _rb=$?
        set -e
        if [ "$_rb" -ne 0 ]; then
          echo "[docker-entrypoint] migrate resolve --rolled-back (código $_rb); continuar se já estiver resolvido. Log:"
          cat /tmp/prisma_migrate_recover.log 2>/dev/null || true
        fi
        if [ "${PRISMA_COMPAT_LEGACY_LOGIN_UNIQUE:-1}" = "1" ]; then
          echo "[docker-entrypoint] compat Prisma/Postgres (login_login_key) antes de db push"
          npx prisma db execute --file prisma/compat-before-db-push.sql --schema prisma/schema.prisma || true
        fi
        npx prisma db push --skip-generate --accept-data-loss
        npx prisma migrate deploy > /tmp/prisma_migrate_deploy2.log 2>&1
        MIGRATE2=$?
        if [ "$MIGRATE2" -ne 0 ]; then
          cat /tmp/prisma_migrate_deploy2.log
          exit "$MIGRATE2"
        fi
      else
        cat /tmp/prisma_migrate_deploy.log
        exit "$MIGRATE_EXIT"
      fi
    fi
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
