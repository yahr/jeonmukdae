import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetFrames, poseFrames, POSES, playerPrompt } from "../assets/sprite.js";

// 2x2 시트 합성: 바탕 마젠타(+왼쪽 위 칸은 보라 그라데이션), 칸마다 검은 테두리 사각형 하나
function sheet(W = 64) {
  const px = new Uint8ClampedArray(W * W * 4);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, g = x < W / 2 && y < W / 2 ? x * 3 : 0; // 그라데이션(마젠타→연보라)
    px.set([255 - g, g, 255, 255], i);
  }
  const box = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const edge = y === y0 || x === x0 || y === y0 + h - 1 || x === x0 + w - 1; px.set(edge ? [20, 16, 42, 255] : [250, 220, 180, 255], (y * W + x) * 4); } };
  box(8, 8, 8, 12); box(40, 8, 12, 12); box(8, 40, 8, 8); box(36, 44, 20, 8);
  return { px, W };
}

test("마젠타·그라데이션 바탕은 지우고 칸마다 캐릭터만 잘라 축소한다", () => {
  const { px, W } = sheet();
  const f = sheetFrames(px, W, W, { scale: 2, inset: 0 });
  assert.equal(f.length, 4);
  assert.deepEqual(f.map((x) => [x.w, x.h]), [[4, 6], [6, 6], [4, 4], [10, 4]]);
  for (const fr of f) {
    const a = [];
    for (let i = 3; i < fr.data.length; i += 4) a.push(fr.data[i]);
    assert.ok(a.every((v) => v === 0 || v === 255), "알파는 0 또는 255");
    assert.ok(a.every((v) => v === 255), "잘린 상자 안은 모두 캐릭터");
  }
});

test("빈 칸이면 1x1 투명 프레임", () => {
  const W = 16, px = new Uint8ClampedArray(W * W * 4);
  for (let i = 0; i < W * W; i++) px.set([255, 0, 255, 255], i * 4);
  const f = sheetFrames(px, W, W, { scale: 2, inset: 0 });
  assert.deepEqual(f.map((x) => [x.w, x.h]), [[1, 1], [1, 1], [1, 1], [1, 1]]);
});

