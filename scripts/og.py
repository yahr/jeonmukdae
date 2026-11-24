"""공유 미리보기(OG) 이미지 1200x630 만들기: assets/og/site.png, division-<slug>.png, <dojo slug>.png
맥에서 실행(한글 서체 필요): python3 scripts/og.py  → 만든 PNG는 커밋한다(GitHub Actions에는 한글 서체가 없어서).
ponytail: 가게 사진은 쓰지 않고(저작권) 글자·픽셀 장식만으로 그린다.
"""
import json, pathlib, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT_CANDIDATES = [pathlib.Path.home() / "Library/Fonts/Pretendard-Black.ttf", pathlib.Path("/System/Library/Fonts/AppleSDGothicNeo.ttc")]
FONT = next((p for p in FONT_CANDIDATES if p.exists()), None)
if not FONT:
    sys.exit("한글 서체를 못 찾았어요 (Pretendard 또는 Apple SD Gothic Neo)")
BG, PANEL, FG, Y, M, C, DIM = "#12102a", "#1d1a3f", "#f5f0dc", "#ffd23f", "#ff4fa3", "#3ee8ff", "#b3abdc"


def font(size):
    return ImageFont.truetype(str(FONT), size)


def fit(draw, text, max_w, size, min_size=40):
    while size > min_size and draw.textlength(text, font=font(size)) > max_w:
        size -= 4
    return font(size)


def card(path, tag, title, sub, emoji_row):
    im = Image.new("RGB", (1200, 630), BG)
    d = ImageDraw.Draw(im)
    for x in range(0, 1200, 30):  # 픽셀 격자
        d.line([(x, 0), (x, 630)], fill="#1a1838")
    for y in range(0, 630, 30):
        d.line([(0, y), (1200, y)], fill="#1a1838")
    d.rectangle([40, 40, 1160, 590], fill=PANEL, outline=FG, width=8)
    d.rectangle([52, 598, 1172, 606], fill="#07061a")
    d.rectangle([80, 80, 80 + d.textlength(tag, font=font(34)) + 32, 132], fill=Y)
    d.text((96, 86), tag, font=font(34), fill="#000")
    f = fit(d, title, 1040, 96)
    d.text((86, 190), title, font=f, fill=M)  # 그림자
    d.text((80, 184), title, font=f, fill=Y)
    d.text((80, 330), sub, font=fit(d, sub, 1040, 44, 26), fill=FG)
    d.text((80, 470), emoji_row, font=font(40), fill=C)
    d.text((80, 525), "전국먹자대회 · #전먹대", font=font(32), fill=DIM)
    for i, col in enumerate([Y, M, C, "#5dff7a"]):  # 오른쪽 아래 픽셀 장식
        d.rectangle([1040 + i * 26, 520, 1060 + i * 26, 540], fill=col)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    print("만듦", path.relative_to(ROOT))


site = json.loads((ROOT / "data/site.json").read_text())
divisions = json.loads((ROOT / "data/divisions.json").read_text())
dojos = json.loads((ROOT / "data/dojos.json").read_text())
card(ROOT / site["ogImage"], "INSERT COIN", site["name"], "매달 한 부문, 전국 가게 도장깨기", "격파 · 6각 능력치 · 도발 미션")
for dv in divisions:
    month = f'{int(dv["season"]["from"][5:7])}월 ' if dv.get("season") else ""
    n = sum(1 for x in dojos if x["division"] == dv["slug"])
    no = f'제{dv["season"]["n"]}회 · ' if dv.get("season") else ""
    card(ROOT / f'assets/og/division-{dv["slug"]}.png', f"{no}{month}부문 개막", f'{dv["name"]} 부문', f"도장 {n}곳 오픈" if n else "공식 도장 준비 중 · 주변 매장 대결", "▶ PRESS START")
for x in dojos:
    dv = next(v for v in divisions if v["slug"] == x["division"])
    name = " ".join(p for p in [x["name"], x.get("branch")] if p)
    card(ROOT / f'assets/og/{x["slug"]}.png', f'{dv["name"]} 부문 · {x["order"]}호 도장', name, x["address"], "VS ⚔ 도장 격파 도전")
