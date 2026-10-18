// 전국먹자대회 API Worker: server.py의 두 중계 엔드포인트를 Cloudflare Workers로 옮긴 것.
//   GET /api/places?q=&x=&y=&radius=&sort=&size=&page=  → k-skill-proxy (Kakao Local 키워드 검색)
//   GET /api/place?id=                                   → 카카오 플레이스 상세(사진·메뉴·평점·AI 요약) 요약본
// ponytail: 플레이스 상세는 비공식 엔드포인트. 막히면 사진·메뉴만 빠지고 나머지는 돈다.

const PROXY = "https://k-skill-proxy.nomadamas.org/v1/kakao-map/search/keyword";
const PLACE_API = "https://place-api.map.kakao.com/places/panel3/";
const ALLOWED = ["q", "x", "y", "radius", "sort", "size", "page"];
const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*" };

const json = (body, status = 200, extra = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra },
  });

const https = (u) => (u || "").replace(/^http:\/\//, "https://");

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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
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

    return json({ ok: true, routes: ["/api/places", "/api/place"] });
  },
};
