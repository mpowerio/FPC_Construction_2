"""Render screen favicon B from its committed approved SVG. Flat masters stay untouched.

Run from any directory: python3 tools/site/brand-assets.py
Requires local rsvg-convert and Pillow; no network, AI generation or paid service.
"""
from pathlib import Path
import shutil
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/brand'
for size, name in [(32, 'favicon-32.png'), (64, 'favicon-64.png'),
                   (180, 'apple-touch-icon.png'), (512, 'icon-512.png')]:
    subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size),
                    str(OUT / 'favicon.svg'), '-o', str(OUT / name)], check=True)
with Image.open(OUT / 'icon-512.png') as image:
    image.save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
shutil.copyfile(OUT / 'favicon.ico', ROOT / 'favicon.ico')
shutil.copyfile(OUT / 'favicon-64.png', ROOT / 'assets/images/favicon.png')
print('Approved B screen favicons rendered; flat logo masters untouched.')
