import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyGoogleIdToken, genKeys, genLimit, FREE_TOTAL, PER_DAY, PAID_PER_DAY } from "../worker/src/gauth.js";

const AUD = "test-client.apps.googleusercontent.com";
const b64u = (s) => Buffer.from(s).toString("base64url");
const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const keys = [jwk];
const NOW = 1_800_000_000;
async function sign(claims, header = { alg: "RS256", kid: "k1", typ: "JWT" }) {
  const data = b64u(JSON.stringify(header)) + "." + b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(data));
  return data + "." + Buffer.from(sig).toString("base64url");
}
const good = { iss: "https://accounts.google.com", aud: AUD, sub: "1234567890", email: "a@example.com", iat: NOW - 10, exp: NOW + 3000 };

test("구글 ID 토큰: 서명·aud·iss·exp가 맞으면 sub를 돌려준다", async () => {
  const p = await verifyGoogleIdToken(await sign(good), { aud: AUD, keys, now: NOW });
  assert.equal(p.sub, "1234567890");
  const p2 = await verifyGoogleIdToken(await sign({ ...good, iss: "accounts.google.com" }), { aud: AUD, keys, now: NOW });
  assert.equal(p2.sub, "1234567890");
});

test("구글 ID 토큰: 하나라도 어긋나면 거절", async () => {
  const bad = async (tok, why) => assert.rejects(verifyGoogleIdToken(tok, { aud: AUD, keys, now: NOW }), undefined, why);
  const t = await sign(good);
  await bad(t.slice(0, -4) + (t.endsWith("AAAA") ? "BBBB" : "AAAA"), "서명 변조");
  const [h, , s] = t.split(".");
  await bad(h + "." + b64u(JSON.stringify({ ...good, sub: "999" })) + "." + s, "내용 변조");
  await bad(await sign({ ...good, aud: "other" }), "aud 다름");
  await bad(await sign({ ...good, iss: "https://evil.example" }), "iss 다름");
  await bad(await sign({ ...good, exp: NOW - 1 }), "만료");
  await bad(await sign({ ...good, sub: "" }), "sub 없음");
  await bad(await sign(good, { alg: "none", kid: "k1" }), "alg none");
  await bad(await sign(good, { alg: "RS256", kid: "nope" }), "모르는 kid");
  await bad("abc", "모양이 틀림");
  await assert.rejects(verifyGoogleIdToken(t, { aud: "", keys, now: NOW }), undefined, "클라이언트 ID 미설정");
});

const day = "2026-11-24";
const lim = (o) => genLimit({ sub: "S", uid: "u_a", day, rows: [], all: 0, paid: false, ...o });

test("생성 횟수: 구글 로그인 없으면 0회", () => {
  const q = genLimit({ sub: null, uid: "u_a", day, rows: [], all: 0, paid: false });
  assert.equal(q.left, 0);
  assert.equal(q.needGoogle, true);
});

test("생성 횟수: 무료는 구글 계정 하나에 평생 2회", () => {
  assert.equal(FREE_TOTAL, 2);
  assert.equal(lim({}).left, 2);
  assert.equal(lim({ rows: [{ day: "2026-11-01", uid: "g:S", n: 1 }] }).left, 1);
  assert.equal(lim({ rows: [{ day: "2026-11-01", uid: "g:S", n: 1 }, { day, uid: "g:S", n: 1 }] }).left, 0);
});

test("생성 횟수: 닉네임(uid)을 바꾸거나 새로 만들어도 같은 구글 계정이면 다시 생기지 않는다", () => {
  const rows = [{ day, uid: "g:S", n: 2 }];
  assert.equal(lim({ uid: "u_new", rows }).left, 0);
  assert.equal(lim({ uid: "u_other", rows }).left, 0);
  assert.deepEqual(genKeys("S", "u_new"), ["g:S", "u_new"]);
});

test("생성 횟수: 구글 연결 전 그 닉네임으로 쓴 횟수도 합산", () => {
  assert.equal(lim({ rows: [{ day: "2026-11-20", uid: "u_a", n: 1 }] }).left, 1);
  assert.equal(lim({ rows: [{ day: "2026-11-20", uid: "u_a", n: 2 }] }).left, 0);
  assert.equal(lim({ rows: [{ day: "2026-11-20", uid: "u_a", n: 1 }, { day, uid: "g:S", n: 1 }] }).left, 0);
});

test("생성 횟수: 전체 하루 상한이 차면 무료는 막힘, 유료는 하루 10회", () => {
  assert.equal(lim({ all: PER_DAY - 1 }).dayFull, false);
  assert.equal(lim({ all: PER_DAY }).dayFull, true);
  const p = lim({ paid: true, all: PER_DAY + 5, rows: [{ day: "2026-11-01", uid: "g:S", n: 7 }, { day, uid: "g:S", n: 3 }] });
  assert.equal(p.left, PAID_PER_DAY - 3);
  assert.equal(p.dayFull, false);
  assert.equal(p.limit, null);
});

import { parseBearer, linkPlan } from "../worker/src/gauth.js";

test("인증 헤더: 구글 세션(s:토큰)만 받고 닉네임·PIN은 받지 않는다", () => {
  const tok = "a".repeat(64);
  assert.deepEqual(parseBearer(`Bearer s:${tok}`), { token: tok });
  assert.equal(parseBearer("Bearer u_abc123:1234"), null);
  assert.equal(parseBearer("Bearer s:short"), null);
  assert.equal(parseBearer(""), null);
});

test("구글 입장: 새 계정은 구글로만, 예전 계정은 닉네임+PIN이 맞아야 연결", () => {
  assert.deepEqual(linkPlan({ linkedUid: "u_x", nick: "아무거나" }), { do: "login", uid: "u_x" });
  assert.deepEqual(linkPlan({ linkedUid: null, nick: "" }), { need: "nick" });
  assert.equal(linkPlan({ linkedUid: null, nick: "가".repeat(13) }).status, 400);
  assert.deepEqual(linkPlan({ linkedUid: null, nick: "새사람", existing: false }), { do: "create" });
  const wrong = linkPlan({ linkedUid: null, nick: "옛사람", existing: true, pinOk: false });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.need, "pin");
  assert.equal(linkPlan({ linkedUid: null, nick: "옛사람", existing: true, pinOk: true, uidLinked: true }).status, 409);
  assert.deepEqual(linkPlan({ linkedUid: null, nick: "옛사람", existing: true, pinOk: true, uidLinked: false }), { do: "link" });
});
