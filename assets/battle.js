// 행복한 빌런 대결 화면(요청서 3-8, 3-8-1). index.html이 버튼을 누를 때 import()로 불러온다.
// 조작: 먹으면서 느낀 걸 누른다(느낌 버튼 6개 = 6각 축). 그 맛의 빌런 필살기가 나를 "공격"한다.
// 화면은 격투 게임처럼 내 정신줄(HP)이 깎이지만, 깎일 때 뜨는 숫자는 "행복 +N". 0이 되면 행복 K.O.(지는 게 최고의 찬사)
// ponytail: 효과는 DOM + Web Animations, 파티클만 Canvas. 그림 에셋은 assets/battle/manifest.json에 있으면 쓰고 없으면 이모지·CSS로.
// 카메라: 무대(.bt-cam)에 transform(translate+scale)을 걸어 얼굴로 줌인·팬. 정신줄·버튼은 무대 밖이라 흔들리지 않는다.
import { GAUGE_MAX, DMG, start, press, hp, topMoves, tasteDraft, weaponLine } from "./battle-core.js";

const BASE = new URL("./", import.meta.url).href;
const FX = ["drops", "combo", "counter", "stack", "steam", "bag"];
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let manifest = null, art = {}; // art: 이 부문 그림 {villain:{idle,taunt,special,win}, dumpling, steamer, bag, ko}
const loadArt = async (div) => { manifest ??= await fetch(BASE + "battle/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})); art = manifest[div] || {}; };
const img = (k, cls = "", fallback = "") => (typeof art?.[k] === "string" ? `<img class="${cls}" src="${BASE}battle/${esc(art[k])}" alt="" draggable="false">` : fallback);
const pix = (f, k) => `<img class="pix" src="${esc(f.src)}" width="${f.w * k}" height="${f.h * k}" alt="" draggable="false">`;

/** 미니 6각: vals 0~5 */
function miniHex(vals, labels, size = 190) {
  const c = size / 2, r = size / 2 - 30, pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [c + Math.cos(a) * r * v / 5, c + Math.sin(a) * r * v / 5]; };
  const ring = (k) => [0, 1, 2, 3, 4, 5].map((i) => pt(i, k).join(",")).join(" ");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${[1, 3, 5].map((k) => `<polygon points="${ring(k)}" fill="none" stroke="#9b93c9" stroke-opacity="${k === 5 ? 0.9 : 0.35}"/>`).join("")}
    <polygon points="${vals.map((v, i) => pt(i, v).join(",")).join(" ")}" fill="#ff4fa3" fill-opacity=".45" stroke="#ff4fa3" stroke-width="3"/>
    ${labels.map((l, i) => { const [x, y] = pt(i, 6.3); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#f5f0dc">${esc(l)}</text>`; }).join("")}</svg>`;
}

const CSS = `
#battle{padding:0;border:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;background:#12102a;color:var(--fg);overflow:hidden;box-shadow:none}
#battle::backdrop{background:#07061a}
.bt{position:relative;height:100%;display:grid;grid-template-rows:auto 1fr auto;font-family:var(--ko);user-select:none;-webkit-user-select:none}
.bt-hud{padding:max(10px,env(safe-area-inset-top,0px)) 14px 6px;display:grid;gap:6px;background:#12102a;z-index:3}
.bt-top{display:flex;gap:8px;align-items:center;justify-content:space-between}
.bt-vs{font-size:19px;min-width:0;overflow-wrap:anywhere;line-height:1.2}.bt-vs b{color:var(--m);font-family:var(--px);font-size:12px;margin-right:6px}
.bt-x{flex:none;display:flex;gap:6px}.bt-x .btn{padding:6px 10px;font-size:16px}
.bt-hp{position:relative;height:24px;border:3px solid var(--fg);background:#3a0d18;box-shadow:3px 3px 0 #07061a}
.bt-hp i,.bt-hp u{position:absolute;left:0;top:0;bottom:0;width:100%}
.bt-hp u{background:#fff;transition:width .5s .35s}
.bt-hp i{background:repeating-linear-gradient(90deg,#ff3b4f 0 10px,#ff6b6b 10px 20px);transition:width .2s steps(6)}
.bt-hp.low i{background:repeating-linear-gradient(90deg,#ffd23f 0 10px,#ff9f43 10px 20px)}
.bt-hp>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-size:14px;color:#fff;text-shadow:2px 2px 0 #000}
.bt-hp b{font-family:var(--px);font-size:10px;font-weight:400}
.bt-src{font-size:13px;color:var(--dim)}.bt-src b{color:var(--y);font-weight:400}
.bt-arena{position:relative;overflow:hidden;background:linear-gradient(#1d1a3f 0 84%,#2a2350 84% 85.5%,#262253 85.5%);transition:background 1.2s}
.bt-arena.warm{background:linear-gradient(#ff9f43 0,#ff6f91 84%,#c94f7c 84% 85.5%,#7a3b6b 85.5%)}
.bt-cam{position:absolute;inset:0;transform-origin:0 0;z-index:2}
.bt-breathe{position:absolute;inset:0;transform-origin:50% 92%;animation:bt-breath 3.2s ease-in-out infinite}
@keyframes bt-breath{50%{transform:scale(1.015)}}
.pix{image-rendering:pixelated;display:block;max-width:none}
.bt-arena canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.bt-p,.bt-ghost{position:absolute;left:2%;bottom:9%;z-index:2;line-height:0;transform-origin:50% 100%}
.bt-ghost{pointer-events:none;z-index:1}
.bt-p svg,.bt-ghost svg{width:min(40vw,190px);height:auto}
.bt-v{position:absolute;right:2%;bottom:9%;z-index:1;line-height:0;text-align:center;transform-origin:50% 100%}
.bt-v.flip .pix{transform:scaleX(-1)}
.bt-v .emo{font-size:min(32vw,140px);line-height:1;display:block;filter:drop-shadow(6px 6px 0 #07061a);animation:bt-bob 1.6s steps(4) infinite}
.bt-v .horn{position:absolute;top:-6px;width:0;height:0;border:10px solid transparent;border-bottom:18px solid var(--m)}
.bt-v .horn.l{left:22%}.bt-v .horn.r{right:22%}
@keyframes bt-bob{50%{transform:translateY(-8px)}}
.bt-fx{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden}
.bt-num{position:absolute;font-family:var(--ko);font-size:34px;color:var(--y);text-shadow:3px 3px 0 var(--m),-1px -1px 0 #000;white-space:nowrap}
.bt-move{position:absolute;left:50%;top:10%;transform:translateX(-50%);font-size:clamp(28px,9vw,50px);color:#fff;text-shadow:4px 4px 0 var(--m),-2px -2px 0 #000;white-space:nowrap}
.bt-move small{display:block;text-align:center;font-size:16px;color:var(--y);text-shadow:2px 2px 0 #000}
.bt-combo{position:absolute;right:4%;top:28%;font-family:var(--px);font-size:16px;color:var(--c);text-shadow:3px 3px 0 #000;white-space:nowrap}
.bt-combo.over{color:var(--y);font-size:20px;text-shadow:3px 3px 0 var(--m)}
.bt-flash{position:absolute;inset:0;background:#fff;opacity:0}
.bt-big{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-family:var(--ko);font-size:clamp(48px,16vw,96px);line-height:1;color:var(--y);text-shadow:5px 5px 0 var(--m),-2px -2px 0 #000;white-space:nowrap}
.bt-steamer{position:absolute;width:44%;height:12%;border:4px solid #6b4423;border-radius:16px 16px 8px 8px;background:repeating-linear-gradient(90deg,#d9a066 0 8px,#c48a4f 8px 16px);box-shadow:inset 0 6px 0 #f0c48a}
.bt-steamer img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.bt-steamer.art{border:0;background:none;box-shadow:none}
.bt-puff{position:absolute;border-radius:50%;background:radial-gradient(#fff 0,#ffffffcc 40%,#fff0 70%)}
.bt-bag{position:absolute;bottom:26%;font-size:56px;line-height:1}.bt-bag img{width:80px;image-rendering:pixelated}
.bt-mini{position:absolute;font-size:34px;line-height:1}
.bt-pad{padding:8px 10px max(12px,env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:#12102a;z-index:3}
.bt-feel{position:relative;font-family:var(--ko);background:var(--y);color:#000;border:3px solid #000;box-shadow:4px 4px 0 #000;padding:7px 8px 6px;min-height:52px;text-align:left;cursor:pointer;touch-action:manipulation;display:grid;gap:2px;word-break:keep-all}
.bt-feel:nth-child(4n+2),.bt-feel:nth-child(4n+3){background:var(--c)}
.bt-feel b{font-size:19px;font-weight:400;line-height:1.1}
.bt-feel small{font-size:12px;opacity:.75}
.bt-feel em{position:absolute;right:6px;top:5px;font-style:normal;font-family:var(--px);font-size:10px}
.bt-feel:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #000}
.bt-feel:disabled{opacity:.45}
.bt-res{position:absolute;inset:0;z-index:8;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,#ffb46a 0,#ff7a8a 45%,#5b2a5e 100%);overflow:auto}
.bt-card{background:var(--panel);border:4px solid var(--fg);box-shadow:8px 8px 0 #07061a;padding:16px;width:min(420px,100%);display:grid;gap:10px;text-align:center;justify-items:center}
.bt-card h2{font-family:var(--ko);font-weight:400;font-size:clamp(40px,13vw,58px);color:var(--y);text-shadow:4px 4px 0 var(--m),-2px -2px 0 #000;line-height:1}
.bt-card .weapon{font-size:15px;color:var(--dim)}.bt-card .weapon b{display:block;font-size:26px;color:var(--y);font-weight:400;word-break:keep-all;line-height:1.25}
.bt-card .line{font-size:21px;line-height:1.3;word-break:keep-all}
.bt-card .quote{font-size:18px;color:var(--c);word-break:keep-all}
.bt-card .meta{font-size:14px;color:var(--dim);word-break:keep-all}
.bt-card .art{width:min(220px,60vw);image-rendering:pixelated}
.bt-card .inline{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.bt-card .taste{display:grid;justify-items:center;gap:2px}.bt-card .taste .px{color:var(--m)}
.bt-down{position:relative;height:100px;width:220px}
.bt-down .lie{position:absolute;left:50%;top:55%;line-height:0;transform:translate(-50%,-50%) rotate(-90deg) scaleY(1.12) scaleX(.8);animation:bt-breathe 2.4s ease-in-out infinite}
.bt-down .lie.sp{transform:translate(-50%,-50%);transform-origin:50% 100%;animation:bt-belly 2.4s ease-in-out infinite}
@keyframes bt-belly{50%{transform:translate(-50%,-50%) scaleY(1.05)}}
.bt-down .zz{position:absolute;right:0;top:0;font-size:18px;color:var(--m)}
@keyframes bt-breathe{50%{transform:translate(-50%,-50%) rotate(-90deg) scaleY(1.12) scaleX(.9)}}
.bt-steam{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bt-steam i{position:absolute;bottom:-60px;width:90px;height:90px;border-radius:50%;background:radial-gradient(#ffffffaa,#fff0 70%);animation:bt-rise 4s linear infinite}
@keyframes bt-rise{to{transform:translateY(-120vh) scale(2);opacity:0}}
.bt-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.bt-v .emo,.bt-down .lie,.bt-steam i,.bt-breathe{animation:none}.bt-hp i,.bt-hp u{transition:none}}
`;

/**
 * ctx = { div, target:{name}, stats:{vals,source,n}, axes:[{name,feel,word,move:{name,fx}}], damage?, emoji, koLine,
 *         player: {idle,bite,hit,ko:{src,w,h}} | null(만든 캐릭터 없음 → SVG), badge(등급 덧그림 HTML), avatar(happy)→svg(대체 그림),
 *         onKO({uses,presses}) → Promise<{saved, note}>, onDraft?(draft 1~5 ×6) }
 */
export async function openBattle(ctx) {
  await loadArt(ctx.div);
  if (!document.getElementById("battle-css")) document.head.insertAdjacentHTML("beforeend", `<style id="battle-css">${CSS}</style>`);
  document.getElementById("battle")?.remove();
  const dlg = document.createElement("dialog");
  dlg.id = "battle";
  dlg.setAttribute("aria-label", `${ctx.target.name} 행복 대결`);
  document.body.append(dlg);

  const moves = ctx.axes.map((a, i) => ({ name: a.move?.name || `${a.name} 필살기`, fx: a.move?.fx || FX[i % 6], axis: a.name, feel: a.feel || `${a.name} 최고!`, word: a.word || a.name }));
  const power = (i) => Math.max(0.3, Math.min(1, (+ctx.stats.vals[i] || 3) / 5)); // 가게 능력치 → 연출 크기만
  const src = ctx.stats.source === "official" ? "운영자 능력치 반영" : ctx.stats.source === "players" ? `평가 ${ctx.stats.n}명 반영` : "능력치 <b>확인 중</b>";
  let s = start(moves.length, ctx.damage || DMG), sfx = false, audio = null;

  dlg.innerHTML = `<div class="bt">
    <div class="bt-hud">
      <div class="bt-top"><div class="bt-vs"><b>VS</b>${esc(ctx.target.name)}</div>
        <div class="bt-x"><button class="btn ghost" type="button" data-sfx aria-pressed="false" aria-label="효과음 켜기">🔇</button><button class="btn ghost" type="button" data-close aria-label="대결 닫기">✕</button></div></div>
      <div class="bt-hp" role="meter" aria-label="정신줄(실은 행복이 차오르는 중)" aria-valuemin="0" aria-valuemax="${GAUGE_MAX}" aria-valuenow="${GAUGE_MAX}"><u></u><i></i><span><span>정신줄</span><b data-hp>${GAUGE_MAX}</b></span></div>
      <div class="bt-src">느낀 맛을 눌러요 · 같은 맛 또 누르면 더 세게 · ${src}</div>
    </div>
    <div class="bt-arena">
      <div class="bt-cam"><div class="bt-breathe">
        <div class="bt-p" data-p></div>
        <div class="bt-v" data-v><span class="horn l"></span><span class="horn r"></span><span class="emo">${esc(ctx.emoji)}</span></div>
      </div></div>
      <canvas></canvas><div class="bt-fx"></div>
    </div>
    <div class="bt-pad">${moves.map((m, i) => `<button class="bt-feel" type="button" data-f="${i}" aria-label="${esc(m.feel)} (${esc(m.name)})"><b>${esc(m.feel)}</b><small>${esc(m.name)}</small><em data-c="${i}"></em></button>`).join("")}</div>
    <div class="bt-live" aria-live="polite"></div>
  </div>`;
  const $ = (q) => dlg.querySelector(q);
  const arena = $(".bt-arena"), fx = $(".bt-fx"), cv = $("canvas"), P = $("[data-p]"), V = $("[data-v]"), cam = $(".bt-cam"), stage = $(".bt-breathe");
  const live = (t) => ($(".bt-live").textContent = t);

  /* ---- 캐릭터: 정수 배율로 크게(화면 높이 40% 안팎), 상황마다 표정 그림을 바꾼다 ---- */
  const PF = ctx.player, VF = art.villain && typeof art.villain === "object" ? art.villain : null;
  let kP = 1, kV = 1, poseP = "idle", poseV = "taunt";
  const pHTML = (pose) => (PF ? pix(PF[pose], kP) + (ctx.badge || "") : ctx.avatar(pose !== "idle")); // badge: 등급 띠·왕관 덧그림
  const setP = (pose) => { poseP = pose; P.innerHTML = pHTML(pose); };
  const setV = (pose) => { poseV = pose; if (VF) V.innerHTML = pix({ ...VF[pose], src: BASE + "battle/" + VF[pose].src }, kV); };
  V.classList.toggle("flip", art.facing === "right"); // 빌런은 늘 왼쪽(플레이어 쪽)을 본다. manifest facing 이 right 면 뒤집는다
  const fit = () => {
    const tall = arena.clientHeight * 0.56, hmax = (F) => Math.max(...Object.values(F).map((f) => f.h));
    if (PF) kP = Math.max(1, Math.floor(tall / hmax(PF)));
    if (VF) kV = Math.max(1, Math.floor(tall / hmax(VF)));
    setP(poseP); setV(poseV);
  };

  /* ---- 카메라: (x,y) 지점을 무대 가운데 위쪽으로. 움직임 줄이기면 즉시 컷 ---- */
  const go = (tf, ms, easing = "ease-out") => {
    const from = getComputedStyle(cam).transform;
    cam.getAnimations().forEach((a) => a.cancel());
    cam.style.transform = tf;
    return reduce() || !ms ? Promise.resolve() : cam.animate([{ transform: from === "none" ? "translate(0px,0px) scale(1)" : from }, { transform: tf }], { duration: ms, easing }).finished.catch(() => {});
  };
  const camAt = (x, y, sc, ms, easing) => go(`translate(${arena.clientWidth / 2 - x * sc}px,${arena.clientHeight * 0.42 - y * sc}px) scale(${sc})`, ms, easing);
  const camTo = (el, fy, sc, ms, easing) => camAt(el.offsetLeft + el.offsetWidth / 2, el.offsetTop + el.offsetHeight * fy, sc, ms, easing);
  const camReset = (ms) => go("translate(0px,0px) scale(1)", ms);
  let seq = 0;

  const close = () => { dlg.close(); dlg.remove(); };
  $("[data-close]").onclick = close;
  dlg.addEventListener("close", () => dlg.remove());
  $("[data-sfx]").onclick = (e) => { sfx = !sfx; e.currentTarget.textContent = sfx ? "🔊" : "🔇"; e.currentTarget.setAttribute("aria-pressed", sfx); e.currentTarget.setAttribute("aria-label", sfx ? "효과음 끄기" : "효과음 켜기"); };
  const beep = (f, d = 0.08, t = 0) => {
    if (!sfx) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "square"; o.frequency.value = f; g.gain.value = 0.06;
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + d);
    } catch {}
  };

  /* ---- 파티클(Canvas) ---- */
  const parts = [];
  let raf = 0;
  const tick = () => {
    const r = cv.getBoundingClientRect(), k = devicePixelRatio || 1;
    if (cv.width !== r.width * k) { cv.width = r.width * k; cv.height = r.height * k; }
    const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, r.width, r.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g ?? 0.35; p.life--;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.life / 20); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * 1.4);
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  };
  const burst = (x, y, n, colors, o = {}) => {
    for (let i = 0; i < n; i++) {
      const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 2.6 : Math.random() * Math.PI * 2, v = (o.v || 3) + Math.random() * (o.spread || 7);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ? 0 : 4), g: o.g, s: 4 + Math.random() * 5, life: 40 + Math.random() * 25, c: colors[i % colors.length] });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };

  /* ---- 연출 조각 ---- */
  const add = (html, cls, style = "") => { const el = document.createElement("div"); el.className = cls; el.style.cssText = style; el.innerHTML = html; fx.append(el); return el; };
  const anim = (el, kf, o) => el.animate(kf, typeof o === "number" ? { duration: o, easing: "ease-out", fill: "forwards" } : { fill: "forwards", easing: "ease-out", ...o });
  const gone = (el, ms) => setTimeout(() => el.remove(), ms);
  const shake = (px = 6, ms = 260) => { if (!reduce()) anim(arena, [0, 1, 2, 3, 4].map((i) => ({ transform: i === 4 ? "none" : `translate(${(i % 2 ? -1 : 1) * px}px,${(i % 3 ? 1 : -1) * px * 0.6}px)` })), { duration: ms, easing: "steps(5)", fill: "none" }); };
  const flash = (o = 0.85) => { if (reduce()) return; const f = add("", "bt-flash"); anim(f, [{ opacity: o }, { opacity: 0 }], 160); gone(f, 200); };
  const hitStop = async (ms = 80) => { if (reduce()) return; const a = arena.getAnimations({ subtree: true }); a.forEach((x) => x.pause()); await sleep(ms); a.forEach((x) => x.play()); };
  const pCenter = () => { const a = arena.getBoundingClientRect(), b = P.getBoundingClientRect(); return [b.left - a.left + b.width / 2, b.top - a.top + b.height * 0.35]; };
  const flinch = (dx = -14) => anim(P, [{ transform: "none" }, { transform: `translateX(${dx}px) rotate(-6deg)` }, { transform: "none" }], { duration: 240, fill: "none" });
  const number = (txt, x, y, scale = 1, color = "") => {
    const el = add(esc(txt), "bt-num", `left:${x}px;top:${y}px;font-size:${Math.round(34 * scale)}px${color ? ";color:" + color : ""}`);
    anim(el, reduce() ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }] : [{ transform: "translate(-50%,0) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-30px) scale(1.25)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-70px) scale(1)", opacity: 0 }], 1000);
    gone(el, 1050);
  };

  const FXS = {
    async drops(g, pw) { const [x, y] = [arena.clientWidth / 2, arena.clientHeight * 0.45]; if (!reduce()) burst(x, y, Math.round(20 + 40 * pw), ["#ffd23f", "#ffe98a", "#ffb000", "#fff6c2"]); shake(3 + 4 * pw); },
    async combo(g) {
      const [px, py] = pCenter(), vx = arena.clientWidth * 0.78, vy = arena.clientHeight * 0.5;
      for (let i = 0; i < 3; i++) {
        const m = add(img("dumpling", "", esc(ctx.emoji)), "bt-mini", `left:${vx}px;top:${vy}px`);
        if (!reduce()) anim(m, [{ transform: "none" }, { transform: `translate(${px - vx}px,${py - vy - 20 + i * 14}px) rotate(-200deg)`, opacity: 1 }, { transform: `translate(${px - vx}px,${py - vy}px) scale(.2)`, opacity: 0 }], { duration: 320, delay: i * 110 });
        gone(m, 460 + i * 110);
        setTimeout(() => { flinch(-8); beep(660 + i * 120, 0.05); }, 300 + i * 110);
      }
    },
    async counter(g, pw) {
      const t = add("COUNTER!", "bt-big", "color:var(--c)");
      if (!reduce()) { anim(arena, [{ filter: "none" }, { filter: "saturate(.3) contrast(1.3)" }, { filter: "none" }], { duration: 700, fill: "none" }); anim(t, [{ transform: "translate(-50%,-50%) skewX(-12deg) scale(3)", opacity: 0 }, { transform: "translate(-50%,-50%) skewX(-12deg) scale(1)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) skewX(-12deg) scale(1)", opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1100, easing: "cubic-bezier(.2,.8,.2,1)" }); anim(V, [{ transform: "none" }, { transform: "translateX(-40px) scale(1.15)" }, { transform: "none" }], { duration: 700, fill: "none" }); }
      else anim(t, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 900);
      gone(t, 1150); await sleep(reduce() ? 0 : 420); shake(4 + 6 * pw);
    },
    async stack(g, pw) {
      const n = Math.round(3 + 3 * pw), H = arena.clientHeight;
      for (let i = 0; i < n; i++) {
        const st = add(img("steamer", "", ""), "bt-steamer" + (art?.steamer ? " art" : ""), `left:${(i % 2 ? 8 : 48) + (i * 7) % 10}%;bottom:${i * 11}%`);
        anim(st, reduce() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: `translateY(-${H}px)` }, { transform: "translateY(6px)", offset: 0.8 }, { transform: "none" }], { duration: 260, delay: i * 90 });
        setTimeout(() => { shake(3, 120); beep(220 - i * 20, 0.05); }, 250 + i * 90);
        setTimeout(() => anim(st, [{ opacity: 1 }, { opacity: 0 }], 400), 1300);
        gone(st, 1750);
      }
    },
    async steam(g, pw) {
      for (let i = 0; i < Math.round(5 + 6 * pw); i++) {
        const sz = 90 + Math.random() * 120, el = add("", "bt-puff", `left:${Math.random() * 90 - 10}%;top:${30 + Math.random() * 60}%;width:${sz}px;height:${sz}px`);
        anim(el, [{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.6) translateY(-30px)", opacity: 0.95, offset: 0.4 }, { transform: "scale(2.2) translateY(-80px)", opacity: 0 }], { duration: 1500, delay: i * 50 });
        gone(el, 1700);
      }
      arena.classList.add("warm"); setTimeout(() => !s.ko && arena.classList.remove("warm"), 1600);
    },
    async bag() {
      const b = add(img("bag", "", "🛍️"), "bt-bag", "right:-20%");
      const w = arena.clientWidth;
      if (!reduce()) {
        anim(b, [{ transform: "none" }, { transform: `translateX(-${w * 0.75}px) rotate(-360deg)` }, { transform: `translateX(-${w * 1.2}px) rotate(-540deg)`, opacity: 0 }], { duration: 800, easing: "linear" });
        setTimeout(() => !s.ko && anim(P, [{ transform: "none" }, { transform: "rotate(-70deg) translateY(10px)" }, { transform: "rotate(-70deg) translateY(10px)", offset: 0.6 }, { transform: "none" }], { duration: 700, fill: "none" }), 420);
        setTimeout(() => shake(6), 520);
      } else anim(b, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 800);
      gone(b, 850);
    },
  };

  const setHP = () => {
    const v = hp(s), bar = $(".bt-hp");
    bar.querySelector("i").style.width = v + "%";
    bar.querySelector("u").style.width = v + "%"; // 흰 잔상이 조금 늦게 따라 줄어든다
    bar.classList.toggle("low", v <= 34);
    bar.setAttribute("aria-valuenow", v);
    $("[data-hp]").textContent = v;
    dlg.querySelectorAll("[data-c]").forEach((el) => (el.textContent = s.uses[+el.dataset.c] ? "×" + s.uses[+el.dataset.c] : ""));
  };

  async function feel(i) {
    if (s.ko) return;
    const now = performance.now(), fast = now - lastTap < 700, my = ++seq;
    lastTap = now;
    s = press(s, i);
    const st = s, m = moves[i], pw = power(i);
    if (st.ko) dlg.querySelectorAll("[data-f]").forEach((b) => (b.disabled = true));
    live(`${m.feel} → ${m.name}! 행복 +${Math.round(st.gain)}. 정신줄 ${hp(st)}`);
    // ① 빌런 얼굴로 줌인(필살기 기합). 연타 중엔 건너뛴다
    setV("special");
    if (!fast) { await camTo(V, 0.45, 1.8, 150); await sleep(reduce() ? 260 : 170); }
    // ② 타격: 플레이어 쪽으로 팬 + 히트 스톱, 한 입 먹고 황홀한 얼굴
    navigator.vibrate?.(st.ko ? [40, 60, 160] : st.mult >= 2 ? [30, 40, 30] : 30);
    beep(440 + st.k * 90);
    setP("bite");
    camTo(P, 0.24, 1.5, fast ? 90 : 120);
    flash();
    await hitStop(st.ko ? 150 : 80);
    fx.querySelectorAll(".bt-move,.bt-combo").forEach((el) => el.remove()); // 연타해도 이름은 하나만
    const banner = add(`${esc(m.name)}!<small>“${esc(m.feel)}”</small>`, "bt-move");
    anim(banner, reduce() ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }] : [{ transform: "translateX(40%) skewX(-10deg)", opacity: 0 }, { transform: "translateX(-50%) skewX(-10deg)", opacity: 1, offset: 0.2 }, { transform: "translateX(-50%) skewX(-10deg)", opacity: 1, offset: 0.75 }, { transform: "translateX(-120%) skewX(-10deg)", opacity: 0 }], 1100);
    gone(banner, 1150);
    if (st.k >= 2) { // 같은 맛을 또 → 추가 데미지
      const c = add(`×${st.mult} ${st.mult >= 3 ? "MAX!" : st.mult >= 2 ? "OVERFLOW!" : "COMBO!"}`, "bt-combo" + (st.mult >= 2 ? " over" : ""));
      anim(c, [{ transform: `scale(${1.4 + st.mult * 0.3})` }, { transform: `scale(${0.9 + st.mult * 0.15})`, offset: 0.2 }, { opacity: 0 }], 1000); gone(c, 1050);
      if (st.mult >= 2) setTimeout(() => flash(0.5), 120);
    }
    if (!st.ko) FXS[m.fx]?.(st.gain, pw);
    flinch();
    const [x, y] = pCenter();
    number(`행복 +${Math.round(st.gain)}`, x + 24, y - 30, 1 + 0.25 * (st.mult - 1), st.mult >= 2 ? "#fff6c2" : "");
    setHP();
    if (st.ko) return ko(st);
    // ③ 놀라면서도 웃는 얼굴 → 줌아웃해서 둘 다
    await sleep(240); if (my !== seq) return;
    setP(st.mult >= 2 ? "hit" : "bliss"); camReset(320); // 씹으며 감동, 추가 데미지면 놀라며 웃음
    await sleep(520); if (my !== seq) return;
    setP("idle"); setV("idle");
  }
  let lastTap = -1e9;

  /* ---- 행복 K.O.: 슬로우모션으로 뒤로 날아가 쿵 → 배 불룩 늘어짐 ---- */
  async function ko(st) {
    seq++;
    fx.querySelectorAll(".bt-combo").forEach((el) => el.remove());
    setV("win"); // 승리의 미소
    const W = arena.clientWidth, H = arena.clientHeight, dx = -Math.min(W * 0.34, 150), up = H * 0.26, T = 1600;
    const frameAll = (ms) => { // 누운 플레이어와 빌런이 다 보이게
      const minX = P.offsetLeft + dx, maxX = V.offsetLeft + V.offsetWidth, sc = Math.min(1, (W - 16) / (maxX - minX));
      return go(`translate(${8 - minX * sc}px,${H * 0.91 * (1 - sc)}px) scale(${sc})`, ms);
    };
    if (reduce()) { // 컷: 타격 → 누운 모습 → 문구
      P.style.transform = `translateX(${dx}px)`; setP("down"); frameAll(0);
      return landed(st);
    }
    // 흑백·슬로우 들어가며 얼굴로 줌인
    const gray = arena.animate([{ filter: "none" }, { filter: "saturate(.25) contrast(1.15)" }], { duration: 260, fill: "forwards" });
    setP("knock"); // 넉백: 뒤로 젖혀지며 웃음
    await camTo(P, 0.24, 1.9, 320);
    setP("fly"); // 날아감(전용 프레임이 없는 예전 2x2는 맞음 프레임을 더 돌린다)
    const spin = PF && PF.fly.src !== PF.hit.src ? 24 : 62;
    // 포물선(0.25배속 느낌), 살짝 회전, 반투명 잔상 3개, 카메라가 따라감
    const kf = Array.from({ length: 11 }, (_, j) => { const t = j / 10; return { transform: `translate(${dx * t}px,${-up * 4 * t * (1 - t)}px) rotate(${-8 - spin * t}deg)` }; });
    const ghosts = [0.42, 0.26, 0.14].map((o, j) => {
      const g = document.createElement("div"); g.className = "bt-ghost"; g.style.opacity = o; g.innerHTML = P.innerHTML; stage.append(g);
      g.animate(kf, { duration: T, delay: 90 * (j + 1), easing: "linear", fill: "both" });
      return g;
    });
    const fly = P.animate(kf, { duration: T, easing: "linear", fill: "forwards" });
    camAt(P.offsetLeft + P.offsetWidth / 2 + dx, P.offsetTop + P.offsetHeight * 0.3 - up * 0.5, 1.45, T, "ease-in-out");
    beep(330, 0.4);
    await sleep(T);
    // 착지: 원래 속도, 먼지·김, 흔들림
    gray.cancel(); ghosts.forEach((g) => g.remove()); fly.cancel();
    P.style.transform = `translateX(${dx}px)`;
    setP("land"); // 쿵
    const a = arena.getBoundingClientRect(), b = P.getBoundingClientRect();
    burst(b.left - a.left + b.width / 2, b.bottom - a.top - 6, 34, ["#ffffff", "#e9e3cc", "#cfc6e6", "#fff6c2"], { up: true, v: 2, spread: 5, g: 0.12 });
    shake(12, 420); beep(110, 0.25);
    navigator.vibrate?.(140);
    frameAll(700); // 줌아웃해 전체
    await sleep(250);
    landed(st);
  }

  async function landed(st) {
    if (PF) { setTimeout(() => setP("down"), reduce() ? 0 : 450); setTimeout(() => setP("melt"), reduce() ? 700 : 1300); } // 다운(배 불룩) → 늘어짐
    beep(523, 0.12); beep(659, 0.12, 0.13); beep(784, 0.3, 0.26);
    arena.classList.add("warm");
    arena.insertAdjacentHTML("beforeend", `<div class="bt-steam">${Array.from({ length: 8 }, (_, i) => `<i style="left:${i * 13}%;animation-delay:${i * 0.45}s"></i>`).join("")}</div>`);
    const t = add("행복<br>K.O.", "bt-big", "text-align:center");
    anim(t, reduce() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translate(-50%,-50%) scale(5)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.9)", opacity: 1, offset: 0.5 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], 700);
    if (!reduce() && !PF) anim(P, [{ transform: P.style.transform || "none" }, { transform: `${P.style.transform || ""} translateY(30px) rotate(-82deg) scaleY(.72) scaleX(1.25)` }], { duration: 900, easing: "cubic-bezier(.5,0,.6,1.4)" });
    if (st.overkill >= 0.5) setTimeout(() => number(`오버킬 행복 +${Math.round(st.overkill)}`, arena.clientWidth / 2, arena.clientHeight * 0.6, 1.15, "#fff6c2"), reduce() ? 900 : 500);
    live(`행복 K.O. ${st.presses}입 만에 쓰러졌어요`);
    const save = ctx.onKO({ uses: st.uses, presses: st.presses }).catch(() => ({ saved: false, note: "기록 저장에 실패했어요. 잠시 후 다시 해 봐요" }));
    await sleep(reduce() ? 1200 : 2000);
    result(st, save);
  }

  function result(st, save) {
    const tops = topMoves(st.uses), draft = tasteDraft(st.uses), max = Math.max(...st.uses);
    const res = document.createElement("div");
    res.className = "bt-res";
    res.innerHTML = `<div class="bt-steam">${Array.from({ length: 8 }, (_, i) => `<i style="left:${i * 13}%;animation-delay:${i * 0.5}s"></i>`).join("")}</div>
      <div class="bt-card"><span class="tape">RESULT · 행복 KO 패배</span>
        <div class="bt-down">${PF ? `<div class="lie sp">${pix(PF.melt, 1)}</div>` : `<div class="lie">${ctx.avatar(true)}</div>`}<span class="zz">♥ 배불러…</span></div>
        <h2>행복 K.O.</h2>
        <div class="weapon">이 집의 필살 무기<b>${tops.map((t) => `${esc(moves[t.i].name)}(${t.count > 1 ? t.count + "연타" : "1번"})`).join(" · ")}</b></div>
        <div class="line">${esc(weaponLine(ctx.target.name, tops.map((t) => moves[t.i].word), st.presses))}</div>
        <div class="taste"><span class="px">오늘 나를 쓰러뜨린 맛</span>${miniHex(st.uses.map((c) => (max ? (5 * c) / max : 0)), moves.map((m) => m.axis))}</div>
        <div class="quote">“${esc(ctx.koLine)}”</div>
        <div class="meta" data-note>기록하는 중…</div>
        <div class="inline">${draft && ctx.onDraft ? `<button class="btn sec" type="button" data-draft>📝 이 맛으로 내 6각 평가 초안</button>` : ""}<button class="btn" type="button" data-again>🥢 한 판 더</button><button class="btn ghost" type="button" data-done>닫기</button></div>
        <div class="meta">평가 초안은 내가 확인하고 저장을 눌러야 올라가요. 지는 게 최고의 찬사예요</div>
      </div>`;
    $(".bt").append(res);
    anim(res, [{ opacity: 0 }, { opacity: 1 }], 400);
    res.querySelector("[data-done]").onclick = close;
    res.querySelector("[data-again]").onclick = () => openBattle(ctx);
    const d = res.querySelector("[data-draft]");
    if (d) d.onclick = () => { close(); ctx.onDraft(draft); };
    res.querySelector("[data-done]").focus();
    save.then((r) => { const n = res.querySelector("[data-note]"); if (n) n.textContent = r?.note || ""; });
  }

  $(".bt-pad").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b && !b.disabled) feel(+b.dataset.f); });
  dlg.addEventListener("keydown", (e) => { const n = +e.key; if (n >= 1 && n <= moves.length && !s.ko) { e.preventDefault(); feel(n - 1); } }); // 키보드 1~6
  addEventListener("resize", fit);
  dlg.addEventListener("close", () => removeEventListener("resize", fit));
  dlg.showModal();
  if (VF) V.replaceChildren();
  fit();
  setHP();
  setTimeout(() => { if (!s.presses) setV("idle"); }, 1600); // 도발하다가 대기
  $("[data-f]").focus();
}
