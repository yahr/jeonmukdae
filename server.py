"""순대국 격파 투어 로컬 서버: 정적 파일 + /api/places (Kakao Local 키워드 검색 중계).
브라우저가 k-skill-proxy 를 직접 부르면 CORS 로 막혀서 여기서 한 번 받아 넘긴다.
실행: python3 server.py 8791
"""
import http.server, json, os, sys, urllib.error, urllib.parse, urllib.request

PROXY = os.environ.get("KSKILL_PROXY_BASE_URL", "https://k-skill-proxy.nomadamas.org") + "/v1/kakao-map/search/keyword"
ALLOWED = {"q", "x", "y", "radius", "sort", "size", "page"}  # 열린 프록시가 되지 않게 파라미터 화이트리스트


PLACE_API = "https://place-api.map.kakao.com/places/panel3/"  # ponytail: 비공식 엔드포인트. 막히면 사진·메뉴만 빠지고 나머지는 돈다
CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
_place_cache = {}


def place_info(pid):
    """카카오 플레이스 상세에서 사진·메뉴·평점·AI 요약만 추려 작은 JSON으로."""
    if pid in _place_cache:
        return _place_cache[pid]
    req = urllib.request.Request(PLACE_API + pid, headers={"User-Agent": CHROME_UA, "Referer": "https://place.map.kakao.com/", "Origin": "https://place.map.kakao.com", "pf": "web"})
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    https = lambda u: (u or "").replace("http://", "https://")
    photos = [{"url": https(p.get("url")), "type": p.get("type", "")} for p in d.get("photos", {}).get("photos", []) if p.get("url")][:12]
    menus = [{"name": m.get("name"), "price": m.get("price"), "desc": m.get("ai_mate_desc") or ""} for m in d.get("menu", {}).get("menus", {}).get("items", [])][:8]
    sc = d.get("kakaomap_review", {}).get("score_set", {}) or {}
    out = {"id": pid, "name": d.get("summary", {}).get("name"), "main": https(d.get("summary", {}).get("main_photo_url")),
           "photos": photos, "menus": menus, "score": {"avg": sc.get("average_score"), "count": sc.get("review_count")},
           "ai": (d.get("ai_mate", {}).get("bottom_sheet", {}) or {}).get("summary", ""),
           "blog_count": d.get("blog_review", {}).get("review_count")}
    _place_cache[pid] = out
    return out


class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/place?"):
            pid = dict(urllib.parse.parse_qsl(self.path.split("?", 1)[1])).get("id", "")
            try:
                body, code = json.dumps(place_info(pid) if pid.isdigit() else {"error": "bad id"}, ensure_ascii=False).encode(), 200
            except urllib.error.HTTPError as e:
                body, code = json.dumps({"error": f"upstream {e.code}"}).encode(), 502
            except Exception as e:
                body, code = json.dumps({"error": str(e)}).encode(), 502
            return self._json(code, body)
        if not self.path.startswith("/api/places?"):
            return super().do_GET()
        qs = {k: v for k, v in urllib.parse.parse_qsl(self.path.split("?", 1)[1]) if k in ALLOWED}
        try:
            req = urllib.request.Request(PROXY + "?" + urllib.parse.urlencode(qs), headers={"User-Agent": "curl/8.4 sundae-quest"})  # Cloudflare 1010 회피
            with urllib.request.urlopen(req, timeout=10) as r:
                body, code = r.read(), 200
        except urllib.error.HTTPError as e:
            body, code = e.read(), e.code
        except Exception as e:  # 네트워크 실패
            body, code = json.dumps({"error": str(e)}).encode(), 502
        self._json(code, body)

    def do_OPTIONS(self):  # 다른 주소(GitHub Pages 등)에서 API만 빌려 쓸 때의 CORS 사전요청
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def _json(self, code, body):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # 조용히
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    print(f"serving on http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), H).serve_forever()
