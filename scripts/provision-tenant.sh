#!/usr/bin/env sh
# Criar tenant via API admin e fumar testes básicos.
# Uso:
#   export API_BASE=http://localhost:3001/api/v1
#   export X_API_KEY=...
#   ./scripts/provision-tenant.sh meu-slug "Nome do Abrigo"
#   ./scripts/provision-tenant.sh meu-slug "Nome" "codigo-contrato"

set -eu

API_BASE="${API_BASE:-http://localhost:3001/api/v1}"
SLUG="${1:?slug}"
NAME="${2:?name}"
CC="${3:-}"

if [ -z "${X_API_KEY:-}" ]; then
  echo "Defina X_API_KEY no ambiente." >&2
  exit 1
fi

if [ -n "$CC" ]; then
  BODY="{\"slug\":\"$SLUG\",\"name\":\"$NAME\",\"contract_code\":\"$CC\"}"
else
  BODY="{\"slug\":\"$SLUG\",\"name\":\"$NAME\"}"
fi

echo "POST $API_BASE/admin/tenants"
curl -sS -X POST "$API_BASE/admin/tenants" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $X_API_KEY" \
  -d "$BODY"
echo ""

echo "GET $API_BASE/health"
curl -sS "$API_BASE/health" || true
echo ""

echo "GET $API_BASE/tenants/${SLUG}/branding"
curl -sS "$API_BASE/tenants/${SLUG}/branding" || true
echo ""
