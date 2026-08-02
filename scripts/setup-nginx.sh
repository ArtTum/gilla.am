#!/usr/bin/env bash

set -Eeuo pipefail

DOMAIN="gilla.am"
WWW_DOMAIN="www.gilla.am"
APP_ROOT="/var/domains/gilla.am"
NGINX_CONFIG="/etc/nginx/conf.d/gilla.am.conf"
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

if [[ -f "${APP_ROOT}/.output/public/index.html" ]]; then
  WEB_ROOT="${APP_ROOT}/.output/public"
elif [[ -f "${APP_ROOT}/index.html" ]]; then
  WEB_ROOT="${APP_ROOT}"
else
  echo "No built site found." >&2
  echo "Expected ${APP_ROOT}/.output/public/index.html or ${APP_ROOT}/index.html" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx curl

install -d -m 0755 "${WEB_ROOT}/.well-known/acme-challenge"
chmod o+x /var /var/domains "${APP_ROOT}"
chmod -R a+rX "${WEB_ROOT}"

if [[ -f "${NGINX_CONFIG}" ]]; then
  cp -a "${NGINX_CONFIG}" "${NGINX_CONFIG}.backup.$(date +%Y%m%d-%H%M%S)"
fi

# Start with HTTP so Let's Encrypt can validate both hostnames.
tee "${NGINX_CONFIG}" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    root ${WEB_ROOT};
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        default_type text/plain;
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
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
  --webroot-path "${WEB_ROOT}" \
  --cert-name "${DOMAIN}" \
  --domain "${DOMAIN}" \
  --domain "${WWW_DOMAIN}" \
  --email "${SSL_EMAIL}" \
  --agree-tos \
  --non-interactive \
  --expand

# Serve the Nuxt static build on the main hostname and redirect www to it.
tee "${NGINX_CONFIG}" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    root ${WEB_ROOT};

    location ^~ /.well-known/acme-challenge/ {
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

    root ${WEB_ROOT};
    index index.html;

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:GILLA_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \\.(?:css|js|jpg|jpeg|png|gif|webp|avif|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location ~* \\.pdf$ {
        expires 1d;
        add_header Cache-Control "public";
        try_files \$uri =404;
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
echo "WWW redirects to: https://${DOMAIN}"
