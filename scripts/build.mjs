// 전먹대 정적 빌드: data/*.json + content/*.md → _site/
//   /                     게임(index.html) + 사이트 공통 메타·JSON-LD 주입
//   /division/<slug>/      부문 페이지(ItemList)
//   /dojo/<slug>/          도장 페이지(Restaurant·FAQPage·BreadcrumbList, JS 없이 읽힘)
//   /guide/<slug>/         큐레이션 글(Article·ItemList)
//   sitemap.xml robots.txt llms.txt .nojekyll
// ponytail: 프레임워크 없이 템플릿 문자열. 페이지 종류가 늘면 Astro로 옮긴다. 데이터 읽기(loadData)와 렌더(render*)를 나눠 둬서 Worker SSR로도 옮길 수 있다.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "_site");
const API = "https://jeonmukdae-api.jeonmukdae.workers.dev";
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/* ---------- 데이터 ---------- */
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
function readMd(dir) {
  const d = join(ROOT, "content", dir);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => {
    const raw = readFileSync(join(d, f), "utf8");
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    const meta = {};
    if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
    return { slug: f.replace(/\.md$/, ""), meta, body: m ? m[2] : raw };
  }).filter((x) => x.meta.draft !== "true");
}
export function loadData() {
  const data = { site: readJson("data/site.json"), divisions: readJson("data/divisions.json"), dojos: readJson("data/dojos.json") };
  data.reviews = Object.fromEntries(readMd("dojo").map((r) => [r.slug, r]));
  data.guides = readMd("guide");
  return data;
}

