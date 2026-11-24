// 전국먹자대회 API Worker
//   카카오 중계:  GET /api/places?q=…   GET /api/place?id=…
//   신원:         POST /auth/google {credential, nick?, pin?} → {uid, name, token} | {need:"nick"}  (Authorization: Bearer s:token)
//                 계정은 구글로만(2026-11-24). 예전 닉네임+PIN 계정은 구글 입장 때 nick+pin으로 연결만 된다. POST /auth 는 410

//   문서 저장소:  GET /db/sync?cols=a,b&since=t    → 바뀐 문서(삭제 포함)
//                 GET /db/list?col=   GET /db/get?path=
//                 POST /db/set?path=  POST /db/update?path=  POST /db/delete?path=   (Authorization: Bearer uid:pin)
//   사진:         GET /photo/<key>  (문서 안의 dataURL 사진은 set/update 때 R2로 올리고 URL로 바꿔 저장)
//   캐릭터 생성:  POST /avatar/gen {avatar, lvl, image?, kind?}  → Gemini 2x2 시트 PNG(base64). 저장 안 함(사진 포함).
//                 브라우저가 프레임으로 잘라 players/{uid}.sprite.frames 로 저장하면 그때 R2에 올라간다.
// ponytail: 권한은 "내가 만든 문서는 내가 고친다 + 남의 미션엔 내 표·내 격파만" 수준. 관리자 기능 없음.

import { playerPrompt } from "../../assets/sprite.js";
import { verifyGoogleIdToken, genKeys, genLimit, PAID_PER_DAY, parseBearer, linkPlan } from "./gauth.js";

const PROXY = "https://k-skill-proxy.nomadamas.org/v1/kakao-map/search/keyword";
const PLACE_API = "https://place-api.map.kakao.com/places/panel3/";
const ALLOWED = ["q", "x", "y", "radius", "sort", "size", "page"];
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "*" };
const PATH_RE = /^[A-Za-z0-9_\-.~:@+]+(\/[A-Za-z0-9_\-.~:@+]+)+$/;

