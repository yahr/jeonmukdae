// 도장 하나 추가: 카카오 로컬 검색(전먹대 Worker 경유)으로 상호·주소·좌표만 가져와 data/dojos.json 끝에 붙인다.
//   npm run add-dojo -- "검색어" --division jjinmandu --slug mandu-xxx [--pick 2]
// 메뉴·가격·영업시간·능력치는 비워 두고(화면에 '확인 중'), 방문 뒤 JSON을 고친다.
import { readFileSync, writeFileSync } from "node:fs";
import { validate } from "./validate.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
const query = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const division = opt("division"), slug = opt("slug"), pick = +(opt("pick") || 1);
if (!query || !division || !slug) { console.error('사용법: npm run add-dojo -- "검색어" --division jjinmandu --slug mandu-xxx [--pick 2]'); process.exit(1); }

const r = await fetch(`https://jeonmukdae-api.jeonmukdae.workers.dev/api/places?q=${encodeURIComponent(query)}&size=5`);
const docs = (await r.json()).documents || [];
docs.forEach((d, i) => console.log(`${i + 1}. ${d.place_name} | ${d.road_address_name || d.address_name} | ${d.category_name}`));
const p = docs[pick - 1];
if (!p) { console.error("검색 결과가 없어요"); process.exit(1); }

const path = new URL("../data/dojos.json", import.meta.url);
const dojos = JSON.parse(readFileSync(path, "utf8"));
const order = Math.max(0, ...dojos.filter((d) => d.division === division).map((d) => d.order)) + 1;
const road = p.road_address_name || p.address_name;
dojos.push({
  slug, division, order, name: p.place_name, branch: null, kakaoName: p.place_name, tagline: null,
  address: road, jibun: p.address_name || null, phone: p.phone || null,
  menu: null, priceRange: null, takeout: null, parking: null, hours: null, stats: null,
  geo: { lat: +p.y, lng: +p.x }, kakaoId: String(p.id),
  maps: { kakao: p.place_url ? p.place_url.replace("http://", "https://") : null, naver: null, google: null },
  image: `assets/og/${slug}.png`, links: [],
  faq: [{ q: "어디에 있나요?", a: `${road}${p.address_name && p.address_name !== road ? `(지번 ${p.address_name.replace(/^서울 \S+구 /, "")})` : ""}이에요.` }],
  source: `카카오 로컬 API(${new Date().toISOString().slice(0, 10)} 확인)`,
});
const errs = validate({ site: JSON.parse(readFileSync(new URL("../data/site.json", import.meta.url))), divisions: JSON.parse(readFileSync(new URL("../data/divisions.json", import.meta.url))), dojos });
if (errs.length) { console.error("추가하지 않았어요:\n- " + errs.join("\n- ")); process.exit(1); }
writeFileSync(path, JSON.stringify(dojos, null, 2) + "\n");
console.log(`추가: ${p.place_name} → /dojo/${slug}/ (공유 이미지는 npm run og 로 만들고 커밋)`);
