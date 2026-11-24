// 행복한 빌런: 숫자 로직(브라우저·node 테스트 공용). 화면 연출은 battle.js
// 규칙(2026-11-24): 느낌 버튼 하나 = 그 맛의 빌런 필살기 한 방.
//   기본 데미지 = 최대치의 1/n(n = 기술 수). 같은 기술 k번째 = 1/n × (1 + step×(k−1)), 상한 cap배.
//   화면은 플레이어 "정신줄"(HP)이 깎이는 모양이지만 속은 행복 게이지다: 정신줄 = 100 − 행복.
//   가게 능력치(stats)는 데미지가 아니라 연출 크기·문구에만 쓴다.
export const GAUGE_MAX = 100;
export const DMG = { step: 0.5, cap: 3 }; // 부문 데이터 divisions.json 의 damage 로 바꿀 수 있다
const EPS = 1e-9;

export const mult = (k, d = DMG) => Math.min(d.cap, 1 + d.step * (k - 1));
export const start = (n, d = DMG) => ({ n, d, happy: 0, uses: Array(n).fill(0), presses: 0, ko: false, move: -1, k: 0, mult: 1, gain: 0, overkill: 0 });

/** 느낌 버튼 i 를 눌렀다. KO 뒤에는 그대로 */
export function press(s, i) {
  if (s.ko) return s;
  const uses = s.uses.slice(), k = ++uses[i], m = mult(k, s.d), gain = (GAUGE_MAX / s.n) * m, raw = s.happy + gain, ko = raw >= GAUGE_MAX - EPS;
  return { ...s, uses, presses: s.presses + 1, happy: ko ? GAUGE_MAX : raw, ko, move: i, k, mult: m, gain, overkill: ko ? Math.max(0, raw - GAUGE_MAX) : 0 };
}
/** 정신줄(화면용 HP) */
export const hp = (s) => Math.max(0, Math.round(GAUGE_MAX - s.happy));

/** 능력치 출처: 운영자 stats(축 key별) > 플레이어 6각 평균 > 기본값 3 */
export function statsFor({ stats, axes, players }) {
  if (stats && axes.every((a) => typeof stats[a.key] === "number")) return { vals: axes.map((a) => stats[a.key]), source: "official", n: 0 };
  if (players?.n > 0) return { vals: players.avg.slice(0, 6), source: "players", n: players.n };
  return { vals: [3, 3, 3, 3, 3, 3], source: "default", n: 0 };
}

/** 이번 판 필살 무기: 가장 많이 누른 기술(공동이면 모두) */
export const topMoves = (uses) => { const max = Math.max(0, ...uses); return max ? uses.map((count, i) => ({ i, count })).filter((x) => x.count === max) : []; };

/** 손님들이 뽑은 필살 무기: 그 가게 KO 기록들의 기술별 횟수 합 1~3위 */
export function weaponRank(kos, key, n = 6) {
  const sum = Array(n).fill(0);
  for (const k of kos) if (k?.key === key && Array.isArray(k.uses)) k.uses.forEach((c, i) => { if (i < n) sum[i] += +c || 0; });
  return sum.map((count, i) => ({ i, count })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count || a.i - b.i).slice(0, 3);
}

/** 오늘 나를 쓰러뜨린 맛 → 6각 평가 초안(가장 많이 누른 맛 5점, 안 누른 맛 1점) */
export const tasteDraft = (uses) => { const max = Math.max(0, ...uses); return max ? uses.map((c) => Math.round(1 + (4 * c) / max)) : null; };

/** 받침 따라 '로/으로'(받침 없거나 ㄹ이면 로) */
const ro = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; if (c < 0 || c > 11171) return w + "로"; const j = c % 28; return w + (j === 0 || j === 8 ? "로" : "으로"); };
export const weaponLine = (name, words, presses) => `${name}, ${words.length === 1 ? `${words[0]} 하나로` : ro(words.join("·"))} ${presses}입 만에 나를 보냈다`;

/** 최강 빌런 순위: 쓰러뜨린 플레이어 수(중복 제외, 각자 최소 입 수) → 평균 입 수 적은 순 */
export function villainRank(kos) {
  const g = new Map();
  for (const k of kos) {
    if (!k?.key || !k.by) continue;
    const v = g.get(k.key) || { key: k.key, name: k.name, slug: k.slug || null, best: new Map() };
    const prev = v.best.get(k.by);
    v.best.set(k.by, prev == null ? +k.bites || 0 : Math.min(prev, +k.bites || 0));
    g.set(k.key, v);
  }
  return [...g.values()]
    .map(({ best, ...v }) => ({ ...v, kos: best.size, avgBites: Math.round(([...best.values()].reduce((a, b) => a + b, 0) / best.size) * 10) / 10 }))
    .sort((a, b) => b.kos - a.kos || a.avgBites - b.avgBites);
}
