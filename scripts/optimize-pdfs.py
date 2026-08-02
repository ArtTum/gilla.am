from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
from reportlab.pdfgen import canvas


MENUS = (
    ("menu1.pdf", "public/pdfs/gilla-main-menu.pdf"),
    ("menu2.pdf", "public/pdfs/gilla-events-menu.pdf"),
)


def page_number(path: Path) -> int:
    return int(path.stem.rsplit("-", 1)[-1])


def optimize_pdf(source: Path, destination: Path, renderer: str, workdir: Path) -> None:
    page_dir = workdir / source.stem
    page_dir.mkdir(parents=True, exist_ok=True)
    prefix = page_dir / "page"

    subprocess.run(
        [
            renderer,
            "-jpeg",
            "-r",
            "112",
            "-jpegopt",
            "quality=76,optimize=y,progressive=y",
            str(source),
            str(prefix),
        ],
        check=True,
    )

    source_reader = PdfReader(source)
    images = sorted(page_dir.glob("page-*.jpg"), key=page_number)
    if len(images) != len(source_reader.pages):
        raise RuntimeError(
            f"Rendered {len(images)} pages from {source.name}; expected {len(source_reader.pages)}"
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(destination), pageCompression=1)
    pdf.setTitle(f"Gilla - {source.stem}")
    pdf.setAuthor("Gilla Yerevan")

    for image_path, source_page in zip(images, source_reader.pages, strict=True):
        width = float(source_page.mediabox.width)
        height = float(source_page.mediabox.height)
        with Image.open(image_path) as image:
            image.verify()
        pdf.setPageSize((width, height))
        pdf.drawImage(str(image_path), 0, 0, width=width, height=height)
        pdf.showPage()

    pdf.save()

    optimized_reader = PdfReader(destination)
    if len(optimized_reader.pages) != len(source_reader.pages):
        raise RuntimeError(f"Page-count validation failed for {destination.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create mobile-friendly Gilla menu PDFs")
    parser.add_argument(
        "--renderer",
        default=shutil.which("pdftoppm"),
        help="Path to the pdftoppm executable",
    )
    args = parser.parse_args()
    if not args.renderer:
        raise SystemExit("pdftoppm is required; install Poppler or pass --renderer")

    root = Path(__file__).resolve().parent.parent
    workdir = root / "tmp" / "pdfs" / "optimized"
    workdir.mkdir(parents=True, exist_ok=True)

    for source_name, destination_name in MENUS:
        optimize_pdf(
            root / source_name,
            root / destination_name,
            args.renderer,
            workdir,
        )


if __name__ == "__main__":
    main()
