#!/usr/bin/env bash
# Creates /opt/hera/shared/.env with fresh secrets. Never overwrites an existing file.
set -euo pipefail
ENV_FILE=/opt/hera/shared/.env
if [ -f "$ENV_FILE" ]; then echo "$ENV_FILE exists; leaving it alone."; exit 0; fi
umask 077
cat > "$ENV_FILE" <<ENV
# Hera API production settings. Generated $(date -u +%FT%TZ). Keep this file private.
NODE_ENV=production
PORT=4100
WEB_ORIGIN=https://www.heralayer.com
# Embedded Postgres (PGlite) under DATA_DIR/pg; set DATABASE_URL to use a Postgres server instead.
DATA_DIR=/opt/hera/shared/data
API_KEY_PEPPER=$(openssl rand -base64 32)
WEBHOOK_SECRET_KEY=$(openssl rand -base64 32)
COOKIE_SECURE=true
# Browser -> Vercel -> nginx -> API: two proxy hops, so rate limits see the client IP.
TRUST_PROXY=2
# Email: set RESEND_API_KEY and switch to MAIL_DRIVER=resend once heralayer.com is verified in Resend.
MAIL_DRIVER=log
RESEND_API_KEY=
MAIL_FROM=Hera <no-reply@heralayer.com>
# Chain data endpoints, primary first; requests fail over between them.
HORIZON_URLS=https://horizon.stellar.org,https://horizon.stellar.lobstr.co
# Optional: a Blockscout PRO key adds api.blockscout.com as an Ethereum fallback.
BLOCKSCOUT_API_KEY=
ENV
echo "Wrote $ENV_FILE"
