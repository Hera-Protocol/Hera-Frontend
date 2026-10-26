#!/usr/bin/env bash
# From a laptop: make the server pull GitHub and run server-deploy.sh.
# Usage: deploy/pm2/deploy.sh [branch]
#   Any host over SSH:  HERA_SSH="ssh -i ~/.ssh/key.pem ubuntu@1.2.3.4" deploy/pm2/deploy.sh
#   GCP (default):      HERA_VM, HERA_ZONE, HERA_PROJECT
set -euo pipefail
VM="${HERA_VM:-clientsignal-backend}"
ZONE="${HERA_ZONE:-europe-west2-b}"
PROJECT="${HERA_PROJECT:-project-d1381d93-d1a1-4050-a31}"
BRANCH="${1:-main}"
REPO_URL="https://github.com/Hera-Protocol/Hera-Frontend.git"

REMOTE="
  set -euo pipefail
  sudo mkdir -p /opt/hera && sudo chown \"\$USER:\$USER\" /opt/hera
  if [ ! -d /opt/hera/repo/.git ]; then git clone --quiet $REPO_URL /opt/hera/repo; fi
  git -C /opt/hera/repo fetch --quiet --prune origin
  git -C /opt/hera/repo checkout --quiet -B $BRANCH origin/$BRANCH
  bash /opt/hera/repo/deploy/pm2/server-deploy.sh
"

if [ -n "${HERA_SSH:-}" ]; then
  echo "Deploying origin/${BRANCH} via ${HERA_SSH}..."
  $HERA_SSH "$REMOTE"
else
  echo "Deploying origin/${BRANCH} to ${VM}..."
  gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --command "$REMOTE"
fi
