#!/usr/bin/env bash
# Build the committed code on the server and (re)start it under pm2.
# Usage: deploy/pm2/deploy.sh   (env: HERA_VM, HERA_ZONE, HERA_PROJECT)
set -euo pipefail
VM="${HERA_VM:-clientsignal-backend}"
ZONE="${HERA_ZONE:-europe-west2-b}"
PROJECT="${HERA_PROJECT:-project-d1381d93-d1a1-4050-a31}"
ROOT="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
TARBALL="$(mktemp -t hera-XXXX).tar.gz"
trap 'rm -f "$TARBALL"' EXIT

git -C "$ROOT" archive --format=tar.gz -o "$TARBALL" HEAD
echo "Shipping $SHA to $VM…"
gcloud compute scp "$TARBALL" "$VM:/tmp/hera-$SHA.tar.gz" --zone "$ZONE" --project "$PROJECT"
gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command "SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH" COREPACK_ENABLE_DOWNLOAD_PROMPT=0
sudo mkdir -p /opt/hera/releases /opt/hera/shared/data
sudo chown -R "$USER:$USER" /opt/hera

# pnpm in the user's own prefix: nothing system-wide changes.
command -v pnpm >/dev/null || npm install -g pnpm@10.18.0 --prefix "$HOME/.local" >/dev/null

REL=/opt/hera/releases/$SHA
rm -rf "$REL" && mkdir -p "$REL"
tar -xzf "/tmp/hera-$SHA.tar.gz" -C "$REL" && rm -f "/tmp/hera-$SHA.tar.gz"
cd "$REL"
pnpm install --frozen-lockfile --filter "@hera/api..." --reporter=append-only | tail -3
pnpm --filter @hera/api build | tail -3

bash deploy/pm2/init-env.sh
ln -sfn "$REL" /opt/hera/current
pm2 startOrReload /opt/hera/current/deploy/pm2/ecosystem.config.cjs --update-env
pm2 save >/dev/null

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:4100/v1/health >/dev/null 2>&1; then echo "hera-api healthy ($SHA)"; break; fi
  [ "$i" = 30 ] && { echo "hera-api did not become healthy"; pm2 logs hera-api --lines 40 --nostream; exit 1; }
  sleep 2
done

# Keep the three most recent releases for quick rollback.
ls -1dt /opt/hera/releases/* | tail -n +4 | xargs -r rm -rf
REMOTE