/* ---------- 작은 도구 ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const TBD = '<span class="tbd">확인 중</span>';
const val = (v) => (v == null || v === "" ? TBD : esc(v));
const fullName = (d) => [d.name, d.branch].filter(Boolean).join(" ");
function md(src) { // 제목·문단·목록·굵게·링크만
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\.{0,2}\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const out = []; let list = null;
  for (const line of src.split("\n")) {
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { if (!list) { list = []; } list.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return out.join("\n");
}
function splitAddress(a) { const t = a.split(/\s+/); return { addressRegion: t[0], addressLocality: t[1], streetAddress: t.slice(2).join(" "), addressCountry: "KR" }; }
function hexSvg(axes, stats) {
  const c = 110, r = 80, pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [c + Math.cos(a) * r * v / 5, c + Math.sin(a) * r * v / 5].map((n) => n.toFixed(1)).join(","); };
  const ring = (k) => axes.map((_, i) => pt(i, k)).join(" ");
  const grid = [1, 2, 3, 4, 5].map((k) => `<polygon points="${ring(k)}" fill="none" stroke="currentColor" stroke-opacity="${k === 5 ? 0.8 : 0.25}"/>`).join("");
  const poly = stats ? `<polygon points="${axes.map((a, i) => pt(i, stats[a.key])).join(" ")}" fill="#3ee8ff55" stroke="#3ee8ff" stroke-width="2"/>` : "";
  const labels = axes.map((a, i) => { const [x, y] = pt(i, 6.2).split(","); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${esc(a.name)}</text>`; }).join("");
  return `<svg class="hex" viewBox="-20 -10 260 240" role="img" aria-label="6각 능력치${stats ? "" : " (확인 중)"}">${grid}${poly}${labels}</svg>`;
}

/* ---------- 레이아웃 ---------- */
function page({ site, path, rel, title, description, image, type = "website", jsonld = [], body, extraHead = "" }) {
  const url = `${site.baseUrl}/${path}`;
  const img = `${site.baseUrl}/${image || site.ogImage}`;
  const v = site.verification || {};
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
${v.google ? `<meta name="google-site-verification" content="${esc(v.google)}">` : "<!-- google-site-verification: data/site.json 에 넣으면 여기 들어감 -->"}
${v.naver ? `<meta name="naver-site-verification" content="${esc(v.naver)}">` : "<!-- naver-site-verification: data/site.json 에 넣으면 여기 들어감 -->"}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${esc(site.locale || "ko_KR")}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Do+Hyeon&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rel}assets/site.css">
${jsonld.map(ld).join("\n")}
${extraHead}
</head>
<body>
<header class="top"><a class="logo" href="${rel}">전국먹자대회<span>#전먹대</span></a><a class="btn" href="${rel}">▶ 게임 입장</a></header>
<main>
${body}
</main>
<footer class="foot">
<p>${esc(site.name)}(${esc(site.shortName)}) · 가게 정보는 카카오 로컬 API와 운영자 방문으로 확인해요. 모르는 값은 지어내지 않고 '확인 중'으로 둬요.</p>
<p><a href="${rel}">게임</a> · <a href="${rel}sitemap.xml">사이트맵</a> · <a href="${rel}llms.txt">llms.txt</a></p>
</footer>
</body>
</html>
`;
}

/* ---------- 페이지별 렌더 ---------- */
export function renderDojo(data, d) {
  const { site, divisions, dojos, reviews } = data;
  const div = divisions.find((x) => x.slug === d.division);
  const rel = "../../";
  const name = fullName(d);
  const review = reviews[d.slug];
  const others = dojos.filter((x) => x.division === d.division && x.slug !== d.slug).sort((a, b) => a.order - b.order);
  const q = encodeURIComponent(`${name} ${d.address}`);
  const maps = { kakao: d.maps?.kakao, naver: d.maps?.naver || `https://map.naver.com/p/search/${q}`, google: d.maps?.google || `https://www.google.com/maps/search/?api=1&query=${q}` };
  const answered = d.faq.filter((f) => f.a);
  const url = `${site.baseUrl}/dojo/${d.slug}/`;
  const image = d.image && existsSync(join(ROOT, d.image)) ? d.image : site.ogImage;
  const description = `${div.name} 부문 도장 ${name}. ${d.address}. ${d.tagline ? d.tagline + ". " : ""}대표 메뉴·가격·포장·영업시간과 6각 능력치를 전먹대에서 확인해요.`;
  const restaurant = {
    "@context": "https://schema.org", "@type": "Restaurant", "@id": url + "#restaurant",
    name, url, image: `${site.baseUrl}/${image}`, servesCuisine: "만두",
    address: { "@type": "PostalAddress", ...splitAddress(d.address) },
    geo: { "@type": "GeoCoordinates", latitude: d.geo.lat, longitude: d.geo.lng },
    ...(d.phone ? { telephone: d.phone } : {}), ...(d.maps?.kakao ? { hasMap: d.maps.kakao } : {}),
    ...(d.priceRange ? { priceRange: d.priceRange } : {}), ...(d.hours ? { openingHours: d.hours } : {}),
    ...(review ? { review: { "@type": "Review", author: { "@type": "Person", name: site.author }, reviewBody: review.meta.description || name + " 방문 후기", datePublished: review.meta.date || TODAY } } : {}),
  };
  const jsonld = [restaurant,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: site.name, item: site.baseUrl + "/" },
      { "@type": "ListItem", position: 2, name: `${div.name} 부문`, item: `${site.baseUrl}/division/${div.slug}/` },
      { "@type": "ListItem", position: 3, name, item: url }] }];
  if (answered.length) jsonld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: answered.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });

  const info = [["대표 메뉴", d.menu], ["가격대", d.priceRange], ["포장", d.takeout], ["주차", d.parking], ["영업시간", d.hours]];
  const body = `
<nav class="crumb"><a href="${rel}">전먹대</a> › <a href="${rel}division/${div.slug}/">${esc(div.emoji)} ${esc(div.name)} 부문</a> › ${esc(name)}</nav>
<article class="dojo">
  <p class="tape">${esc(div.name)} 부문 · ${d.order}호 도장</p>
  <h1>${esc(name)}</h1>
  <p class="lead">${d.tagline ? esc(d.tagline) : TBD}</p>
  <a class="btn big" href="${rel}?vs=${esc(d.slug)}#${esc(div.slug)}">⚔ 격파하러 가기 · 행복 대결</a>

  <section><h2>한눈에 보기</h2>
    <dl class="info">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${val(v)}</dd></div>`).join("")}</dl>
  </section>

  <section><h2>6각 능력치</h2>
    <div class="stats">${hexSvg(div.axes, d.stats)}
      <ul class="axes">${div.axes.map((a) => `<li><b>${esc(a.name)}</b> ${d.stats ? `<span class="score">${d.stats[a.key]}/5</span>` : TBD}<br><small>${esc(a.desc)}${a.move ? ` · 필살기 「${esc(a.move.name)}」` : ""}</small></li>`).join("")}</ul>
    </div>
    <p class="note">${esc(div.scoring)}</p>
    <p class="note">이 가게는 도장을 지키는 <b>행복한 빌런</b>이에요. 능력치가 필살기가 되어, 맛있을수록 플레이어가 행복 게이지가 꽉 차 쓰러져요(행복 KO). 지는 게 최고의 찬사예요.</p>
  </section>

  <section><h2>도발 미션·격파·행복 KO 기록</h2>
    <div id="live" data-division="${esc(div.slug)}" data-kakao="${esc(d.kakaoId || "")}"><p class="note">실시간 격파 수와 도발 미션은 게임에서 기록돼요. <a href="${rel}#${esc(div.slug)}">게임에서 보기</a></p></div>
  </section>

  ${review ? `<section class="review"><h2>직접 사 먹고 쓴 후기</h2><p class="note">이 글은 운영자가 제 돈으로 직접 사 먹고 쓴 후기예요.${review.meta.date ? " (" + esc(review.meta.date) + " 방문)" : ""}</p>${md(review.body)}</section>` : ""}

  <section><h2>자주 묻는 질문</h2>
    <dl class="faq">${d.faq.map((f) => `<div><dt>${esc(f.q)}</dt><dd>${f.a ? esc(f.a) : TBD}</dd></div>`).join("")}</dl>
  </section>

  <section><h2>매장 정보</h2>
    <dl class="info nap">
      <div><dt>상호</dt><dd>${esc(name)}${d.kakaoName && d.kakaoName !== name ? ` <small>(카카오맵 등록명: ${esc(d.kakaoName)})</small>` : ""}</dd></div>
      <div><dt>주소</dt><dd>${esc(d.address)}${d.jibun ? `<br><small>지번 ${esc(d.jibun)}</small>` : ""}</dd></div>
      <div><dt>전화</dt><dd>${val(d.phone)}</dd></div>
    </dl>
    <p class="maps"><a class="btn" href="${esc(maps.kakao || maps.naver)}" rel="noopener" target="_blank">카카오맵</a> <a class="btn" href="${esc(maps.naver)}" rel="noopener" target="_blank">네이버 지도</a> <a class="btn" href="${esc(maps.google)}" rel="noopener" target="_blank">구글 지도</a></p>
    <p class="note">출처: ${esc(d.source)}</p>
  </section>

  ${d.links?.length ? `<section><h2>관련 글</h2><ul>${d.links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.title)}</a></li>`).join("")}</ul></section>` : ""}

  ${others.length ? `<section><h2>같은 부문 다른 도장</h2><ul class="cards">${others.map((o) => `<li><a href="${rel}dojo/${o.slug}/"><b>${esc(fullName(o))}</b><small>${esc(o.address)}</small></a></li>`).join("")}</ul></section>` : ""}
</article>
<script>
// 있으면 좋은 것: 게임 서버에서 이 가게의 격파 수·도발 미션을 불러와 덧붙인다(없어도 본문은 그대로).
(async()=>{const el=document.getElementById('live');const div=el.dataset.division,kid=el.dataset.kakao;if(!kid)return;
try{const r=await fetch('${API}/db/sync?cols='+encodeURIComponent('menus/'+div+'/spots,menus/'+div+'/missions,menus/'+div+'/kos')+'&since=0');const j=await r.json();
const docs=(j.docs||[]).filter(x=>!x.deleted&&x.body);const spots=docs.filter(x=>x.col.endsWith('/spots')&&x.body.place&&String(x.body.place.id)===kid);
const ms=docs.filter(x=>x.col.endsWith('/missions')&&x.body.place&&String(x.body.place.id)===kid);
const kd=docs.filter(x=>x.col.endsWith('/kos')).map(x=>x.body),kos=new Set(kd.filter(k=>String(k.key)===kid).map(k=>k.by));
const MV=${JSON.stringify(div.axes.map((a) => a.move?.name || a.name))};let wp='';
try{const c=await import('${rel}assets/battle-core.js');const w=c.weaponRank(kd,kid,MV.length);wp='<p class="weap">'+(w.length?'손님들이 뽑은 필살 무기: '+w.map((x,i)=>(i+1)+'위 '+MV[x.i]+' '+x.count+'번').join(' · '):kos.size?'아직 필살 무기 기록이 없어요':'아직 아무도 쓰러지지 않았어요')+'</p>';}catch(e){}
const e=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
el.innerHTML='<p><b class="score">'+spots.length+'</b>번 격파됐어요. 행복 KO 당한 플레이어 <b class="score">'+kos.size+'</b>명.</p>'+wp+'<p class="note">필살 무기는 플레이어들이 대결에서 실제로 누른 맛 기록이라 위 6각 능력치(운영자 평가)와 따로 세요.</p>'+(ms.length?'<ul>'+ms.map(m=>'<li>“'+e(m.body.title)+'” '+(m.body.done?'<span class="done">격파됨</span>':Object.values(m.body.votes||{}).filter(Boolean).length+'표')+'</li>').join('')+'</ul>':'<p class="note">아직 도발 미션이 없어요. 게임에서 첫 도발을 걸어 보세요.</p>')+'<p><a href="${rel}#'+div+'">게임에서 보기</a></p>';}catch(e){}})();
</script>`;
  return page({ site, path: `dojo/${d.slug}/`, rel, title: `${name} | ${div.name} 부문 도장 - ${site.name}`, description, image, type: "article", jsonld, body });
}

