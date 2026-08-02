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

## Refresh the optimized PDFs

Install Poppler, Pillow, pypdf and reportlab, then run:

```bash
python scripts/optimize-pdfs.py
```
