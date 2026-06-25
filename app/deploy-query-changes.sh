#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Deploy helper for the Query entity + Infrastructure-banding changes.
# Vercel CLI workflow, macOS.
#
# WHAT THIS DOES (and deliberately does NOT do):
#   - Verifies you're in the right project and on the right Node version
#   - Confirms the two changed files are in place
#   - Runs lint, tests, and the real production build locally
#   - STOPS before deploying. It does not push anything live.
#     You run the deploy yourself with the one-liner it prints at the end.
#
# It will not deploy, will not touch production, and will refuse to continue
# if any check fails. Safe to run as many times as you like.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail   # stop immediately if any command fails

# Colours for readable output
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo "────────────────────────────────────────────────"
echo " Query changes — pre-deploy verification"
echo "────────────────────────────────────────────────"

# 1. Confirm we're in the project root (package.json with the right name area)
[ -f "package.json" ] || fail "No package.json here. cd into your project folder first."
[ -f "vercel.json" ]  || fail "No vercel.json here. This doesn't look like the AI-Enterprise project root."
ok "In a Next.js project root."

# 2. Confirm the two changed files exist where they should
[ -f "lib/intelligence/entities.ts" ] || fail "Missing lib/intelligence/entities.ts — download it and place it there first."
[ -f "app/query-v2/QueryV2Client.tsx" ] || fail "Missing app/query-v2/QueryV2Client.tsx — download it and place it there first."
ok "Both changed files are in place."

# 3. Quick sanity: the new file actually contains the new entities + bands
grep -q "WINNING_BY_LAYER" lib/intelligence/entities.ts || fail "entities.ts looks wrong (no WINNING_BY_LAYER). Re-download it."
grep -q "data_platform" lib/intelligence/entities.ts || fail "entities.ts looks wrong (no data_platform band). Re-download it."
grep -q "Infrastructure by layer" app/query-v2/QueryV2Client.tsx || fail "QueryV2Client.tsx looks wrong (no band panel). Re-download it."
ok "File contents look correct."

# 4. Node version check (repo pins Node 24 via .nvmrc)
if command -v nvm >/dev/null 2>&1; then nvm use >/dev/null 2>&1 || true; fi
NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" != "24" ]; then
  warn "Node is v$NODE_MAJOR but this repo expects v24. Vercel builds on 24."
  warn "If you have nvm: run 'nvm install 24 && nvm use 24' then re-run this script."
  read -p "Continue anyway? (y/N) " yn; [ "$yn" = "y" ] || exit 1
else
  ok "Node v24 (matches repo)."
fi

# 5. Install dependencies (no-op if already current)
echo ""; echo "Installing dependencies..."
npm install >/dev/null 2>&1 && ok "Dependencies ready." || fail "npm install failed."

# 6. The three checks. Each must pass.
echo ""; echo "Running lint..."
npm run lint && ok "Lint passed." || fail "Lint failed — fix the issues above before deploying."

echo ""; echo "Running tests..."
npm test && ok "Tests passed." || fail "Tests failed — investigate before deploying."

echo ""; echo "Running production build (the real test — same as Vercel)..."
npm run build && ok "Build succeeded." || fail "Build failed — send the error above to Claude."

# 7. Done — print the deploy commands but do NOT run them
echo ""
echo "────────────────────────────────────────────────"
echo -e "${GREEN} All checks passed. Nothing has been deployed yet.${NC}"
echo "────────────────────────────────────────────────"
echo ""
echo "Next, deploy a PREVIEW (private URL, does not touch production):"
echo ""
echo -e "    ${YELLOW}vercel${NC}"
echo ""
echo "Open the preview URL it gives you, go to /query-v2, and check the"
echo "Infrastructure tab shows the four bands. If it looks right, promote"
echo "it to your live site with:"
echo ""
echo -e "    ${YELLOW}vercel --prod${NC}"
echo ""
echo "If anything is wrong after going live, roll back instantly in the"
echo "Vercel dashboard: Deployments → last good one → ⋯ → Promote to Production."
echo ""
