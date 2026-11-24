// 구글 로그인 검증 + 캐릭터 생성 횟수 계산(순수 함수). 테스트 scripts/gauth.test.mjs
// 2026-11-24 사용자 결정: 무료 사용자는 구글 계정마다 평생 FREE_TOTAL번, 전체 하루 PER_DAY장(최악 월 약 $60).
// 유료 플랜(plans 표에 uid)이면 평생 제한 없이 하루 PAID_PER_DAY까지.
export const FREE_TOTAL = 2, PER_DAY = 30, PAID_PER_DAY = 10;
const ISS = ["accounts.google.com", "https://accounts.google.com"];

const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

// keys: Google JWKS(https://www.googleapis.com/oauth2/v3/certs)의 keys 배열. now: 초
export async function verifyGoogleIdToken(token, { aud, keys, now = Date.now() / 1000 }) {
  if (!aud) throw new Error("no client id");
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("bad token");
  const header = JSON.parse(new TextDecoder().decode(unb64u(parts[0])));
  if (header.alg !== "RS256") throw new Error("bad alg");
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown kid");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("bad signature");
  const p = JSON.parse(new TextDecoder().decode(unb64u(parts[1])));
  if (!ISS.includes(p.iss)) throw new Error("bad iss");
  if (p.aud !== aud) throw new Error("bad aud");
  if (!(p.exp > now)) throw new Error("expired");
  if (!p.sub || typeof p.sub !== "string") throw new Error("no sub");
  return p;
}

// gens 표의 uid 칸에 쓰는 키: 구글 계정 키(새 생성은 여기에 센다) + 연결된 전먹대 uid(연결 전에 쓴 횟수)
export const genKeys = (sub, uid) => ["g:" + sub, uid];

// rows: gens 표에서 genKeys에 해당하는 행 {day, uid, n}. all: 오늘 전체 생성 수
export function genLimit({ sub, uid, day, rows, all, paid }) {
  if (!sub) return { day, paid, left: 0, used: 0, limit: paid ? null : FREE_TOTAL, dayFull: false, needGoogle: true };
  const keys = genKeys(sub, uid);
  const mine = rows.filter((r) => keys.includes(r.uid));
  const used = mine.reduce((a, r) => a + r.n, 0);
  const today = mine.filter((r) => r.day === day).reduce((a, r) => a + r.n, 0);
  const left = paid ? Math.max(0, PAID_PER_DAY - today) : Math.max(0, FREE_TOTAL - used);
  return { day, paid, left, used, limit: paid ? null : FREE_TOTAL, dayFull: !paid && all >= PER_DAY, needGoogle: false };
}

// 2026-11-24 사용자 결정: 계정은 구글 로그인으로만. 닉네임·PIN(Bearer uid:pin)은 더 이상 인증이 아니다.
export function parseBearer(h) {
  const m = /^Bearer\s+s:([0-9a-f]{64})$/.exec(h || "");
  return m ? { token: m[1] } : null;
}

// 구글 입장 판단. existing: 그 닉네임 계정이 있나, pinOk: 넣은 PIN이 맞나, uidLinked: 그 계정이 이미 다른 구글에 연결됐나
export function linkPlan({ linkedUid, nick, existing, pinOk, uidLinked }) {
  if (linkedUid) return { do: "login", uid: linkedUid };
  if (!nick) return { need: "nick" };
  if (nick.length > 12) return { status: 400, error: "닉네임은 1~12자" };
  if (!existing) return { do: "create" };
  if (!pinOk) return { status: 403, need: "pin", error: "이미 있는 닉네임이에요. 내 예전 닉네임이면 그 PIN을 같이 넣어 연결해요" };
  if (uidLinked) return { status: 409, error: "이 닉네임은 이미 다른 구글 계정에 연결돼 있어요" };
  return { do: "link" };
}
