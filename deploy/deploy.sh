#!/usr/bin/env bash
# Ship the committed code to the VM and (re)start the stack.
# Usage: deploy/deploy.sh   (env: HERA_VM, HERA_ZONE, HERA_PROJECT)
set -euo pipefail
VM="${HERA_VM:-hera-api}"
ZONE="${HERA_ZONE:-europe-west2-b}"
PROJECT="${HERA_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
ROOT="$(git rev-parse --show-toplevel)"
TARBALL="$(mktemp -t hera-XXXX).tar.gz"
trap 'rm -f "$TARBALL"' EXIT

git -C "$ROOT" archive --format=tar.gz -o "$TARBALL" HEAD
echo "Shipping $(git -C "$ROOT" rev-parse --short HEAD) to $VM ($ZONE)…"
gcloud compute scp "$TARBALL" "$VM:/tmp/hera.tar.gz" --zone "$ZONE" --project "$PROJECT"
gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command '
  set -euo pipefail
  sudo mkdir -p /opt/hera
  # Keep the server-side secrets across deploys.
  if [ -f /opt/hera/deploy/.env ]; then sudo cp /opt/hera/deploy/.env /tmp/hera.env; fi
  sudo find /opt/hera -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  sudo tar -xzf /tmp/hera.tar.gz -C /opt/hera
  if [ -f /tmp/hera.env ]; then sudo mv /tmp/hera.env /opt/hera/deploy/.env; fi
  sudo bash /opt/hera/deploy/init-env.sh
  cd /opt/hera/deploy
  sudo docker compose up -d --build --remove-orphans
  sudo docker image prune -f >/dev/null
  sudo docker compose ps
'