export function renderDivision(data, div) {
  const { site, dojos } = data;
  const rel = "../../";
  const list = dojos.filter((d) => d.division === div.slug).sort((a, b) => a.order - b.order);
  const month = div.season ? `${+div.season.from.slice(5, 7)}월` : "";
  const title = `${month ? month + " " : ""}${div.name} 부문 도장 ${list.length}곳 - ${site.name}`;
  const description = `${div.intro.slice(0, 80)} 도장 ${list.length}곳: ${list.map(fullName).join(", ")}.`;
  const image = existsSync(join(ROOT, `assets/og/division-${div.slug}.png`)) ? `assets/og/division-${div.slug}.png` : site.ogImage;
  const jsonld = [{ "@context": "https://schema.org", "@type": "ItemList", name: `${div.name} 부문 도장`, numberOfItems: list.length,
    itemListElement: list.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: fullName(d), url: `${site.baseUrl}/dojo/${d.slug}/` })) }];
  const body = `
<nav class="crumb"><a href="${rel}">전먹대</a> › ${esc(div.emoji)} ${esc(div.name)} 부문</nav>
<article>
  <p class="tape">${div.season ? `제${div.season.n}회 · ${esc(div.season.from)} ~ ${esc(div.season.to)}` : "상시 부문"}</p>
  <h1>${esc(div.emoji)} ${month ? esc(month) + " " : ""}${esc(div.name)} 부문 개막</h1>
  <p class="lead">${esc(div.intro)}</p>
  <a class="btn big" href="${rel}#${esc(div.slug)}">▶ ${esc(div.name)} 도장 입장</a>
  <section><h2>도장 ${list.length}곳</h2>
    <ul class="cards">${list.map((d) => `<li><a href="${rel}dojo/${d.slug}/"><span class="tape">${d.order}호</span><b>${esc(fullName(d))}</b><small>${esc(d.address)}</small><small>${d.stats ? "능력치 공개" : "능력치 확인 중"}</small></a></li>`).join("")}</ul>
  </section>
  <section><h2>능력치 산정 기준</h2>
    <ul class="axes">${div.axes.map((a) => `<li><b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small></li>`).join("")}</ul>
    <p class="note">${esc(div.scoring)} 특정 가게만 밀지 않도록 같은 동네 가게를 함께 올려요.</p>
  </section>
</article>`;
  return page({ site, path: `division/${div.slug}/`, rel, title, description, image, jsonld, body });
}

