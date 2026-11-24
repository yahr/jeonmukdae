// 행복한 빌런: 숫자 로직(브라우저·node 테스트 공용). 화면 연출은 battle.js
export const GAUGE_MAX = 100;
export const COMBO_MS = 1500; // 이 안에 다시 먹으면 콤보

/** 한 입 행복 증가량. stat 0~5, combo 0~4(그 이상은 4) */
export const gain = (stat, combo) => Math.round((5 + 5 * stat) * (1 + 0.25 * Math.min(combo, 4)));

/** 능력치 출처: 운영자 stats(축 key별) > 플레이어 6각 평균 > 기본값 3 */
export function statsFor({ stats, axes, players }) {
  if (stats && axes.every((a) => typeof stats[a.key] === "number")) return { vals: axes.map((a) => stats[a.key]), source: "official", n: 0 };
  if (players?.n > 0) return { vals: players.avg.slice(0, 6), source: "players", n: players.n };
  return { vals: [3, 3, 3, 3, 3, 3], source: "default", n: 0 };
}

/** 센 능력치부터(같으면 앞 축부터) */
const order = (vals) => vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map((x) => x[1]);

export const start = (vals) => ({ vals, order: order(vals), happy: 0, bites: 0, combo: 0, last: -Infinity, ko: false, move: -1, gain: 0 });

/** 한 입. KO 뒤에는 그대로 */
export function bite(s, now) {
  if (s.ko) return s;
  const combo = now - s.last <= COMBO_MS ? s.combo + 1 : 0;
  const move = s.order[s.bites % 6];
  const g = gain(s.vals[move], combo);
  const happy = Math.min(GAUGE_MAX, s.happy + g);
  return { ...s, happy, bites: s.bites + 1, combo, last: now, ko: happy >= GAUGE_MAX, move, gain: g };
}

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

export const koLine = (name, bites) => `${name}에게 ${bites}입 만에 행복 KO`;
