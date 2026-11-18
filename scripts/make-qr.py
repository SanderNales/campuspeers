#!/usr/bin/env python3
"""Dev-only helper: writes QR codes for the two survey links and the random link into ./qr/ (git-ignored).

Usage:   python scripts/make-qr.py https://<USERNAME>.github.io/<REPO>/
Needs:   pip install qrcode pillow      (NOT a dependency of the site)
Output:  qr/qr-a.png  (<base>/a/)   qr/qr-b.png  (<base>/b/)   qr/qr-random.png  (<base>/)
"""
import sys
from pathlib import Path

try:
    import qrcode
except ImportError:
    sys.exit("Missing dependency. Run:  pip install qrcode pillow")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    base = sys.argv[1].strip()
    if not base.startswith(("http://", "https://")):
        sys.exit("The base URL must start with https://")
    if "<" in base or ">" in base:
        sys.exit("Replace the <USERNAME>/<REPO> placeholders with the real values first.")
    base = base.rstrip("/") + "/"

    out = Path(__file__).resolve().parent.parent / "qr"
    out.mkdir(exist_ok=True)
    for name, url in (("qr-a.png", base + "a/"), ("qr-b.png", base + "b/"), ("qr-random.png", base)):
        qrcode.make(url, box_size=12, border=4).save(out / name)
        print(f"{out / name}  ->  {url}")


if __name__ == "__main__":
    main()