export function renderGuide(data, g) {
  const { site, dojos } = data;
  const rel = "../../";
  const picks = (g.meta.dojos || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => dojos.find((d) => d.slug === s)).filter(Boolean);
  const url = `${site.baseUrl}/guide/${g.slug}/`;
  const jsonld = [{ "@context": "https://schema.org", "@type": "Article", headline: g.meta.title, description: g.meta.description, datePublished: g.meta.date || TODAY, author: { "@type": "Person", name: site.author }, mainEntityOfPage: url }];
  if (picks.length) jsonld.push({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: picks.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: fullName(d), url: `${site.baseUrl}/dojo/${d.slug}/` })) });
  const body = `<nav class="crumb"><a href="${rel}">전먹대</a> › 큐레이션</nav><article><h1>${esc(g.meta.title)}</h1><p class="note">운영자가 직접 사 먹고 고른 목록이에요.</p>${md(g.body)}
${picks.length ? `<section><h2>이 글의 도장</h2><ul class="cards">${picks.map((d) => `<li><a href="${rel}dojo/${d.slug}/"><b>${esc(fullName(d))}</b><small>${esc(d.address)}</small></a></li>`).join("")}</ul></section>` : ""}</article>`;
  return page({ site, path: `guide/${g.slug}/`, rel, title: `${g.meta.title} - ${site.name}`, description: g.meta.description || g.meta.title, type: "article", jsonld, body });
}

