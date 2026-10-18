// 전국먹자대회 API Worker
//   카카오 중계:  GET /api/places?q=…   GET /api/place?id=…
//   신원:         POST /auth {nick, pin}            → {uid, name, isNew}
//   문서 저장소:  GET /db/sync?cols=a,b&since=t    → 바뀐 문서(삭제 포함)
//                 GET /db/list?col=   GET /db/get?path=
//                 POST /db/set?path=  POST /db/update?path=  POST /db/delete?path=   (Authorization: Bearer uid:pin)
//   사진:         GET /photo/<key>  (문서 안의 dataURL 사진은 set/update 때 R2로 올리고 URL로 바꿔 저장)
// ponytail: 권한은 "내가 만든 문서는 내가 고친다 + 남의 미션엔 내 표·내 격파만" 수준. 관리자 기능 없음.

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
async function auth(env, request) {
  const m = /^Bearer\s+(u_[a-z0-9]+):(\d{4,8})$/.exec(request.headers.get("Authorization") || "");
  if (!m) return null;
  const row = await env.DB.prepare("SELECT pinhash FROM players WHERE uid=?").bind(m[1]).first();
  if (!row || row.pinhash !== (await sha256(`${m[2]}:${m[1]}`))) return null;
  return m[1];
}

async function handleAuth(env, request) {
  const { nick = "", pin = "" } = await request.json().catch(() => ({}));
  const n = String(nick).trim().normalize("NFC");
  if (n.length < 1 || n.length > 12) return json({ error: "닉네임은 1~12자" }, 400);
  if (!/^\d{4,8}$/.test(String(pin))) return json({ error: "PIN은 숫자 4~8자리" }, 400);
  const uid = "u_" + (await sha256("nick:" + n.toLowerCase())).slice(0, 20);
  const pinhash = await sha256(`${pin}:${uid}`);
  const row = await env.DB.prepare("SELECT pinhash FROM players WHERE uid=?").bind(uid).first();
  if (row) {
    if (row.pinhash !== pinhash) return json({ error: "PIN이 달라요. 이미 쓰는 닉네임이면 같은 PIN을 넣어요" }, 403);
    return json({ uid, name: n, isNew: false });
  }
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO players (uid,nick,pinhash,t) VALUES (?,?,?,?)").bind(uid, n, pinhash, t),
    env.DB.prepare("INSERT OR IGNORE INTO docs (path,col,body,t) VALUES (?,?,?,?)").bind("players/" + uid, "players", JSON.stringify({ name: n, t }), t),
  ]);
  return json({ uid, name: n, isNew: true });
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
  if (!uid) return json({ error: "닉네임·PIN으로 입장해야 기록할 수 있어요" }, 401);
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
    if (url.pathname === "/auth" && request.method === "POST") return handleAuth(env, request);
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
