#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import html

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


CORE_GLYPH_CHARS = [
    "人", "水", "山", "日", "月", "火", "木", "文", "字", "说",
    "大", "女", "子", "口", "手", "心", "目", "王", "土", "天",
    "力", "禾", "竹", "生", "明", "龙", "家", "老", "雨", "鸟",
    "马", "鱼", "羊", "牛", "田", "风", "止", "光", "虫", "贝",
    "走", "来", "东", "西", "正", "见", "自", "耳", "足", "弓",
    "矢", "首", "面", "斤", "臣", "父", "母", "男", "友", "名",
    "宝", "黑", "赤", "青", "北", "门", "户", "工", "书", "学",
    "农", "商", "古", "鬼", "神", "本", "末", "朱", "果", "休",
    "采", "利", "初", "相", "主", "信", "仁", "安", "和", "道",
    "德", "善", "美", "思", "乐", "色", "长", "高", "多", "少",
]


def glyph_name_for_char(font, char):
    codepoint = ord(char)
    for table in font["cmap"].tables:
        glyph_name = table.cmap.get(codepoint)
        if glyph_name:
            return glyph_name
    return None


def glyph_svg(char, glyph, glyph_set):
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    bounds = bounds_pen.bounds
    if not bounds:
        raise ValueError(f"empty glyph outline for {char}")

    x_min, y_min, x_max, y_max = bounds
    width = x_max - x_min
    height = y_max - y_min
    if width <= 0 or height <= 0:
        raise ValueError(f"invalid glyph bounds for {char}: {bounds}")

    pen = SVGPathPen(glyph_set)
    glyph.draw(pen)
    path_data = pen.getCommands()

    target = 760
    scale = min(target / width, target / height)
    tx = 500 - ((x_min + x_max) * scale / 2)
    ty = 520 + ((y_min + y_max) * scale / 2)
    transform = f"translate({tx:.3f} {ty:.3f}) scale({scale:.6f} {-scale:.6f})"
    escaped_char = html.escape(char)

    return f"""<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{escaped_char} regular script glyph">
  <title>{escaped_char} regular script glyph</title>
  <path d="{path_data}" transform="{transform}" fill="#1f1a17"/>
</svg>
"""


def load_manifest(path):
    if not path.exists():
        return {"generatedAt": "", "assets": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", required=True, help="Path to an OFL-licensed OTF/TTF font")
    parser.add_argument("--public-root", default="assets/public")
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--original-url", required=True)
    parser.add_argument("--source-title", default="Source Han Serif SC Regular")
    parser.add_argument("--license", default="SIL Open Font License 1.1")
    parser.add_argument("--attribution", default="Adobe, Google, and contributing Source Han Serif authors")
    args = parser.parse_args()

    public_root = Path(args.public_root)
    manifest_path = public_root / "commons-glyph-manifest.json"
    manifest = load_manifest(manifest_path)
    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    manifest.setdefault("assets", {})

    font = TTFont(args.font)
    glyph_set = font.getGlyphSet()
    verified_at = datetime.now(timezone.utc).isoformat()
    generated = []
    missing = []

    for char in CORE_GLYPH_CHARS:
        glyph_name = glyph_name_for_char(font, char)
        if not glyph_name:
            missing.append(char)
            continue

        asset_key = f"glyphs/{char}/regular.svg"
        output_path = public_root / asset_key
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(glyph_svg(char, glyph_set[glyph_name], glyph_set), encoding="utf-8")

        manifest["assets"][f"{char}-regular"] = {
            "type": "stage-glyph-svg",
            "char": char,
            "era": "regular",
            "key": asset_key,
            "assetKey": asset_key,
            "sourceName": "Source Han Serif SC",
            "sourceTitle": args.source_title,
            "sourceUrl": args.source_url,
            "originalUrl": args.original_url,
            "license": args.license,
            "attribution": args.attribution,
            "status": "verified",
            "contentType": "image/svg+xml",
            "verifiedAt": verified_at,
        }
        generated.append(char)

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "ok": not missing,
        "generated": len(generated),
        "missing": missing,
        "manifestPath": str(manifest_path),
    }, ensure_ascii=False, indent=2))

    if missing:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