function homeHead(data) {
  const { site } = data;
  const img = `${site.baseUrl}/${site.ogImage}`, url = `${site.baseUrl}/`, v = site.verification || {};
  return [
    `<meta name="description" content="${esc(site.description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    v.google ? `<meta name="google-site-verification" content="${esc(v.google)}">` : "",
    v.naver ? `<meta name="naver-site-verification" content="${esc(v.naver)}">` : "",
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:locale" content="ko_KR">`,
    `<meta property="og:title" content="${esc(site.name)}"><meta property="og:description" content="${esc(site.description)}">`,
    `<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(img)}">`,
    ld({ "@context": "https://schema.org", "@type": "WebSite", name: site.name, alternateName: site.shortName, url, description: site.description, inLanguage: "ko" }),
    ld({ "@context": "https://schema.org", "@type": "Organization", name: site.name, alternateName: site.shortName, url, logo: img }),
  ].filter(Boolean).join("\n");
}

/* ---------- 실행 ---------- */
export function build() {
  const data = loadData();
  const errs = validate(data);
  for (const g of data.guides) for (const s of (g.meta.dojos || "").split(",").map((x) => x.trim()).filter(Boolean))
    if (!data.dojos.some((d) => d.slug === s)) errs.push(`content/guide/${g.slug}.md: 없는 도장 '${s}'`);
  for (const slug of Object.keys(data.reviews)) if (!data.dojos.some((d) => d.slug === slug)) errs.push(`content/dojo/${slug}.md: dojos.json에 없는 slug`);
  if (errs.length) { console.error("데이터 오류로 빌드를 멈춰요:\n- " + errs.join("\n- ")); process.exit(1); }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const write = (p, s) => { const f = join(OUT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, s); };
  const { site } = data;

  const game = readFileSync(join(ROOT, "index.html"), "utf8");
  if (!game.includes("<!--SEO-->")) { console.error("index.html에 <!--SEO--> 자리가 없어요"); process.exit(1); }
  // 메인 맨 아래 작은 바닥글 한 줄: 검색엔진이 부문·도장 페이지를 찾게 링크만 둔다(패널 아님)
  const links = `<footer class="seo-foot">부문·도장 안내: ${data.divisions.map((dv) => {
    const ds = data.dojos.filter((d) => d.division === dv.slug).sort((a, b) => a.order - b.order);
    return `<a href="division/${dv.slug}/">${esc(dv.name)}</a>${ds.length ? ` (${ds.map((d) => `<a href="dojo/${d.slug}/">${esc(fullName(d))}</a>`).join(" · ")})` : ""}`;
  }).join(" · ")}</footer>`;
  write("index.html", game.replace("<!--SEO-->", homeHead(data)).replace("<!--DOJO-LINKS-->", links));
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  cpSync(join(ROOT, "data"), join(OUT, "data"), { recursive: true });
  write(".nojekyll", "");

  const urls = [{ loc: `${site.baseUrl}/`, pri: "1.0" }];
  for (const div of data.divisions) { write(`division/${div.slug}/index.html`, renderDivision(data, div)); urls.push({ loc: `${site.baseUrl}/division/${div.slug}/`, pri: "0.9" }); }
  for (const d of data.dojos) { write(`dojo/${d.slug}/index.html`, renderDojo(data, d)); urls.push({ loc: `${site.baseUrl}/dojo/${d.slug}/`, pri: "0.8" }); }
  for (const g of data.guides) { write(`guide/${g.slug}/index.html`, renderGuide(data, g)); urls.push({ loc: `${site.baseUrl}/guide/${g.slug}/`, pri: "0.7" }); }

  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${TODAY}</lastmod><priority>${u.pri}</priority></url>`).join("\n")}\n</urlset>\n`);
  const bots = ["Googlebot", "Yeti", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Applebot"];
  write("robots.txt", `${bots.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n")}\n\nUser-agent: *\nAllow: /\n\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
  write("llms.txt", `# ${site.name} (${site.shortName})\n\n> ${site.description}\n\n가게 정보는 카카오 로컬 API와 운영자 방문으로 확인하고, 모르는 값은 '확인 중'으로 둬요.\n\n## 부문\n${data.divisions.map((d) => `- [${d.name} 부문](${site.baseUrl}/division/${d.slug}/): ${d.intro}`).join("\n")}\n\n## 도장\n${data.dojos.map((d) => `- [${fullName(d)}](${site.baseUrl}/dojo/${d.slug}/): ${data.divisions.find((x) => x.slug === d.division).name} 부문, ${d.address}`).join("\n")}\n${data.guides.length ? `\n## 큐레이션\n${data.guides.map((g) => `- [${g.meta.title}](${site.baseUrl}/guide/${g.slug}/)`).join("\n")}\n` : ""}`);
  console.log(`빌드 완료: 부문 ${data.divisions.length} · 도장 ${data.dojos.length} · 큐레이션 ${data.guides.length} · URL ${urls.length}개 → _site/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
