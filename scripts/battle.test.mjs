import { test } from "node:test";
import assert from "node:assert/strict";
import { GAUGE_MAX, mult, start, press, hp, statsFor, topMoves, villainRank, weaponRank, tasteDraft, weaponLine } from "../assets/battle-core.js";

const AXES = ["filling", "skin", "amount", "price", "mood", "takeout"].map((key) => ({ key }));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const run = (n, seq) => seq.reduce((s, i) => press(s, i), start(n));

test("배율: k번째 = 1 + 0.5(k−1), 상한 3배", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map((k) => mult(k)), [1, 1.5, 2, 2.5, 3, 3, 3]);
  assert.equal(mult(3, { step: 1, cap: 2 }), 2); // 계수는 부문 데이터로 바꿀 수 있다
});

test("6개를 한 번씩 → 6번째에 정확히 행복 KO(정신줄 0), 5번째까지는 아님", () => {
  const s5 = run(6, [0, 1, 2, 3, 4]);
  assert.equal(s5.ko, false);
  assert.equal(hp(s5), 17);
  const s6 = press(s5, 5);
  assert.equal(s6.ko, true);
  assert.equal(s6.happy, GAUGE_MAX);
  assert.equal(hp(s6), 0);
  near(s6.overkill, 0);
});

test("육즙만 4번: 16.7 → 25 → 33.3 → 41.7, 4번째에 KO, 넘친 만큼 오버킬", () => {
  let s = start(6);
  const gains = [];
  for (let i = 0; i < 4; i++) { s = press(s, 0); gains.push(s.gain); }
  [100 / 6, 25, 100 / 3, 250 / 6].forEach((g, i) => near(gains[i], g));
  assert.equal(s.ko, true);
  assert.equal(s.presses, 4);
  near(s.overkill, 100 / 6 + 25 + 100 / 3 + 250 / 6 - 100);
  assert.deepEqual(s.uses, [4, 0, 0, 0, 0, 0]);
  assert.equal(press(s, 1), s); // KO 뒤에는 무시
});

test("기술 수가 4·5개여도 한 번씩 다 쓰면 정확히 KO", () => {
  for (const n of [4, 5]) {
    const almost = run(n, Array.from({ length: n - 1 }, (_, i) => i));
    assert.equal(almost.ko, false);
    const s = press(almost, n - 1);
    assert.equal(s.ko, true, `n=${n}`);
    near(s.overkill, 0);
  }
});

test("능력치 출처: 운영자 stats > 플레이어 평균 > 기본값 3(확인 중)", () => {
  assert.deepEqual(statsFor({ stats: { filling: 5, skin: 4, amount: 3, price: 2, mood: 1, takeout: 0 }, axes: AXES, players: { avg: [1, 1, 1, 1, 1, 1], n: 2 } }), { vals: [5, 4, 3, 2, 1, 0], source: "official", n: 0 });
  assert.deepEqual(statsFor({ stats: null, axes: AXES, players: { avg: [4.5, 3, 3, 3, 3, 3], n: 2 } }), { vals: [4.5, 3, 3, 3, 3, 3], source: "players", n: 2 });
  assert.deepEqual(statsFor({ stats: null, axes: AXES, players: { avg: [0, 0, 0, 0, 0, 0], n: 0 } }), { vals: [3, 3, 3, 3, 3, 3], source: "default", n: 0 });
});

test("이번 판 필살 무기: 가장 많이 누른 기술, 공동 1위는 모두", () => {
  assert.deepEqual(topMoves([4, 0, 0, 0, 0, 0]), [{ i: 0, count: 4 }]);
  assert.deepEqual(topMoves([2, 0, 2, 1, 0, 0]), [{ i: 0, count: 2 }, { i: 2, count: 2 }]);
  assert.deepEqual(topMoves([0, 0, 0]), []);
});

test("손님들이 뽑은 필살 무기: 가게별 합산 1~3위, 동률은 앞 축, 기록 없으면 빈 목록", () => {
  const kos = [
    { key: "a", by: "u1", uses: [4, 0, 1, 0, 0, 0] },
    { key: "a", by: "u2", uses: [1, 0, 3, 2, 0, 1] },
    { key: "a", by: "u3" }, // 옛 기록(기술 횟수 없음)
    { key: "b", by: "u1", uses: [0, 9, 0, 0, 0, 0] },
  ];
  assert.deepEqual(weaponRank(kos, "a"), [{ i: 0, count: 5 }, { i: 2, count: 4 }, { i: 3, count: 2 }]);
  assert.deepEqual(weaponRank([{ key: "c", uses: [1, 1, 0, 0, 0, 0] }], "c"), [{ i: 0, count: 1 }, { i: 1, count: 1 }]);
  assert.deepEqual(weaponRank(kos, "zzz"), []);
});

test("오늘 나를 쓰러뜨린 맛 → 6각 평가 초안(1~5), 안 눌렀으면 없음", () => {
  assert.deepEqual(tasteDraft([4, 0, 2, 1, 0, 0]), [5, 1, 3, 2, 1, 1]);
  assert.equal(tasteDraft([0, 0, 0, 0, 0, 0]), null);
});

test("결과 문구: 한 가지면 '하나로', 여럿이면 받침 따라 로/으로", () => {
  assert.equal(weaponLine("방이점 찐만두", ["육즙"], 4), "방이점 찐만두, 육즙 하나로 4입 만에 나를 보냈다");
  assert.equal(weaponLine("방이점 찐만두", ["육즙", "양"], 5), "방이점 찐만두, 육즙·양으로 5입 만에 나를 보냈다");
  assert.equal(weaponLine("가", ["포장", "가성비"], 6), "가, 포장·가성비로 6입 만에 나를 보냈다");
  assert.equal(weaponLine("가", ["피", "쫄깃한 피"], 6), "가, 피·쫄깃한 피로 6입 만에 나를 보냈다");
  assert.equal(weaponLine("가", ["김", "분위기 굴"], 6), "가, 김·분위기 굴로 6입 만에 나를 보냈다"); // ㄹ 받침은 '로'
});

test("최강 빌런: 쓰러뜨린 플레이어 수 많은 순, 같으면 평균 입 수가 적은 순", () => {
  const kos = [
    { key: "a", name: "가", by: "u1", bites: 5 }, { key: "a", name: "가", by: "u2", bites: 7 },
    { key: "b", name: "나", by: "u1", bites: 3 }, { key: "b", name: "나", by: "u3", bites: 3 },
    { key: "c", name: "다", by: "u1", bites: 2 },
    { key: "b", name: "나", by: "u3", bites: 9 },
  ];
  assert.deepEqual(villainRank(kos).map((v) => [v.key, v.kos, v.avgBites]), [["b", 2, 3], ["a", 2, 6], ["c", 1, 2]]);
});
