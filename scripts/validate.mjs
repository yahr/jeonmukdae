// 데이터 검증: 빠진 필수 값·잘못된 형식이 있으면 오류 목록을 돌려준다. 빌드는 오류가 하나라도 있으면 멈춘다.
// ponytail: zod 대신 손으로 쓴 검사. 필드가 많이 늘면 JSON Schema로 옮긴다.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isNullableStr = (v) => v === null || isStr(v);

export function validate({ site, divisions, dojos }) {
  const errs = [];
  const at = (where, msg) => errs.push(`${where}: ${msg}`);

  for (const k of ["name", "baseUrl", "description"]) if (!isStr(site?.[k])) at("site.json", `${k} 필요`);
  if (isStr(site?.baseUrl) && !/^https:\/\/[^\s]+[^/]$/.test(site.baseUrl)) at("site.json", "baseUrl은 https:// 로 시작하고 / 로 끝나지 않아야 함");

  const divSlugs = new Set();
  (divisions || []).forEach((d, i) => {
    const w = `divisions[${i}]${d?.slug ? " " + d.slug : ""}`;
    if (!SLUG.test(d?.slug || "")) at(w, "slug는 영문 소문자·숫자·하이픈");
    if (divSlugs.has(d?.slug)) at(w, "slug 중복");
    divSlugs.add(d?.slug);
    for (const k of ["name", "intro", "scoring"]) if (!isStr(d?.[k])) at(w, `${k} 필요`);
    if (!Array.isArray(d?.axes) || d.axes.length !== 6) at(w, "axes는 정확히 6개");
    else d.axes.forEach((a, j) => { if (!isStr(a?.key) || !isStr(a?.name) || !isStr(a?.desc)) at(w, `axes[${j}] key·name·desc 필요`); });
  });

  const seen = new Set();
  (dojos || []).forEach((d, i) => {
    const w = `dojos[${i}]${d?.slug ? " " + d.slug : ""}`;
    if (!SLUG.test(d?.slug || "")) at(w, "slug는 영문 소문자·숫자·하이픈");
    if (seen.has(d?.slug)) at(w, "slug 중복");
    seen.add(d?.slug);
    if (!divSlugs.has(d?.division)) at(w, `없는 부문 '${d?.division}'`);
    for (const k of ["name", "address", "source"]) if (!isStr(d?.[k])) at(w, `${k} 필요`);
    for (const k of ["branch", "tagline", "jibun", "phone", "menu", "priceRange", "takeout", "parking", "hours", "image"])
      if (k in (d || {}) && !isNullableStr(d[k])) at(w, `${k}는 글자 또는 null`);
    if (!d?.geo || typeof d.geo.lat !== "number" || typeof d.geo.lng !== "number") at(w, "geo.lat·geo.lng 숫자 필요");
    if (d?.stats !== null && d?.stats !== undefined) {
      const div = (divisions || []).find((x) => x.slug === d.division);
      for (const a of div?.axes || []) {
        const v = d.stats[a.key];
        if (typeof v !== "number" || v < 0 || v > 5) at(w, `stats.${a.key}는 0~5 숫자`);
      }
    }
    if (!Array.isArray(d?.faq)) at(w, "faq 배열 필요");
    else d.faq.forEach((f, j) => { if (!isStr(f?.q) || !isNullableStr(f?.a)) at(w, `faq[${j}] q 필요, a는 글자 또는 null`); });
    for (const k of ["kakao", "naver", "google"]) { const u = d?.maps?.[k]; if (u != null && !/^https:\/\//.test(u)) at(w, `maps.${k}는 https 주소 또는 null`); }
  });
  return errs;
}
