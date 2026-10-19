#!/usr/bin/env bash
# Runs ON the server. Builds the repo's current commit into its own release
# folder, points /opt/hera/current at it, and (re)starts hera-api under pm2.
#   cd /opt/hera/repo && git pull && bash deploy/pm2/server-deploy.sh
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0
REPO=/opt/hera/repo
SHA="$(git -C "$REPO" rev-parse --short HEAD)"
REL=/opt/hera/releases/$SHA

mkdir -p /opt/hera/releases /opt/hera/shared/data
# pnpm in the user's own prefix: nothing system-wide changes.
command -v pnpm >/dev/null || npm install -g pnpm@10.18.0 --prefix "$HOME/.local" >/dev/null

echo "Building $SHA…"
rm -rf "$REL" && mkdir -p "$REL"
git -C "$REPO" archive HEAD | tar -x -C "$REL"
cd "$REL"
pnpm install --frozen-lockfile --filter "@hera/api..." --reporter=append-only | tail -2
pnpm --filter @hera/api build | tail -2

bash "$REL/deploy/pm2/init-env.sh"
PREVIOUS="$(readlink /opt/hera/current 2>/dev/null || true)"
ln -sfn "$REL" /opt/hera/current
pm2 startOrReload /opt/hera/current/deploy/pm2/ecosystem.config.cjs --update-env >/dev/null
pm2 save >/dev/null

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4100/v1/health >/dev/null 2>&1; then echo "hera-api healthy ($SHA)"; break; fi
  if [ "$i" = 30 ]; then
    echo "hera-api did not become healthy; rolling back to ${PREVIOUS:-nothing}"
    pm2 logs hera-api --lines 40 --nostream || true
    if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$REL" ]; then ln -sfn "$PREVIOUS" /opt/hera/current && pm2 reload hera-api --update-env; fi
    exit 1
  fi
  sleep 2
done

# Keep the three most recent releases for quick rollback.
ls -1dt /opt/hera/releases/* | tail -n +4 | xargs -r rm -rf
