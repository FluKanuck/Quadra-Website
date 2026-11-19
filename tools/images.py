"""Generate responsive AVIF/WebP image sets and a manifest for the build.

Usage: python3 tools/images.py <source_dir> public/img
Source files are the full-size originals (not committed). Re-run only when photos change.
"""
import json, os, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

PHOTOS = {  # name: alt text
    "gpr": "Quadra technician pushing a ground penetrating radar cart along a residential street",
    "worker": "Quadra technician kneeling at a utility access point with an EM locator",
    "locators": "Two Quadra locators working at a manhole with GPR and locating equipment",
    "em": "Quadra technician tracing a line with an EM receiver beside a work truck",
    "surveying": "Quadra surveyor using a total station on a tripod beside a city street",
    "oilgas": "Pipeline right-of-way marked with yellow flags, with crew and equipment in the field",
    "concrete": "Technician scanning a concrete floor with a handheld GPR unit",
    "camera": "Quadra technician feeding a push camera into a manhole",
    "oiltank": "Pink paint marks on pavement showing the outline and depth of a buried oil tank",
    "survey-equipment": "Two Quadra surveyors with GPS and total station equipment on a road",
    "work-truck": "Quadra work truck with a technician checking a tablet beside it",
    "truck": "Quadra locator standing beside a Quadra truck with equipment drawers open",
    "team": "Quadra crew member in a Quadra pickup truck",
    "coring": "Quadra technician running a concrete coring drill behind a Quadra van",
    "residential": "Aerial view of a house with underground utility lines drawn across the yard",
    "vaporpin": "VAPOR PIN installation",
}
WIDTHS = [480, 800, 1200, 1600]
manifest = {}

for name, alt in PHOTOS.items():
    im = Image.open(os.path.join(src, name + ".webp")).convert("RGB")
    w0, h0 = im.size
    widths = [w for w in WIDTHS if w <= w0] or [w0]
    if w0 not in widths and w0 < WIDTHS[-1]:
        widths.append(w0)
    for w in widths:
        r = im if w == w0 else im.resize((w, round(h0 * w / w0)), Image.LANCZOS)
        r.save(os.path.join(out, f"{name}-{w}.webp"), "WEBP", quality=72, method=6)
        r.save(os.path.join(out, f"{name}-{w}.avif"), "AVIF", quality=52, speed=4)
    manifest[name] = {"w": w0, "h": h0, "widths": widths, "alt": alt}

for name in ["hs-jesse", "hs-adam", "hs-angie", "hs-randy", "hs-jamie"]:
    im = Image.open(os.path.join(src, name + ".webp")).convert("RGBA")
    for w in (240, 480):
        im.resize((w, w), Image.LANCZOS).save(os.path.join(out, f"{name}-{w}.webp"), "WEBP", quality=80, method=6)
    manifest[name] = {"w": 480, "h": 480, "widths": [240, 480]}

for name in ["acc-bccga", "acc-bc1call", "acc-bccsa"]:
    im = Image.open(os.path.join(src, name + ".png")).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    bg.convert("RGB").resize((320, 320), Image.LANCZOS).save(os.path.join(out, f"{name}.webp"), "WEBP", quality=85, method=6)
    manifest[name] = {"w": 320, "h": 320}

for name in ["logo-light", "logo-dark"]:
    im = Image.open(os.path.join(src, name + ".png")).convert("RGBA")
    im.save(os.path.join(out, f"{name}.webp"), "WEBP", lossless=True, method=6)
    half = im.resize((360, 148), Image.LANCZOS)
    half.save(os.path.join(out, f"{name}-360.webp"), "WEBP", lossless=True, method=6)
    manifest[name] = {"w": 720, "h": 296}

# Favicons from the globe mark (left square of the logo)
logo = Image.open(os.path.join(src, "logo-light.png")).convert("RGBA")
mark = logo.crop((0, 0, 296, 296))
root = os.path.dirname(out.rstrip("/"))
mark.resize((180, 180), Image.LANCZOS).save(os.path.join(root, "apple-touch-icon.png"))
mark.resize((192, 192), Image.LANCZOS).save(os.path.join(root, "icon-192.png"))
mark.resize((512, 512), Image.LANCZOS).save(os.path.join(root, "icon-512.png"))
mark.resize((48, 48), Image.LANCZOS).save(os.path.join(root, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

# Social share image 1200x630 from the hero photo
hero = Image.open(os.path.join(src, "gpr.webp")).convert("RGB")
w, h = hero.size; th = round(w * 630 / 1200); top = (h - th) // 2
hero.crop((0, top, w, top + th)).resize((1200, 630), Image.LANCZOS).save(os.path.join(out, "share.jpg"), "JPEG", quality=82)

json.dump(manifest, open(os.path.join(os.path.dirname(out.rstrip("/")), "..", "src", "images.json"), "w"), indent=1)
print(len(os.listdir(out)), "files")