const json = (body, status = 200, extra = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
const https = (u) => (u || "").replace(/^http:\/\//, "https://");
const colOf = (path) => path.split("/").slice(0, -1).join("/");

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* ---------- 카카오 ---------- */
async function placeInfo(pid) {
  const r = await fetch(PLACE_API + pid, {
    headers: { "User-Agent": CHROME_UA, Referer: "https://place.map.kakao.com/", Origin: "https://place.map.kakao.com", pf: "web" },
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const d = await r.json();
  const photos = (d.photos?.photos || []).filter((p) => p.url).slice(0, 12).map((p) => ({ url: https(p.url), type: p.type || "" }));
  const menus = (d.menu?.menus?.items || []).slice(0, 8).map((m) => ({ name: m.name, price: m.price, desc: m.ai_mate_desc || "" }));
  const sc = d.kakaomap_review?.score_set || {};
  return {
    id: pid, name: d.summary?.name, main: https(d.summary?.main_photo_url), photos, menus,
    score: { avg: sc.average_score, count: sc.review_count },
    ai: d.ai_mate?.bottom_sheet?.summary || "", blog_count: d.blog_review?.review_count,
  };
}

/* ---------- 신원 ---------- */
// 구글 로그인 세션(Bearer s:token)만 인증. 예전 닉네임+PIN 헤더는 null(브라우저가 401을 받고 구글 연결로 안내)
async function whoami(env, request) {
  const b = parseBearer(request.headers.get("Authorization"));
  if (!b) return null;
  const row = await env.DB.prepare("SELECT uid, sub FROM sessions WHERE h=?").bind(await sha256(b.token)).first();
  return row ? { uid: row.uid, sub: row.sub } : null;
}
const auth = async (env, request) => (await whoami(env, request))?.uid || null;

/* ---------- 구글 로그인: GIS ID 토큰 → Google JWKS로 검증 → google_links(sub ↔ uid) ---------- */
// 이미 연결된 구글 계정이면 그 uid로. 아니면 닉네임(+있던 계정이면 PIN)으로 연결하거나 새로 만든다. 연결은 바꿀 수 없다.
// ponytail: 연결 해제·다른 닉네임으로 옮기기 없음. 필요하면 운영자가 wrangler d1 execute로 google_links 행을 고친다.
async function handleGoogle(env, request) {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: "구글 로그인이 아직 준비 중이에요" }, 503);
  const { credential = "", nick = "", pin = "" } = await request.json().catch(() => ({}));
  let p;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cf: { cacheTtl: 3600, cacheEverything: true } });
    p = await verifyGoogleIdToken(credential, { aud: env.GOOGLE_CLIENT_ID, keys: (await r.json()).keys || [] });
  } catch { return json({ error: "구글 로그인을 확인하지 못했어요. 다시 눌러 주세요" }, 401); }
  const sub = p.sub, t = Date.now();
  const link = await env.DB.prepare("SELECT uid FROM google_links WHERE sub=?").bind(sub).first();
  const n = String(nick).trim().normalize("NFC");
  const uidOf = async () => "u_" + (await sha256("nick:" + n.toLowerCase())).slice(0, 20);
  let uid = link?.uid, plan = { do: "login" };
  if (!link) {
    uid = n ? await uidOf() : null;
    const row = uid && (await env.DB.prepare("SELECT pinhash FROM players WHERE uid=?").bind(uid).first());
    plan = linkPlan({ linkedUid: null, nick: n, existing: !!row,
      pinOk: !!row?.pinhash && row.pinhash === (await sha256(`${pin}:${uid}`)),
      uidLinked: !!row && !!(await env.DB.prepare("SELECT 1 FROM google_links WHERE uid=?").bind(uid).first()) });
    if (plan.need === "nick") return json({ need: "nick" });
    if (plan.status) return json({ error: plan.error, need: plan.need }, plan.status);
    if (plan.do === "create") await env.DB.batch([ // 구글로 만든 계정은 PIN 없음
      env.DB.prepare("INSERT INTO players (uid,nick,pinhash,t) VALUES (?,?,?,?)").bind(uid, n, "", t),
      env.DB.prepare("INSERT OR IGNORE INTO docs (path,col,body,t) VALUES (?,?,?,?)").bind("players/" + uid, "players", JSON.stringify({ name: n, t }), t),
    ]);
    await env.DB.prepare("INSERT INTO google_links (sub,uid,t) VALUES (?,?,?)").bind(sub, uid, t).run();
  }
  const isNew = plan.do === "create";
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("INSERT INTO sessions (h,uid,sub,t) VALUES (?,?,?,?)").bind(await sha256(token), uid, sub, t).run();
  const name = (await env.DB.prepare("SELECT nick FROM players WHERE uid=?").bind(uid).first())?.nick || "";
  return json({ uid, name, token, isNew, linked: plan.do === "link" });
}

/* ---------- 사진: dataURL → R2 ---------- */
async function storePhotos(env, origin, body) {
  const up = async (v) => {
    if (typeof v !== "string" || !v.startsWith("data:image/")) return v;
    const [head, b64] = v.split(",", 2);
    const type = /data:(image\/[a-z]+)/.exec(head)?.[1] || "image/jpeg";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length > 2_000_000) throw new Error("사진이 너무 커요");
    const key = (await sha256(b64.slice(0, 4096) + bytes.length)) + (type === "image/png" ? ".png" : ".jpg");
    await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: type } });
    return `${origin}/photo/${key}`;
  };
  if (Array.isArray(body.photos)) body.photos = await Promise.all(body.photos.map(up));
  if (Array.isArray(body.sprite?.frames)) body.sprite.frames = await Promise.all(body.sprite.frames.slice(0, 9).map(up));
  if (body.proof) body.proof = await up(body.proof);
  return body;
}

/* ---------- 문서 권한 ---------- */
function canWrite(uid, path, existing, patch, mode) {
  if (path.startsWith("players/")) return path === "players/" + uid;
  if (mode === "delete") return !!existing && existing.by === uid;
  if (!existing) return patch.by === uid || (path.startsWith("menus/") && colOf(path) === "menus"); // 새 문서: 내 것이거나 도장 개설
  if (existing.by === uid) return true;
  if (mode !== "update") return false;
  const keys = Object.keys(patch);
  if (keys.every((k) => k === "votes") && Object.keys(patch.votes || {}).every((k) => k === uid)) return true; // 남의 미션에 내 표
  if (keys.every((k) => ["done", "clearedBy", "clearedAt", "proof"].includes(k)) && patch.clearedBy === uid) return true; // 남의 도발을 내가 격파
  return false;
}
const merge = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge({ ...(a[k] || {}) }, b[k]) : b[k]; return a; };

