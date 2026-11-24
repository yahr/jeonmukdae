import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validate } from "./validate.mjs";

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const real = () => ({ site: load("site.json"), divisions: load("divisions.json"), dojos: load("dojos.json") });

test("실제 데이터는 통과", () => assert.deepEqual(validate(real()), []));

test("빠진 주소·없는 부문·중복 slug·범위 밖 점수를 잡는다", () => {
  const d = real();
  d.dojos[0].address = "";
  d.dojos[1].division = "nope";
  d.dojos[2].slug = d.dojos[3].slug;
  d.dojos[3].stats = { filling: 9 };
  const errs = validate(d).join("\n");
  assert.match(errs, /address 필요/);
  assert.match(errs, /없는 부문 'nope'/);
  assert.match(errs, /slug 중복/);
  assert.match(errs, /stats.filling는 0~5/);
  assert.match(errs, /stats.skin는 0~5/);
});

test("faq 답이 null인 건 허용, 숫자는 거절", () => {
  const d = real();
  d.dojos[0].faq.push({ q: "질문", a: 3 });
  assert.match(validate(d).join("\n"), /faq\[\d+\] q 필요, a는 글자 또는 null/);
});
