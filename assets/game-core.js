// 게임 흐름 로직(브라우저·node 테스트 공용): 시즌 카드 나누기, 시즌 매장 목록, 빌런 여부

/** 시즌 목록 → 진행 중(번호 순)·끝남(최근에 끝난 것부터)·다음(가까운 것부터). today = 'YYYY-MM-DD'(KST) */
export function seasonCards(seasons, today) {
  const current = seasons.filter((s) => today >= s.from && today <= s.to).sort((a, b) => a.n - b.n);
  const past = seasons.filter((s) => today > s.to).sort((a, b) => b.to.localeCompare(a.to) || b.n - a.n);
  const next = seasons.filter((s) => today < s.from).sort((a, b) => a.from.localeCompare(b.from));
  return { current, past, next };
}

/** 공식 도장(data/dojos.json)을 맨 위에, 주변 검색 결과(카카오)는 공식과 같은 가게를 빼고 아래에 */
export function storeList(official, places) {
  const ids = new Set(official.map((d) => d.kakaoId).filter(Boolean));
  return [
    ...official.map((d) => ({ kind: "official", key: d.kakaoId || d.slug, name: d.name, dojo: d })),
    ...places.filter((p) => !ids.has(p.id)).map((p) => ({ kind: "near", key: p.id, name: p.place_name, place: p })),
  ];
}

/** 빌런이 있는 부문: divisions.json 에 있고 6축 모두 느낌 문구(feel)가 있을 때 */
export const hasVillain = (divisions, id) => {
  const d = divisions?.find((x) => x.slug === id);
  return !!d && Array.isArray(d.axes) && d.axes.length === 6 && d.axes.every((a) => a.feel);
};
