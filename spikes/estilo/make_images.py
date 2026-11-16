"""Genera las imágenes de prueba (no se versionan): big.png (~19 MB, ruido: el peor caso
para decodificar) y exif6.jpg (400x200 guardada con orientación EXIF 6 = girar 90°)."""
import os
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
w, h = 3200, 2000
Image.frombytes("RGB", (w, h), os.urandom(w * h * 3)).save(os.path.join(here, "big.png"), compress_level=1)
img = Image.new("RGB", (400, 200), (200, 60, 60))
exif = Image.Exif(); exif[0x0112] = 6
img.save(os.path.join(here, "exif6.jpg"), exif=exif)
print("big.png", os.path.getsize(os.path.join(here, "big.png")), "bytes")
