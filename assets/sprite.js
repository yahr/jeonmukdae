// AI가 그린 캐릭터 시트(2x2·3x3) → 프레임(투명 배경, 픽셀 축소). 순수 함수라 브라우저 캔버스와 node 테스트가 같이 쓴다.
// 시트는 바탕을 마젠타(#FF00FF)로 그리게 한다. 칸 가장자리의 마젠타에서 시작해 이어진 마젠타만 지운다.
// halo(빌런 시트용): 모델이 섞은 보라·노랑 후광 그라데이션도 비슷한 색을 따라 지운다. 플레이어 시트는 끈다(분홍 볼·피부로 새어 들어감).
// 그림 안에 갇힌 바탕은 거의 순수한 마젠타만 지우고(보라 옷 보호), 칸 가장자리에 닿은 작은 덩어리(옆 칸에서 넘어온 조각)는 버린다.
// ponytail: 칸 안에 그림이 들어온다고 가정(프롬프트로 요구). 가장 큰 덩어리가 칸 끝에 닿으면 그대로 둔다.

const isMag = (r, g, b) => Math.min(r, b) - g > 90 && Math.abs(r - b) < 90;
const isPure = (r, g, b) => r >= 200 && b >= 200 && g <= 70;

function keyOut(px, w, h, halo) {
  const bg = new Uint8Array(w * h), q = [];
  const mag = (i) => isMag(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  const near = (a, b) => Math.max(Math.abs(px[a * 4] - px[b * 4]), Math.abs(px[a * 4 + 1] - px[b * 4 + 1]), Math.abs(px[a * 4 + 2] - px[b * 4 + 2])) <= 28;
  const luma = (i) => px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  for (const i of edge) if (!bg[i] && mag(i)) { bg[i] = 1; q.push(i); } // 그림이 칸 끝에 닿아도 그 점은 시작점이 아니다
  while (q.length) {
    const i = q.pop(), x = i % w;
    for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (n < 0 || n >= w * h || bg[n]) continue;
      if (mag(n) || (halo && near(i, n) && luma(n) > 70)) { bg[n] = 1; q.push(n); }
    }
  }
  for (let i = 0; i < w * h; i++) if (bg[i] || isPure(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) px[i * 4 + 3] = 0;
  // 덩어리 나누기: 가장 큰 것은 두고, 칸 가장자리에 닿은 나머지는 버린다
  const lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || !px[s * 4 + 3]) continue;
    const id = comps.length, st = [s], cells = [];
    let edgeHit = false;
    lab[s] = id;
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      cells.push(i);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edgeHit = true;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (n >= 0 && lab[n] < 0 && px[n * 4 + 3]) { lab[n] = id; st.push(n); }
    }
    comps.push({ cells, edgeHit });
  }
  const big = comps.reduce((m, c) => (c.cells.length > (m?.cells.length || 0) ? c : m), null);
  for (const c of comps) if (c !== big && c.edgeHit) for (const i of c.cells) px[i * 4 + 3] = 0;
}

/** px: RGBA(Uint8ClampedArray) 시트 전체. 돌려줌: [{w,h,data}] 칸 순서(왼→오, 위→아래) */
export function sheetFrames(px, W, H, { cols = 2, rows = 2, scale = 4, inset = 0.015, halo = true } = {}) {
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const pad = Math.round((W / cols) * inset);
    const x0 = Math.round((c * W) / cols) + pad, y0 = Math.round((r * H) / rows) + pad;
    const w = Math.round(((c + 1) * W) / cols) - pad - x0, h = Math.round(((r + 1) * H) / rows) - pad - y0;
    const cell = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) cell.set(px.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4), y * w * 4);
    keyOut(cell, w, h, halo);
    let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cell[(y * w + x) * 4 + 3]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    if (bx1 < 0) { out.push({ w: 1, h: 1, data: new Uint8ClampedArray(4) }); continue; }
    const fw = Math.ceil((bx1 - bx0 + 1) / scale), fh = Math.ceil((by1 - by0 + 1) / scale), data = new Uint8ClampedArray(fw * fh * 4);
    for (let fy = 0; fy < fh; fy++) for (let fx = 0; fx < fw; fx++) {
      let n = 0, sr = 0, sg = 0, sb = 0;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const x = bx0 + fx * scale + dx, y = by0 + fy * scale + dy;
        if (x > bx1 || y > by1) continue;
        const i = (y * w + x) * 4;
        if (cell[i + 3]) { n++; sr += cell[i]; sg += cell[i + 1]; sb += cell[i + 2]; }
      }
      if (n * 2 >= scale * scale) data.set([sr / n, sg / n, sb / n, 255], (fy * fw + fx) * 4);
    }
    out.push({ w: fw, h: fh, data });
  }
  return out;
}

/** 브라우저: 이미지 → 프레임 dataURL(opt.cols×opt.rows, 기본 2x2) */
export async function imageToFrames(src, opt) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const sheet = g.getImageData(0, 0, cv.width, cv.height);
  return sheetFrames(sheet.data, cv.width, cv.height, opt).map((f) => {
    const c = document.createElement("canvas"); c.width = f.w; c.height = f.h;
    c.getContext("2d").putImageData(new ImageData(f.data, f.w, f.h), 0, 0);
    return { url: c.toDataURL("image/png"), w: f.w, h: f.h };
  });
}

