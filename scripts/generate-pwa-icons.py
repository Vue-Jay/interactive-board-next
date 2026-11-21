"""Build opaque white, launcher-safe PWA icons from the existing brand mark."""

from pathlib import Path
from PIL import Image


def generate(source: Path, output: Path) -> None:
    with Image.open(source) as original:
        mark = original.convert("RGBA")
        mark = mark.crop(mark.getchannel("A").getbbox())
    output.mkdir(parents=True, exist_ok=True)
    for filename, size, fraction in (
        ("lektrus-pwa-icon-192.png", 192, 0.76),
        ("lektrus-pwa-icon-512.png", 512, 0.76),
        # A square inside the maskable icon's 40%-radius safe circle.
        ("lektrus-pwa-maskable-512.png", 512, 0.55),
    ):
        limit = round(size * fraction)
        # Enlarge when the supplied artwork is smaller than the target.
        scale = min(limit / mark.width, limit / mark.height)
        logo = mark.resize(
            (round(mark.width * scale), round(mark.height * scale)),
            Image.Resampling.LANCZOS,
        )
        icon = Image.new("RGB", (size, size), "white")
        icon.paste(logo, ((size - logo.width) // 2, (size - logo.height) // 2), logo)
        icon.save(output / filename, optimize=True)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("public/lektrus-icon-512.png"))
    parser.add_argument("--output", type=Path, default=Path("public"))
    args = parser.parse_args()
    generate(args.source, args.output)
