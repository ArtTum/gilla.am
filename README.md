# Gilla menu

Mobile-first Nuxt 4 menu page for Gilla Yerevan.

## Development

```bash
pnpm install
pnpm dev
```

## Production

```bash
pnpm build
pnpm start
```

The Node.js server entry point is generated at `.output/server/index.mjs`.

## Ubuntu/Debian server

After `gilla.am` and `www.gilla.am` point to the server IP and the project is
available under `/var/domains/gilla.am`, build it and configure PM2, Nginx and
SSL with:

```bash
sudo bash scripts/setup-nginx.sh you@example.com
```

The installer runs Nuxt with PM2 on `127.0.0.1:3020`, creates
`/etc/nginx/conf.d/gilla.am.conf`, enables HTTPS and redirects `www.gilla.am`
to `gilla.am`.

## Refresh the menu documents

Install Poppler, Pillow, pypdf and reportlab, then run:

```bash
python scripts/optimize-pdfs.py
```
