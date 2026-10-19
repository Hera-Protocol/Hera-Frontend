#!/usr/bin/env bash
# Creates deploy/.env with fresh production secrets. Never overwrites an existing file.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then echo ".env already exists; leaving it alone."; exit 0; fi
umask 077
cat > .env <<ENV
# Hera API production settings. Generated $(date -u +%FT%TZ). Keep this file private.
API_DOMAIN=server.heralayer.com
WEB_ORIGIN=https://www.heralayer.com
POSTGRES_PASSWORD=$(openssl rand -hex 24)
API_KEY_PEPPER=$(openssl rand -base64 32)
WEBHOOK_SECRET_KEY=$(openssl rand -base64 32)
COOKIE_SECURE=true
# Browser -> Vercel -> Caddy -> API: trust two proxy hops so rate limits see the client IP.
TRUST_PROXY=2
# Email: set RESEND_API_KEY and switch MAIL_DRIVER to resend once heralayer.com is verified in Resend.
MAIL_DRIVER=log
RESEND_API_KEY=
MAIL_FROM=Hera <no-reply@heralayer.com>
# Chain data endpoints (comma-separated, primary first). Requests fail over between them.
HORIZON_URLS=https://horizon.stellar.org,https://horizon.stellar.lobstr.co
# Optional: a Blockscout PRO API key adds api.blockscout.com as an Ethereum fallback.
BLOCKSCOUT_API_KEY=
ENV
echo "Wrote $(pwd)/.env"
