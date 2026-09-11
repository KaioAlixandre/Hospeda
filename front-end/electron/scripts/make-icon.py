from pathlib import Path
from PIL import Image
import shutil

src = Path(r"C:\Users\kaioa\.cursor\projects\c-Users-kaioa-Documents-Hospeda\assets\hospeda-app-icon.png")
if not src.exists():
    # fallback to existing master png in project
    src = Path(__file__).resolve().parents[1] / "build" / "icon.png"

img = Image.open(src).convert("RGBA")
root = Path(__file__).resolve().parents[1]
build = root / "build"
assets = root / "assets"
public = root / "public"
for folder in (build, assets, public):
    folder.mkdir(exist_ok=True)

master = img.resize((512, 512), Image.Resampling.LANCZOS)
master.save(build / "icon.png", format="PNG")
master.save(assets / "icon.png", format="PNG")

win = img.resize((256, 256), Image.Resampling.LANCZOS)
win.save(assets / "app-icon.png", format="PNG")
win.save(public / "icon.png", format="PNG")

img.save(
    build / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
shutil.copyfile(build / "icon.ico", root / "icon.ico")
shutil.copyfile(build / "icon.ico", public / "favicon.ico")
print("icons updated")
