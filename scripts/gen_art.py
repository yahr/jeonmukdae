"""행복한 빌런 대결 그림을 Gemini 이미지 모델로 만든다 → assets/battle/<부문>-<이름>.webp + manifest.json
실행: npm run art [-- 이름 ...]   (키: jeonmukdae/.env 의 GEMINI_API_KEY, 출력·기록하지 않음)
- 모델 이름은 박지 않는다: /v1beta/models 목록에서 이미지 모델(generateContent + 이름에 image)을 골라 쓴다. --model 로 바꿀 수 있다.
- 외부 매장 사진은 입력으로 넣지 않는다. 글로 된 프롬프트만 쓴다.
- 투명 배경 대신 마젠타(#FF00FF) 바탕으로 그리게 하고 여기서 지운 뒤, 최근접 축소로 픽셀을 살린다.
- 만든 그림은 사람이 보고 표정(행복해야 함)을 검수한다. 마음에 안 들면 그 이름만 다시: npm run art -- villain
"""
import base64, json, pathlib, sys, urllib.request, io
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/battle"
API = "https://generativelanguage.googleapis.com/v1beta"
STYLE = ("16-bit retro arcade pixel art sprite, chunky crisp pixels, no anti-aliasing, thick dark navy (#12102a) outline, "
         "limited palette of warm yellow #ffd23f, hot pink #ff4fa3, cyan #3ee8ff, mint green #5dff7a, cream #f5f0dc, golden brown. "
         "Cute, kind, funny mood. No text, no letters, no numbers, no logo, no watermark. Whole object visible and centered with margin. "
         "Background must be one flat solid pure magenta color #FF00FF everywhere, no shadow on the background, no gradient.")
# 이름: (부문, 프롬프트, 비율, 최종 가로 픽셀)
ART = {
    "villain": ("jjinmandu", "A chubby steamed dumpling (Korean jjinmandu, pleated top) as a lovable boss villain character. "
                "Tiny pink devil horns, a big kind happy smile, rosy cheeks, smug but friendly eyebrows, little arms on hips, "
                "a wisp of white steam above. It looks delicious and warm, never scary.", "1:1", 192),
    "dumpling": ("jjinmandu", "One small plump steamed dumpling with pleats, glossy, a tiny sparkle, flying projectile pose.", "1:1", 64),
    "steamer": ("jjinmandu", "A round bamboo dumpling steamer basket seen from the side, with lid, woven bamboo texture, "
                "a few white steam puffs on top. Wide shape.", "16:9", 220),
    "bag": ("jjinmandu", "A paper takeout bag with handles, a cute dumpling sticker on the front, tumbling through the air.", "1:1", 96),
    "ko": ("jjinmandu", "A cozy celebration scene with no characters: warm orange-pink glow, fluffy white steam clouds, "
           "a stack of bamboo steamers with dumplings peeking out, little floating hearts and golden sparkles. "
           "Feels like a happy, full-bellied defeat. Draw it as a wide banner illustration that fills the frame edge to edge "
           "(for this one the background is the warm scene itself, not magenta).", "16:9", 360),
}


def key():
    env = ROOT / ".env"
    if not env.exists():
        sys.exit("jeonmukdae/.env 에 GEMINI_API_KEY=... 를 넣어 주세요")
    for line in env.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit(".env 에 GEMINI_API_KEY 가 없어요")


def call(path, k, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"x-goog-api-key": k, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def pick_model(k, want=None):
    names = [m["name"].split("/", 1)[1] for m in call("/models?pageSize=200", k)["models"]
             if "generateContent" in m.get("supportedGenerationMethods", []) and "image" in m["name"]]
    if want:
        if want not in names:
            sys.exit(f"{want} 는 이미지 모델 목록에 없어요: {names}")
        return want
    if not names:
        sys.exit("이미지 출력 모델이 목록에 없어요")
    # 정식(미리보기 아님) > pro > 나머지
    return sorted(names, key=lambda n: ("preview" in n, "pro" not in n, "lite" in n, n))[0]


def generate(k, model, prompt, ratio):
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": ratio}}}
    j = call(f"/models/{model}:generateContent", k, body)
    for c in j.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "inlineData" in p:
                return Image.open(io.BytesIO(base64.b64decode(p["inlineData"]["data"]))).convert("RGBA")
    raise RuntimeError("그림이 안 왔어요: " + json.dumps(j)[:300])


def key_out(im):
    """마젠타 바탕 지우기: 빨강·파랑이 높고 초록이 낮은 픽셀(분홍 #ff4fa3은 파랑이 낮아 남는다)."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r > 170 and b > 170 and g < 110 and abs(r - b) < 70:
                px[x, y] = (0, 0, 0, 0)
    return im.crop(im.getbbox() or (0, 0, im.width, im.height))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    want = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--model=")), None)
    k = key()
    model = pick_model(k, want)
    print("모델:", model)
    OUT.mkdir(parents=True, exist_ok=True)
    mf = OUT / "manifest.json"
    manifest = json.loads(mf.read_text()) if mf.exists() else {}
    for name in args or ART:
        div, desc, ratio, width = ART[name]
        im = generate(k, model, f"{desc} {STYLE}", ratio)
        im = key_out(im)  # ko 장면도 모델이 마젠타 테두리를 남기는 일이 있어 같이 지운다
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.NEAREST)
        f = f"{div}-{name}.webp"
        im.save(OUT / f, "WEBP", lossless=True)
        manifest.setdefault(div, {})[name] = f
        print("저장:", f, im.size)
    manifest["_model"] = model
    mf.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
