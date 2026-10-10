"""Resize generated transparent sprites for runtime, and build a QA contact sheet."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
entries = json.loads((root / 'tools/drink-assets.json').read_text(encoding='utf-8'))
dest = root / 'images/drinks'
dest.mkdir(parents=True, exist_ok=True)
names = ['VC柠檬茶', '茉莉奶绿', '拿铁', '泰奶红茶', '黑巧美式', '黑糖珍珠', '芭乐茉莉', 'QQ美莓奶茶']
sheet = Image.new('RGB', (800, 480), '#FBF7EF')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
for i, entry in enumerate(entries):
    source = Image.open(entry['source']).convert('RGBA')
    assert source.getchannel('A').getextrema() == (0, 255), entry['id'] + ' requires real transparency'
    sprite = source.resize((256, 256), Image.Resampling.LANCZOS)
    sprite.save(dest / (entry['id'] + '.png'), optimize=True)
    assert sprite.getchannel('A').getextrema() == (0, 255)
    thumb = sprite.resize((176, 176), Image.Resampling.LANCZOS)
    x, y = i % 4 * 200 + 12, i // 4 * 240 + 8
    sheet.paste(thumb, (x, y), thumb)
    draw.text((i % 4 * 200 + 100, y + 190), f'{i + 1}. {names[i]}', fill='#51443C', font=font, anchor='mt')
out = root / 'preview/screenshots/v2/drinks-sheet.png'
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out)
print('PASS: eight 256px transparent PNG sprites saved; original generated images preserved.')