test("3x3 시트도 칸 순서대로 9장", () => {
  const W = 90, px = new Uint8ClampedArray(W * W * 4);
  for (let i = 0; i < W * W; i++) px.set([255, 0, 255, 255], i * 4);
  for (let c = 0; c < 9; c++) { // 칸마다 (c+1)*2 높이 막대
    const x0 = (c % 3) * 30 + 10, y0 = Math.floor(c / 3) * 30 + 4;
    for (let y = y0; y < y0 + (c + 1) * 2; y++) for (let x = x0; x < x0 + 4; x++) px.set([20, 16, 42, 255], (y * W + x) * 4);
  }
  const f = sheetFrames(px, W, W, { cols: 3, rows: 3, scale: 2, inset: 0 });
  assert.deepEqual(f.map((x) => x.h), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("동작 9개: 3x3은 그대로, 예전 2x2(grid 없음)는 가까운 프레임으로 대체", () => {
  const nine = { grid: 3, frames: "abcdefghi".split(""), sizes: Array.from({ length: 9 }, (_, i) => [i + 1, 10]) };
  const p9 = poseFrames(nine);
  assert.deepEqual(POSES.map((k) => p9[k].src).join(""), "abcdefghi");
  assert.deepEqual(p9.fly, { src: "f", w: 6, h: 10 });
  const four = { frames: ["I", "B", "H", "K"], sizes: [[1, 1], [2, 2], [3, 3], [4, 4]] };
  const p4 = poseFrames(four);
  assert.deepEqual(POSES.map((k) => p4[k].src), ["I", "B", "B", "H", "H", "H", "K", "K", "K"]);
  assert.equal(poseFrames({ grid: 3, frames: ["a"], sizes: [[1, 1]] }), null); // 덜 저장된 건 안 씀
  assert.equal(poseFrames(null), null);
});

test("사진이면 찍힌 만큼 옷을 반영하고 허리에 띠, 사진 없으면 도복", () => {
  const ph = playerPrompt({ skin: 0, hair: "short", hairc: 0, acc: "none" }, 0, "photo");
  assert.match(ph, /clothes visible in the photo/);
  assert.match(ph, /full body is visible/);
  assert.match(ph, /belt tied at the waist over/);
  assert.doesNotMatch(ph, /Do not copy the photo background or clothes/);
  assert.doesNotMatch(ph, /dobok/);
  const rnd = playerPrompt({ skin: 0, hair: "short", hairc: 0, acc: "none" }, 0);
  assert.match(rnd, /dobok/);
  assert.doesNotMatch(rnd, /photo/);
});

test("그림이 칸 가장자리에 닿아도 바탕으로 지우지 않는다", () => {
  const W = 32, px = new Uint8ClampedArray(W * W * 4);
  for (let i = 0; i < W * W; i++) px.set([255, 0, 255, 255], i * 4);
  for (let y = 8; y < 16; y++) for (let x = 4; x < 12; x++) px.set([200, 30, 40, 255], (y * W + x) * 4); // 왼쪽 위 칸 아래 끝에 닿는 빨간 셔츠
  const [f] = sheetFrames(px, W, W, { scale: 1, inset: 0 });
  assert.deepEqual([f.w, f.h], [8, 8]);
  for (let i = 3; i < f.data.length; i += 4) assert.equal(f.data[i], 255);
});

test("모든 칸 전신(잘림 금지)·띠가 모든 칸에 보이게", () => {
  for (const img of [null, "photo"]) {
    const t = playerPrompt({ skin: 0, hair: "short", hairc: 0, acc: "none" }, 1, img);
    assert.match(t, /ENTIRE body/);
    assert.match(t, /yellow[^.]*belt[^.]*clearly visible in every cell/);
  }
});

// 한 칸(32x32) 시트를 2x2 중 왼쪽 위 칸으로 넣는 도우미
function oneCell(draw) {
  const W = 64, px = new Uint8ClampedArray(W * W * 4);
  for (let i = 0; i < W * W; i++) px.set([255, 0, 255, 255], i * 4);
  draw((x, y, c) => px.set([...c, 255], (y * W + x) * 4));
  return sheetFrames(px, W, W, { scale: 1, inset: 0, halo: false })[0];
}
const SKIN = [245, 192, 165], BLUSH = [255, 140, 170], LINE = [20, 16, 42];

test("플레이어 시트(halo:false): 마젠타에서 피부로 부드럽게 이어져도 얼굴·분홍 볼은 지우지 않는다", () => {
  const f = oneCell((set) => {
    for (let y = 8; y < 20; y++) for (let x = 8; x < 20; x++) set(x, y, (x === 12 || x === 13) && y === 14 ? BLUSH : SKIN);
    for (let i = 1; i < 8; i++) { const c = [255, 0, 255].map((m, k) => Math.round(m + ((SKIN[k] - m) * i) / 8)); for (let y = 8; y < 20; y++) set(i, y, c); } // 외곽선 없이 8단계로 부드럽게 이어진 경계
  });
  let holes = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.data[(y * f.w + x) * 4 + 3] === 0) holes++;
  assert.equal(holes, 0);
  assert.equal(f.h, 12);
});

test("그림 안 보라 옷은 남기고, 갇힌 순수 마젠타 조각만 지운다", () => {
  const f = oneCell((set) => {
    for (let y = 6; y < 26; y++) for (let x = 6; x < 26; x++) set(x, y, x === 6 || y === 6 || x === 25 || y === 25 ? LINE : [150, 50, 200]);
    for (let y = 14; y < 17; y++) for (let x = 14; x < 17; x++) set(x, y, [255, 0, 255]);
  });
  const a = (x, y) => f.data[(y * f.w + x) * 4 + 3];
  assert.equal(a(3, 3), 255); // 보라 옷
  assert.equal(a(9, 9), 0); // 갇힌 마젠타
});

test("옆 칸에서 넘어온 조각(칸 가장자리에 닿은 작은 덩어리)은 버린다", () => {
  const f = oneCell((set) => {
    for (let y = 6; y < 26; y++) for (let x = 8; x < 18; x++) set(x, y, LINE);
    for (let y = 4; y < 28; y++) for (let x = 30; x < 32; x++) set(x, y, LINE); // 오른쪽 끝 조각
    set(22, 10, [255, 240, 120]); // 반짝이(가장자리 안 닿음)는 남긴다
  });
  assert.equal(f.w, 15); // x 8..22
});
