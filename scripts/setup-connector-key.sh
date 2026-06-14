#!/usr/bin/env bash
# One-shot: paste a free connector key and we'll write it to .env.local
# AND push to Vercel (preview + production), then probe to confirm.
#
# Usage:
#   ./scripts/setup-connector-key.sh BEA_API_KEY <key-value>
#   ./scripts/setup-connector-key.sh ALPHA_VANTAGE_API_KEY <key-value>
#   ./scripts/setup-connector-key.sh CONGRESS_API_KEY <key-value>
#
# Or interactive:
#   ./scripts/setup-connector-key.sh BEA_API_KEY
# (prompts for the value with no echo)

set -euo pipefail

NAME="${1:-}"
VALUE="${2:-}"

if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <ENV_NAME> [value]"
  echo ""
  echo "Supported keys:"
  echo "  BEA_API_KEY            Register at apps.bea.gov/api/signup       (~1 min, email confirm)"
  echo "  ALPHA_VANTAGE_API_KEY  Register at alphavantage.co/support/#api-key  (~30 sec, no email)"
  echo "  CONGRESS_API_KEY       Register at api.congress.gov/sign-up/v3   (~1 min, email confirm)"
  exit 1
fi

if [[ -z "$VALUE" ]]; then
  printf "Paste %s value (hidden): " "$NAME"
  read -rs VALUE
  echo ""
fi

if [[ -z "$VALUE" ]]; then
  echo "Empty value, aborting."
  exit 1
fi

# 1. Write to .env.local (idempotent — replace if exists, append if not)
if grep -q "^${NAME}=" .env.local 2>/dev/null; then
  # macOS sed needs '' for in-place
  sed -i '' "s|^${NAME}=.*|${NAME}=\"${VALUE}\"|" .env.local
  echo "✓ Updated ${NAME} in .env.local"
else
  echo "${NAME}=\"${VALUE}\"" >> .env.local
  echo "✓ Appended ${NAME} to .env.local"
fi

# 2. Push to Vercel — production first, then attempt preview.
echo ""
echo "─── Pushing to Vercel ───"
printf '%s' "$VALUE" | vercel env add "$NAME" production --force 2>&1 | tail -2 || true
# Preview add will likely require the Git-branch confirmation flow if
# the project isn't Git-connected. Don't fail the script either way.
printf '%s' "$VALUE" | vercel env add "$NAME" preview --force --value "$VALUE" --yes 2>&1 | tail -2 || true

# 3. Probe locally to confirm the connector flips to ok.
echo ""
echo "─── Live probe ───"
case "$NAME" in
  BEA_API_KEY)            npm run probe:connectors -- --only=bea            ;;
  ALPHA_VANTAGE_API_KEY)  npm run probe:connectors -- --only=alphaVantage   ;;
  CONGRESS_API_KEY)       npm run probe:connectors -- --only=congress       ;;
  *)                      npm run probe:connectors                          ;;
esac

echo ""
echo "Next: run 'vercel deploy' to publish a preview with the new key live."
