# Gilla menu

Mobile-first Nuxt 4 menu page for Gilla Yerevan.

## Development

```bash
pnpm install
pnpm dev
```

## Production

```bash
pnpm generate
```

The static site is generated in `.output/public`.

## Ubuntu/Debian server

After `gilla.am` and `www.gilla.am` point to the server IP and the generated
site is available under `/var/domains/gilla.am`, configure Nginx and SSL with:

```bash
sudo bash scripts/setup-nginx.sh you@example.com
```

The installer creates `/etc/nginx/conf.d/gilla.am.conf`, enables HTTPS and
redirects `www.gilla.am` to `gilla.am`.

## Refresh the menu documents

Install Poppler, Pillow, pypdf and reportlab, then run:

```bash
python scripts/optimize-pdfs.py
```