/* ---- 플레이어 시트 프롬프트(Worker가 서버에서 만든다. 사용자 글은 넣지 않고 정해진 선택지만) ---- */
const SKIN_T = ["light peach", "warm beige", "tan", "deep brown"];
const HAIR_T = { short: "short hair with a fringe", long: "long straight hair past the shoulders", bun: "hair tied up in a round bun on top", mohawk: "a spiky mohawk", bald: "a shaved bald head" };
const HAIRC_T = ["black", "dark brown", "golden blonde", "red", "bright blue", "silver white"];
const ACC_T = { none: "", band: " Wears a red headband with two short tails.", glasses: " Wears round black glasses.", cap: " Wears a blue baseball cap.", towel: " Has a white sweat towel tied around the head.", chop: " Holds shiny golden chopsticks.", apron: " Wears a pink apron over the uniform.", ikseon: " Wears a black Korean royal ikseongwan hat with two upright wings and gold trim." };
const BELT_T = ["white", "yellow", "blue", "red", "black", "glowing gold"];
/** 동작 9개(3x3 시트 칸 순서). 예전 2x2 시트(idle·bite·hit·ko)는 LEGACY 로 가까운 프레임을 쓴다 */
export const POSES = ["idle", "bite", "bliss", "hit", "knock", "fly", "land", "down", "melt"];
const LEGACY = [0, 1, 1, 2, 2, 2, 3, 3, 3];
/** 저장된 sprite {grid, frames, sizes} → {동작: {src,w,h}}. grid 없으면 2x2. 프레임이 모자라면 null */
export function poseFrames(sp) {
  const g = sp?.grid || 2, n = g * g;
  if (!sp || sp.frames?.length !== n || sp.sizes?.length !== n) return null;
  return Object.fromEntries(POSES.map((k, i) => { const j = g === 3 ? i : LEGACY[i]; return [k, { src: sp.frames[j], w: sp.sizes[j][0], h: sp.sizes[j][1] }]; }));
}

export function playerPrompt(av = {}, lvl = 0, image = null) {
  const hair = av.hair === "bald" ? HAIR_T.bald : `${HAIRC_T[av.hairc] || HAIRC_T[0]} ${HAIR_T[av.hair] || HAIR_T.short}`;
  const photo = image === "photo";
  const ref = photo
    ? "\n\nThe attached photo shows the person this character is based on. Match their face shape, hairstyle and hair color. Dress the character in the clothes visible in the photo, simplified into this chibi pixel style but keeping each item's type and colors: if only the face is visible, design a casual outfit that suits them; if the upper body is visible, keep that top; if the full body is visible, keep the top, bottoms and shoes too. Fill in any parts not visible so they match the visible clothes. Do not copy the photo background, other people or props."
    : image === "ref" ? "\n\nThe attached sprite is this same character: keep exactly the same face, hair and accessories, and only apply the description below (such as the belt color)." : "";
  return `Pixel art character sprite sheet for a retro 2D arcade RPG. A 3x3 grid of nine equal square cells, one pose per cell, the SAME character in every cell (identical face, hair, outfit, colors, proportions), each pose centered in its cell with empty margin, nothing crossing into another cell.

Art style: late-1990s Korean 2D MMORPG sprite quality. Chibi proportions about 2.5 heads tall with a big head, full body from head to feet visible. Crisp hand-placed pixels, 1-pixel dark outline around the whole figure, 4 to 5 shading steps per color, visible cloth folds on the uniform, individual hair strand clusters with highlights. Three-quarter view facing right, toward the right side of the frame, in every cell. Each figure about 80 pixels tall in pixel scale.
Framing (very important): every cell shows the ENTIRE body from the top of the head to the soles of the shoes, never cropped at the chest, waist or knees, even if a reference image shows only the face. Standing figures occupy about 85% of the cell height with empty margin above and below; lying figures fit fully inside the cell width.${ref}

Character: ${photo ? `a cheerful food-challenge fighter based on the person in the photo. Wears the outfit described above, with a ${BELT_T[lvl] || BELT_T[0]} cloth belt tied at the waist over the clothes, knotted with two hanging ends, clearly visible in every cell` : `a cheerful young Korean food-challenge fighter. Skin tone: ${SKIN_T[av.skin] || SKIN_T[0]}. ${hair[0].toUpperCase() + hair.slice(1)}. Wears a cream-white martial arts uniform (dobok) with a crossed V-neck collar, loose sleeves and loose trousers, and a ${BELT_T[lvl] || BELT_T[0]} belt tied in a knot at the waist with two hanging ends, clearly visible in every cell. Simple dark slip-on shoes`}. Holds a pair of wooden chopsticks.${photo ? "" : ACC_T[av.acc] || ""}${lvl >= 5 ? " A small golden crown floats above the head." : ""}

Cells in reading order (left to right, top row first):
Cell 1 idle: standing ready pose, excited eager grin, sparkling eyes, chopsticks raised.
Cell 2 bite: taking a bite of a steamed dumpling from the chopsticks, happy chewing face, rosy cheeks.
Cell 3 bliss: chewing with eyes closed and hands on cheeks, deeply moved by the taste, tiny sparkles and a little heart.
Cell 4 hit: jolted by a hit, surprised wide eyes but laughing with an open happy mouth.
Cell 5 knockback: bent far backward with arms flung out, hair and clothes swept back, still laughing happily.
Cell 6 flying: airborne and tumbling backward, body tilted, legs up, hair and sleeves fluttering, eyes closed in a big happy grin.
Cell 7 landing: just hit the ground on their back with a soft thud, small puffs of dust and white steam around, happy closed-eye smile.
Cell 8 down: lying flat on their back, round full belly puffed up, eyes closed in a blissful smile, rosy cheeks.
Cell 9 melted: completely relaxed and melted flat like a happy puddle on the floor, round belly up, dreamy smile, three little pink hearts floating above.

Every face must look happy and delighted. Never pain, never frowning, never crying.
Background: one flat solid pure magenta color #FF00FF filling every cell, no floor, no shadows, no gradient, no grid lines.
No text, no letters, no numbers, no watermark.`;
}
