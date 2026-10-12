#!/usr/bin/env bash

set -Eeuo pipefail

DOMAIN="gilla.am"
WWW_DOMAIN="www.gilla.am"
APP_ROOT="/var/domains/gilla.am"
APP_PORT="3020"
APP_NAME="gilla.am"
NGINX_CONFIG="/etc/nginx/conf.d/gilla.am.conf"
ACME_ROOT="/var/www/letsencrypt"
SSL_EMAIL="${1:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root: sudo bash $0 you@example.com" >&2
  exit 1
fi

if [[ ! "${SSL_EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Usage: sudo bash $0 you@example.com" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer supports Ubuntu/Debian servers." >&2
  exit 1
fi

if [[ ! -f "${APP_ROOT}/package.json" || ! -f "${APP_ROOT}/ecosystem.config.cjs" ]]; then
  echo "Nuxt project not found in ${APP_ROOT}." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22.19+ or 24.11+ before running this script." >&2
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit((major === 22 && minor >= 19) || (major === 24 && minor >= 11) || major >= 26 ? 0 : 1)'; then
  echo "Unsupported Node.js version: $(node --version)" >&2
  echo "This Nuxt version requires Node.js 22.19+, 24.11+, or 26+." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx curl poppler-utils

if ! command -v pnpm >/dev/null 2>&1; then
  npm install --global pnpm@10
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install --global pm2
fi

cd "${APP_ROOT}"
pnpm install --frozen-lockfile
pnpm build

if [[ ! -f "${APP_ROOT}/.data/admin.json" ]]; then
  node scripts/create-admin.mjs
fi

if pm2 describe "${APP_NAME}" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only "${APP_NAME}" --env production --update-env
else
  pm2 start ecosystem.config.cjs --only "${APP_NAME}" --env production
fi

pm2 startup systemd -u root --hp /root
pm2 save

for attempt in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${APP_PORT}/" >/dev/null; then
    break
  fi

  if [[ "${attempt}" -eq 30 ]]; then
    pm2 logs "${APP_NAME}" --lines 100 --nostream
    echo "Nuxt did not start on port ${APP_PORT}." >&2
    exit 1
  fi

  sleep 1
done

install -d -m 0755 "${ACME_ROOT}/.well-known/acme-challenge"

if [[ -f "${NGINX_CONFIG}" ]]; then
  cp -a "${NGINX_CONFIG}" "${NGINX_CONFIG}.backup.$(date +%Y%m%d-%H%M%S)"
fi

# Start with HTTP so Let's Encrypt can validate both hostnames.
tee "${NGINX_CONFIG}" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    location ^~ /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

nginx -t
systemctl enable --now nginx
systemctl reload nginx

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow 'Nginx Full'
fi

certbot certonly \
  --webroot \
  --webroot-path "${ACME_ROOT}" \
  --cert-name "${DOMAIN}" \
  --domain "${DOMAIN}" \
  --domain "${WWW_DOMAIN}" \
  --email "${SSL_EMAIL}" \
  --agree-tos \
  --non-interactive \
  --expand

# Terminate SSL in Nginx, redirect www, and proxy the main domain to PM2.
tee "${NGINX_CONFIG}" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    location ^~ /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        return 301 https://${DOMAIN}\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WWW_DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    return 301 https://${DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:GILLA_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 45m;

    location ^~ /_nuxt/ {
        root ${APP_ROOT}/.output/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ^~ /images/ {
        root ${APP_ROOT}/.output/public;
        expires 30d;
        add_header Cache-Control "public";
    }

    location ^~ /menu-pages/ {
        root ${APP_ROOT}/.output/public;
        expires 30d;
        add_header Cache-Control "public";
    }

    location ^~ /pdfs/ {
        root ${APP_ROOT}/.output/public;
        default_type application/pdf;
        max_ranges 16;
        expires 1d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 240s;
    }
}
NGINX

nginx -t
systemctl reload nginx

install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null <<'HOOK'
#!/usr/bin/env bash
set -e
nginx -t
systemctl reload nginx
HOOK
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx

certbot renew --dry-run
curl --fail --silent --show-error --head "https://${DOMAIN}/" >/dev/null

echo "Ready: https://${DOMAIN}"
echo "PM2 upstream: http://127.0.0.1:${APP_PORT}"
echo "WWW redirects to: https://${DOMAIN}"
