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

## Admin panel

Open `/admin` to manage all menus, PDF files, menu order and visibility, site
and viewer text, contact details, logo, background, colors, language and SEO.
Changes go live when you click **Պահպանել**. PDF pages are generated automatically.

Create the first account once:

```bash
pnpm admin:create
```

The generated username and temporary password are in `.data/admin-access.txt`.
Sign in and change the password in **Հաշիվ**, then remove that temporary access
file. Existing accounts are never overwritten by this command. You can provide
`GILLA_ADMIN_USERNAME` and `GILLA_ADMIN_PASSWORD` environment variables when
creating an account. Passwords must contain 12–200 characters.

Install `poppler-utils` on Ubuntu/Debian for PDF uploads. On Windows, put
`pdfinfo.exe` and `pdftoppm.exe` on PATH, or set `GILLA_PDFINFO` and
`GILLA_PDFTOPPM` to their absolute paths. PDFs can contain up to 150 pages and
be 40 MB; images can be PNG, JPG or WebP up to 10 MB. The reverse proxy must
allow at least 45 MB request bodies and a 240-second response timeout.

Content, uploads, password hashes and session secrets live in `.data`, outside
the Nuxt build. `GILLA_DATA_DIR` can specify a different persistent directory.
Back up this entire directory; do not publish it or include it in deploy archives.
Each save also writes the previous content to `.data/history`. Deleting a menu
removes its entry; existing uploaded files are kept for backups and old links.
Concurrent edits in different tabs are detected before overwriting changes.

Production must use HTTPS: admin cookies are Secure, HttpOnly and SameSite=Strict.
Authenticated writes check the request origin. Login attempts are rate limited;
password changes invalidate all older sessions. Nginx must overwrite `X-Real-IP`
(as the included config does), and the Node server must remain bound to localhost.

After a build, run the integration checks with `pnpm test`.

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
