import { test } from "node:test";
import assert from "node:assert/strict";
import { seasonCards, storeList, hasVillain } from "../assets/game-core.js";

const SEASONS = [
  { n: 1, menu: "sundaeguk", from: "2026-10-01", to: "2026-12-31" },
  { n: 2, menu: "jjinmandu", from: "2026-11-24", to: "2026-12-31" },
  { n: 3, menu: "naengmyeon", from: "2027-01-01", to: "2027-01-31" },
];

test("시즌 카드: 여러 시즌이 동시에 진행되고, 끝난 시즌·다음 시즌을 나눈다", () => {
  const c = seasonCards(SEASONS, "2026-11-24");
  assert.deepEqual(c.current.map((s) => s.menu), ["sundaeguk", "jjinmandu"]);
  assert.deepEqual(c.past, []);
  assert.deepEqual(c.next.map((s) => s.menu), ["naengmyeon"]);
  const later = seasonCards(SEASONS, "2027-01-05");
  assert.deepEqual(later.current.map((s) => s.menu), ["naengmyeon"]);
  assert.deepEqual(later.past.map((s) => s.menu), ["jjinmandu", "sundaeguk"]); // 최근에 끝난 것부터, 같으면 번호 큰 것부터
  assert.deepEqual(seasonCards(SEASONS, "2026-09-30").current, []);
});

test("매장 목록: 공식 도장이 맨 위, 주변 검색 결과는 겹치는 가게를 빼고 아래", () => {
  const official = [{ slug: "a", kakaoId: "1", name: "가" }, { slug: "b", kakaoId: null, name: "나" }];
  const places = [{ id: "9", place_name: "다" }, { id: "1", place_name: "가 본점" }, { id: "8", place_name: "라" }];
  const list = storeList(official, places);
  assert.deepEqual(list.map((x) => [x.kind, x.name]), [["official", "가"], ["official", "나"], ["near", "다"], ["near", "라"]]);
  assert.deepEqual(storeList([], []), []);
});

test("빌런이 있는 부문: 부문 데이터가 있고 6축 모두 느낌 문구가 있을 때만", () => {
  const div = [{ slug: "jjinmandu", axes: Array.from({ length: 6 }, (_, i) => ({ key: "k" + i, feel: "f" })) }, { slug: "x", axes: [{ key: "a" }] }];
  assert.equal(hasVillain(div, "jjinmandu"), true);
  assert.equal(hasVillain(div, "x"), false);
  assert.equal(hasVillain(div, "pyeongyang"), false);
  assert.equal(hasVillain(null, "jjinmandu"), false);
});
