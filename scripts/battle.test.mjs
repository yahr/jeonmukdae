import { test } from "node:test";
import assert from "node:assert/strict";
import { GAUGE_MAX, COMBO_MS, gain, statsFor, start, bite, villainRank, koLine } from "../assets/battle-core.js";

const AXES = ["filling", "skin", "amount", "price", "mood", "takeout"].map((key) => ({ key }));

test("한 입 증가량: 능력치가 높을수록, 콤보가 이어질수록 세다(콤보는 4단까지)", () => {
  assert.equal(gain(5, 0), 30);
  assert.equal(gain(1, 0), 10);
  assert.equal(gain(3, 1), 25);
  assert.equal(gain(5, 4), gain(5, 9)); // 콤보 상한
  assert.ok(gain(4, 0) > gain(3, 0));
});

test("능력치 출처: 운영자 stats > 플레이어 평균 > 기본값 3(확인 중)", () => {
  const off = statsFor({ stats: { filling: 5, skin: 4, amount: 3, price: 2, mood: 1, takeout: 0 }, axes: AXES, players: { avg: [1, 1, 1, 1, 1, 1], n: 2 } });
  assert.deepEqual(off, { vals: [5, 4, 3, 2, 1, 0], source: "official", n: 0 });
  const pl = statsFor({ stats: null, axes: AXES, players: { avg: [4.5, 3, 3, 3, 3, 3], n: 2 } });
  assert.deepEqual(pl, { vals: [4.5, 3, 3, 3, 3, 3], source: "players", n: 2 });
  assert.deepEqual(statsFor({ stats: null, axes: AXES, players: { avg: [0, 0, 0, 0, 0, 0], n: 0 } }), { vals: [3, 3, 3, 3, 3, 3], source: "default", n: 0 });
});

test("필살기 순서: 센 능력치부터, 6입마다 한 바퀴", () => {
  let s = start([1, 5, 3, 5, 2, 4]);
  const used = [];
  for (let i = 0; i < 7; i++) { s = bite(s, i * 5000); used.push(s.move); if (s.ko) s = { ...s, ko: false, happy: 0 }; }
  assert.deepEqual(used, [1, 3, 5, 2, 4, 0, 1]);
});

test("콤보: COMBO_MS 안에 다시 먹으면 이어지고, 늦으면 끊긴다", () => {
  let s = start([3, 3, 3, 3, 3, 3]);
  s = bite(s, 0); assert.equal(s.combo, 0);
  s = bite(s, COMBO_MS - 1); assert.equal(s.combo, 1);
  s = bite(s, COMBO_MS * 3); assert.equal(s.combo, 0);
});

test("행복 KO: 게이지가 꽉 차면 KO, 게이지는 넘치지 않고 이후 입은 무시", () => {
  let s = start([5, 5, 5, 5, 5, 5]);
  s = bite(s, 0); s = bite(s, 100); assert.equal(s.ko, false);
  s = bite(s, 200);
  assert.equal(s.ko, true);
  assert.equal(s.bites, 3); // 30 + 38 + 45 → 3입 만에
  assert.equal(s.happy, GAUGE_MAX);
  assert.equal(bite(s, 300), s);
});

test("느리게 먹으면 능력치 1짜리는 10입, 5짜리는 4입", () => {
  const count = (v) => { let s = start(Array(6).fill(v)); let t = 0; while (!s.ko) s = bite(s, (t += COMBO_MS + 1)); return s.bites; };
  assert.equal(count(1), 10);
  assert.equal(count(5), 4);
});

test("최강 빌런: 쓰러뜨린 플레이어 수 많은 순, 같으면 평균 입 수가 적은 순", () => {
  const kos = [
    { key: "a", name: "가", by: "u1", bites: 5 }, { key: "a", name: "가", by: "u2", bites: 7 },
    { key: "b", name: "나", by: "u1", bites: 3 }, { key: "b", name: "나", by: "u3", bites: 3 },
    { key: "c", name: "다", by: "u1", bites: 2 },
    { key: "b", name: "나", by: "u3", bites: 9 }, // 같은 플레이어 중복은 한 명으로
  ];
  const r = villainRank(kos);
  assert.deepEqual(r.map((v) => [v.key, v.kos, v.avgBites]), [["b", 2, 3], ["a", 2, 6], ["c", 1, 2]]);
});

test("결과 문구는 패배 자랑", () => {
  assert.equal(koLine("방이점 찐만두", 3), "방이점 찐만두에게 3입 만에 행복 KO");
});