async function getDoc(env, path) {
  const r = await env.DB.prepare("SELECT body FROM docs WHERE path=? AND deleted=0").bind(path).first();
  return r ? JSON.parse(r.body) : null;
}
const rowOut = (r) => ({ path: r.path, col: r.col, body: r.deleted ? null : JSON.parse(r.body), deleted: !!r.deleted, t: r.t });

async function handleDb(env, request, url, origin) {
  const op = url.pathname.slice(4);
  if (request.method === "GET") {
    if (op === "sync") {
      const cols = (url.searchParams.get("cols") || "").split(",").filter(Boolean).slice(0, 40);
      const since = +(url.searchParams.get("since") || 0);
      if (!cols.length) return json({ t: Date.now(), docs: [] });
      const q = `SELECT * FROM docs WHERE col IN (${cols.map(() => "?").join(",")}) AND t>? ORDER BY t LIMIT 2000`;
      const { results } = await env.DB.prepare(q).bind(...cols, since).all();
      return json({ t: Date.now(), docs: results.map(rowOut) });
    }
    if (op === "list") {
      const col = url.searchParams.get("col") || "";
      const { results } = await env.DB.prepare("SELECT * FROM docs WHERE col=? AND deleted=0 ORDER BY t LIMIT 2000").bind(col).all();
      return json({ t: Date.now(), docs: results.map(rowOut) });
    }
    if (op === "get") {
      const path = url.searchParams.get("path") || "";
      const body = await getDoc(env, path);
      return json({ path, body, exists: !!body });
    }
    return json({ error: "unknown" }, 404);
  }
  // 쓰기
  const uid = await auth(env, request);
  if (!uid) return json({ error: "구글로 입장해야 기록할 수 있어요" }, 401);
  const path = url.searchParams.get("path") || "";
  if (!PATH_RE.test(path) || path.split("/").length % 2) return json({ error: "bad path" }, 400);
  const existing = await getDoc(env, path);
  const t = Date.now();
  if (op === "delete") {
    if (!canWrite(uid, path, existing, {}, "delete")) return json({ error: "내 기록만 지울 수 있어요" }, 403);
    await env.DB.prepare("UPDATE docs SET deleted=1, t=?, body='{}' WHERE path=?").bind(t, path).run();
    return json({ ok: true, t });
  }
  let patch = await request.json().catch(() => null);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ error: "body must be object" }, 400);
  if (!canWrite(uid, path, existing, patch, op)) return json({ error: "남의 기록은 못 고쳐요" }, 403);
  if (op === "update" && !existing) return json({ error: "no doc" }, 400);
  patch = await storePhotos(env, origin, patch);
  const body = op === "update" ? merge({ ...existing }, patch) : patch;
  const s = JSON.stringify(body);
  if (s.length > 900_000) return json({ error: "문서가 너무 커요" }, 413);
  await env.DB.prepare("INSERT INTO docs (path,col,body,t,deleted) VALUES (?,?,?,?,0) ON CONFLICT(path) DO UPDATE SET body=excluded.body, t=excluded.t, deleted=0")
    .bind(path, colOf(path), s, t).run();
  return json({ ok: true, t, body });
}

