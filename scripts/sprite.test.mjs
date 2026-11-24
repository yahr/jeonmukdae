import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetFrames } from "../assets/sprite.js";

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