/* ---------- 캐릭터 생성: Gemini(키는 Worker secret GEMINI_API_KEY) ---------- */
// 구글 로그인 세션만 생성할 수 있다. 횟수는 D1 gens 표(날짜·키별), 새 생성은 "g:<구글 sub>" 키에 센다.
// 계산은 gauth.js genLimit(구글 계정 키 + 연결된 uid의 옛 횟수 합산). 실패하면 횟수를 돌려준다.
async function genQuota(env, who) {
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const plan = await env.DB.prepare("SELECT plan FROM plans WHERE uid=? AND (until IS NULL OR until>?)").bind(who.uid, Date.now()).first();
  const rows = who.sub ? (await env.DB.prepare("SELECT day, uid, n FROM gens WHERE uid IN (?,?)").bind(...genKeys(who.sub, who.uid)).all()).results : [];
  const all = (await env.DB.prepare("SELECT SUM(n) s FROM gens WHERE day=?").bind(day).first())?.s || 0;
  return { ...genLimit({ sub: who.sub, uid: who.uid, day, rows, all, paid: !!plan }), plan: plan?.plan || null };
}
const AV_OK = { hair: ["short", "long", "bun", "mohawk", "bald"], acc: ["none", "band", "glasses", "cap", "towel", "chop", "apron", "ikseon"] };
async function handleAvatar(env, request) {
  const who = await whoami(env, request);
  if (!who) return json({ error: "입장해야 캐릭터를 만들 수 있어요" }, 401);
  if (!env.GEMINI_API_KEY) return json({ error: "캐릭터 생성이 아직 꺼져 있어요" }, 503);
  const { avatar = {}, lvl = 0, image = null, kind = null } = await request.json().catch(() => ({}));
  const av = { skin: Math.max(0, Math.min(3, avatar.skin | 0)), hairc: Math.max(0, Math.min(5, avatar.hairc | 0)),
    hair: AV_OK.hair.includes(avatar.hair) ? avatar.hair : "short", acc: AV_OK.acc.includes(avatar.acc) ? avatar.acc : "none" };
  const lv = Math.max(0, Math.min(5, lvl | 0));
  const m = typeof image === "string" ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image) : null;
  if (image && (!m || m[2].length > 2_000_000)) return json({ error: "사진은 2MB 이하 이미지만" }, 400);
  const q = await genQuota(env, who), day = q.day, key = genKeys(who.sub, who.uid)[0];
  if (q.left <= 0) return json({ error: q.paid ? `오늘은 캐릭터를 ${PAID_PER_DAY}번 다 그렸어요. 내일 다시 그려요` : `캐릭터는 구글 계정마다 ${q.limit}번까지 만들 수 있어요. 이미 다 만들었어요`, quota: q }, 429);
  if (q.dayFull) return json({ error: "오늘 캐릭터 그리기가 꽉 찼어요. 내일 다시 그려요", quota: q }, 429);
  const bump = (d) => env.DB.prepare("INSERT INTO gens (day,uid,n) VALUES (?,?,?) ON CONFLICT(day,uid) DO UPDATE SET n=n+?").bind(day, key, d, d).run();
  await bump(1);
  try {
    const parts = [{ text: playerPrompt(av, lv, m ? (kind === "ref" ? "ref" : "photo") : null) }];
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_IMAGE_MODEL}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
    });
    const j = await r.json();
    const img = (j.candidates || []).flatMap((c) => c.content?.parts || []).find((p) => p.inlineData)?.inlineData;
    if (!r.ok || !img) throw new Error(j.error?.message || "그림이 안 왔어요");
    return json({ mime: img.mimeType, data: img.data, left: q.left - 1, limit: q.limit, paid: q.paid });
  } catch (e) {
    await bump(-1);
    return json({ error: "캐릭터를 못 그렸어요. 잠시 후 다시 해 봐요", detail: String(e).slice(0, 200) }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname.startsWith("/photo/")) {
      const key = url.pathname.slice(7);
      const obj = await env.PHOTOS.get(key);
      if (!obj) return new Response("not found", { status: 404, headers: CORS });
      return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", ...CORS } });
    }
    if (url.pathname === "/auth" && request.method === "POST") return json({ error: "이제 구글 계정으로만 입장해요. 예전 닉네임·PIN은 구글 입장 때 넣으면 기록이 이어져요" }, 410);
    if (url.pathname === "/avatar/gen" && request.method === "POST") return handleAvatar(env, request);
    if (url.pathname === "/auth/google" && request.method === "POST") return handleGoogle(env, request);
    if (url.pathname === "/avatar/quota") { const who = await whoami(env, request); return who ? json(await genQuota(env, who)) : json({ error: "입장 필요" }, 401); }
    if (url.pathname.startsWith("/db/")) return handleDb(env, request, url, origin);

    if (request.method !== "GET") return json({ error: "GET only" }, 405);
    if (url.pathname === "/api/places") {
      const qs = new URLSearchParams();
      for (const k of ALLOWED) if (url.searchParams.has(k)) qs.set(k, url.searchParams.get(k));
      try {
        const r = await fetch(PROXY + "?" + qs, { headers: { "User-Agent": "curl/8.4 sundae-quest" }, cf: { cacheTtl: 300, cacheEverything: true } });
        return json(await r.text(), r.status);
      } catch (e) { return json({ error: String(e) }, 502); }
    }
    if (url.pathname === "/api/place") {
      const pid = url.searchParams.get("id") || "";
      if (!/^\d+$/.test(pid)) return json({ error: "bad id" }, 400);
      try { return json(await placeInfo(pid), 200, { "Cache-Control": "public, max-age=3600" }); }
      catch (e) { return json({ error: String(e) }, 502); }
    }
    return json({ ok: true, routes: ["/api/places", "/api/place", "/auth", "/db/*", "/photo/*"] });
  },
};
