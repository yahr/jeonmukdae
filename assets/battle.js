// 행복한 빌런 대결 화면(요청서 3-8, 3-8-1). index.html이 버튼을 누를 때 import()로 불러온다.
// 한 입 = 필살기 한 방. 행복 게이지가 꽉 차면 행복 K.O.(지는 게 최고의 찬사)
// ponytail: 효과는 DOM + Web Animations, 파티클만 Canvas. 그림 에셋은 assets/battle/manifest.json에 있으면 쓰고 없으면 이모지·CSS로.
// 카메라: 무대(.bt-cam)에 transform(translate+scale)을 걸어 얼굴로 줌인·팬. 게이지·버튼은 무대 밖이라 흔들리지 않는다.
import { GAUGE_MAX, start, bite, koLine } from "./battle-core.js";

const BASE = new URL("./", import.meta.url).href;
const FX = ["drops", "combo", "counter", "stack", "steam", "bag"];
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let manifest = null, art = {}; // art: 이 부문 그림 {villain:{idle,taunt,special,win}, dumpling, steamer, bag, ko}
const loadArt = async (div) => { manifest ??= await fetch(BASE + "battle/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})); art = manifest[div] || {}; };
const img = (k, cls = "", fallback = "") => (typeof art?.[k] === "string" ? `<img class="${cls}" src="${BASE}battle/${esc(art[k])}" alt="" draggable="false">` : fallback);

const pix = (f, k) => `<img class="pix" src="${esc(f.src)}" width="${f.w * k}" height="${f.h * k}" alt="" draggable="false">`;

const CSS = `
#battle{padding:0;border:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;background:#12102a;color:var(--fg);overflow:hidden;box-shadow:none}
#battle::backdrop{background:#07061a}
.bt{position:relative;height:100%;display:grid;grid-template-rows:auto 1fr auto;font-family:var(--ko);user-select:none;-webkit-user-select:none}
.bt-hud{padding:max(12px,env(safe-area-inset-top,0px)) 14px 8px;display:grid;gap:8px;background:#12102a;z-index:3}
.bt-top{display:flex;gap:8px;align-items:center;justify-content:space-between}
.bt-vs{font-size:20px;min-width:0;overflow-wrap:anywhere;line-height:1.2}.bt-vs b{color:var(--m);font-family:var(--px);font-size:12px;margin-right:6px}
.bt-x{flex:none;display:flex;gap:6px}.bt-x .btn{padding:6px 10px;font-size:16px}
.bt-gauge{position:relative;height:22px;border:3px solid var(--fg);background:#07061a}
.bt-gauge i{position:absolute;inset:0;width:0;background:repeating-linear-gradient(90deg,var(--m) 0 10px,#ff7cbf 10px 20px);transition:width .25s steps(6)}
.bt-gauge.full i{background:repeating-linear-gradient(90deg,var(--y) 0 10px,#fff2a8 10px 20px)}
.bt-gauge>span{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-family:var(--px);font-size:10px;color:#fff;text-shadow:2px 2px 0 #000}
.bt-src{font-size:14px;color:var(--dim)}.bt-src b{color:var(--y);font-weight:400}
.bt-arena{position:relative;overflow:hidden;background:linear-gradient(#1d1a3f 0 84%,#2a2350 84% 85.5%,#262253 85.5%);transition:background 1.2s}
.bt-arena.warm{background:linear-gradient(#ff9f43 0,#ff6f91 84%,#c94f7c 84% 85.5%,#7a3b6b 85.5%)}
.bt-cam{position:absolute;inset:0;transform-origin:0 0;z-index:2}
.bt-breathe{position:absolute;inset:0;transform-origin:50% 92%;animation:bt-breath 3.2s ease-in-out infinite}
@keyframes bt-breath{50%{transform:scale(1.015)}}
.pix{image-rendering:pixelated;display:block;max-width:none}
.bt-arena canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.bt-p{position:absolute;left:2%;bottom:9%;z-index:2;line-height:0;transform-origin:50% 100%}
.bt-p svg{width:min(40vw,190px);height:auto}
.bt-v{position:absolute;right:2%;bottom:9%;z-index:1;line-height:0;text-align:center;transform-origin:50% 100%}
.bt-v .emo{font-size:min(32vw,140px);line-height:1;display:block;filter:drop-shadow(6px 6px 0 #07061a)}
.bt-v .horn{position:absolute;top:-6px;width:0;height:0;border:10px solid transparent;border-bottom:18px solid var(--m)}
.bt-v .horn.l{left:22%}.bt-v .horn.r{right:22%}
.bt-v .emo{animation:bt-bob 1.6s steps(4) infinite}
@keyframes bt-bob{50%{transform:translateY(-8px)}}
.bt-fx{position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden}
.bt-num{position:absolute;font-family:var(--ko);font-size:34px;color:var(--y);text-shadow:3px 3px 0 var(--m),-1px -1px 0 #000;white-space:nowrap}
.bt-move{position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:clamp(30px,10vw,52px);color:#fff;text-shadow:4px 4px 0 var(--m),-2px -2px 0 #000;white-space:nowrap}
.bt-move small{display:block;text-align:center;font-size:16px;color:var(--y);text-shadow:2px 2px 0 #000}
.bt-combo{position:absolute;right:4%;top:6%;font-family:var(--px);font-size:14px;color:var(--c);text-shadow:2px 2px 0 #000}
.bt-flash{position:absolute;inset:0;background:#fff;opacity:0}
.bt-big{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);font-family:var(--ko);font-size:clamp(48px,16vw,96px);line-height:1;color:var(--y);text-shadow:5px 5px 0 var(--m),-2px -2px 0 #000;white-space:nowrap}
.bt-steamer{position:absolute;width:44%;height:12%;border:4px solid #6b4423;border-radius:16px 16px 8px 8px;background:repeating-linear-gradient(90deg,#d9a066 0 8px,#c48a4f 8px 16px);box-shadow:inset 0 6px 0 #f0c48a}
.bt-steamer img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}
.bt-steamer.art{border:0;background:none;box-shadow:none}
.bt-puff{position:absolute;border-radius:50%;background:radial-gradient(#fff 0,#ffffffcc 40%,#fff0 70%)}
.bt-bag{position:absolute;bottom:26%;font-size:56px;line-height:1}.bt-bag img{width:80px;image-rendering:pixelated}
.bt-mini{position:absolute;font-size:34px;line-height:1}
.bt-pad{padding:10px 14px max(14px,env(safe-area-inset-bottom,0px));display:grid;gap:10px;background:#12102a;z-index:3}
.bt-moves{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.bt-moves span{flex:none;font-size:14px;border:2px solid var(--dim);padding:3px 7px;color:var(--dim)}
.bt-moves span.on{border-color:var(--y);color:var(--y)}
.bt-moves span em{font-style:normal;font-family:var(--px);font-size:9px;margin-left:4px}
.bt-eat{font-size:26px;padding:16px;width:100%;touch-action:manipulation}
.bt-res{position:absolute;inset:0;z-index:8;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 50% 30%,#ffb46a 0,#ff7a8a 45%,#5b2a5e 100%);overflow:auto}
.bt-card{background:var(--panel);border:4px solid var(--fg);box-shadow:8px 8px 0 #07061a;padding:18px;width:min(420px,100%);display:grid;gap:12px;text-align:center;justify-items:center}
.bt-card h2{font-family:var(--ko);font-weight:400;font-size:clamp(40px,13vw,60px);color:var(--y);text-shadow:4px 4px 0 var(--m),-2px -2px 0 #000;line-height:1}
.bt-card .line{font-size:24px;line-height:1.3;word-break:keep-all}
.bt-card .quote{font-size:20px;color:var(--c);word-break:keep-all}
.bt-card .meta{font-size:15px;color:var(--dim);word-break:keep-all}
.bt-card .art{width:min(220px,60vw);image-rendering:pixelated}
.bt-card .inline{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.bt-down{position:relative;height:120px;width:220px}
.bt-down .lie{position:absolute;left:50%;top:55%;line-height:0;transform:translate(-50%,-50%) rotate(-90deg) scaleY(1.12) scaleX(.8);animation:bt-breathe 2.4s ease-in-out infinite}
.bt-down .lie.sp{transform:translate(-50%,-50%);transform-origin:50% 100%;animation:bt-belly 2.4s ease-in-out infinite}
@keyframes bt-belly{50%{transform:translate(-50%,-50%) scaleY(1.05)}}
.bt-down .zz{position:absolute;right:0;top:0;font-size:18px;color:var(--m)}
@keyframes bt-breathe{50%{transform:translate(-50%,-50%) rotate(-90deg) scaleY(1.12) scaleX(.9)}}
.bt-steam{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bt-steam i{position:absolute;bottom:-60px;width:90px;height:90px;border-radius:50%;background:radial-gradient(#ffffffaa,#fff0 70%);animation:bt-rise 4s linear infinite}
@keyframes bt-rise{to{transform:translateY(-120vh) scale(2);opacity:0}}
.bt-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media (prefers-reduced-motion:reduce){.bt-v .emo,.bt-down .lie,.bt-steam i,.bt-breathe{animation:none}.bt-gauge i{transition:none}}
`;

/**
 * ctx = { div, target:{name}, stats:{vals,source,n}, axes:[{name,move?:{name,fx}}], emoji, koLine,
 *         player: {idle,bite,hit,ko:{src,w,h}} | null(고화질 그림 없음), avatar(happy)→svg(대체 그림),
 *         onKO({bites,maxCombo}) → Promise<{saved, note}> }
 */
export async function openBattle(ctx) {
  await loadArt(ctx.div);
  if (!document.getElementById("battle-css")) document.head.insertAdjacentHTML("beforeend", `<style id="battle-css">${CSS}</style>`);
  document.getElementById("battle")?.remove();
  const dlg = document.createElement("dialog");
  dlg.id = "battle";
  dlg.setAttribute("aria-label", `${ctx.target.name} 행복 대결`);
  document.body.append(dlg);

  const moves = ctx.axes.map((a, i) => ({ name: a.move?.name || `${a.name} 필살기`, fx: a.move?.fx || FX[i % 6], axis: a.name }));
  const src = ctx.stats.source === "official" ? "운영자 실측 능력치" : ctx.stats.source === "players" ? `플레이어 평가 ${ctx.stats.n}명 평균` : "능력치 <b>확인 중</b> · 모두 기본값 3으로 붙어요";
  let s = start(ctx.stats.vals), maxCombo = 0, sfx = false, audio = null;

  dlg.innerHTML = `<div class="bt">
    <div class="bt-hud">
      <div class="bt-top"><div class="bt-vs"><b>VS</b>${esc(ctx.target.name)}</div>
        <div class="bt-x"><button class="btn ghost" type="button" data-sfx aria-pressed="false" aria-label="효과음 켜기">🔇</button><button class="btn ghost" type="button" data-close aria-label="대결 닫기">✕</button></div></div>
      <div class="bt-gauge" role="progressbar" aria-label="행복 게이지" aria-valuemin="0" aria-valuemax="${GAUGE_MAX}" aria-valuenow="0"><i></i><span><span>HAPPY</span><span data-hp>0</span></span></div>
      <div class="bt-src">${src}</div>
    </div>
    <div class="bt-arena">
      <div class="bt-cam"><div class="bt-breathe">
        <div class="bt-p" data-p></div>
        <div class="bt-v" data-v><span class="horn l"></span><span class="horn r"></span><span class="emo">${esc(ctx.emoji)}</span></div>
      </div></div>
      <canvas></canvas><div class="bt-fx"></div>
    </div>
    <div class="bt-pad">
      <div class="bt-moves">${s.order.map((i) => `<span data-m="${i}">${esc(moves[i].name)}<em>${(+ctx.stats.vals[i]).toFixed(1)}</em></span>`).join("")}</div>
      <button class="btn bt-eat" type="button" data-eat>🥢 한 입 먹기</button>
    </div>
    <div class="bt-live" aria-live="polite"></div>
  </div>`;
  const $ = (q) => dlg.querySelector(q);
  const arena = $(".bt-arena"), fx = $(".bt-fx"), cv = $("canvas"), P = $("[data-p]"), V = $("[data-v]");
  const live = (t) => ($(".bt-live").textContent = t);
  const cam = $(".bt-cam");

  /* ---- 캐릭터: 정수 배율로 크게(화면 높이 40% 안팎), 상황마다 표정 그림을 바꾼다 ---- */
  const PF = ctx.player, VF = art.villain && typeof art.villain === "object" ? art.villain : null;
  let kP = 1, kV = 1, poseP = "idle", poseV = "taunt";
  const setP = (pose) => { poseP = pose; P.innerHTML = PF ? pix(PF[pose], kP) : ctx.avatar(pose !== "idle"); };
  const setV = (pose) => { poseV = pose; if (VF) V.innerHTML = pix({ ...VF[pose], src: BASE + "battle/" + VF[pose].src }, kV); };
  const fit = () => {
    const tall = arena.clientHeight * 0.42, hmax = (F) => Math.max(...Object.values(F).map((f) => f.h));
    if (PF) kP = Math.max(1, Math.floor(tall / hmax(PF)));
    if (VF) kV = Math.max(1, Math.floor(tall / hmax(VF)));
    setP(poseP); setV(poseV);
  };

  /* ---- 카메라: 얼굴(fy = 그림 높이 중 얼굴 위치)을 무대 가운데 위쪽으로. 움직임 줄이기면 즉시 컷 ---- */
  const go = (tf, ms, easing = "ease-out") => {
    const from = getComputedStyle(cam).transform;
    cam.getAnimations().forEach((a) => a.cancel());
    cam.style.transform = tf;
    return reduce() || !ms ? Promise.resolve() : cam.animate([{ transform: from === "none" ? "translate(0px,0px) scale(1)" : from }, { transform: tf }], { duration: ms, easing }).finished.catch(() => {});
  };
  const camTo = (el, fy, sc, ms, easing) => {
    const fx0 = el.offsetLeft + el.offsetWidth / 2, fy0 = el.offsetTop + el.offsetHeight * fy;
    return go(`translate(${arena.clientWidth / 2 - fx0 * sc}px,${arena.clientHeight * 0.42 - fy0 * sc}px) scale(${sc})`, ms, easing);
  };
  const camReset = (ms) => go("translate(0px,0px) scale(1)", ms);
  let seq = 0;
  const nextMove = () => dlg.querySelectorAll("[data-m]").forEach((el) => el.classList.toggle("on", +el.dataset.m === s.order[s.bites % 6]));
  nextMove();

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
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life--;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      g.globalAlpha = Math.min(1, p.life / 20); g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * 1.4);
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  };
  const burst = (x, y, n, colors) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, s: 4 + Math.random() * 5, life: 40 + Math.random() * 25, c: colors[i % colors.length] }); }
    if (!raf) raf = requestAnimationFrame(tick);
  };

  /* ---- 연출 조각 ---- */
  const add = (html, cls, style = "") => { const el = document.createElement("div"); el.className = cls; el.style.cssText = style; el.innerHTML = html; fx.append(el); return el; };
  const anim = (el, kf, o) => el.animate(kf, typeof o === "number" ? { duration: o, easing: "ease-out", fill: "forwards" } : { fill: "forwards", easing: "ease-out", ...o });
  const gone = (el, ms) => setTimeout(() => el.remove(), ms);
  const shake = (px = 6, ms = 260) => { if (!reduce()) anim(arena, [0, 1, 2, 3, 4].map((i) => ({ transform: i === 4 ? "none" : `translate(${(i % 2 ? -1 : 1) * px}px,${(i % 3 ? 1 : -1) * px * 0.6}px)` })), { duration: ms, easing: "steps(5)", fill: "none" }); };
  const flash = () => { if (reduce()) return; const f = add("", "bt-flash"); anim(f, [{ opacity: 0.85 }, { opacity: 0 }], 160); gone(f, 200); };
  const hitStop = async (ms = 80) => { if (reduce()) return; const a = arena.getAnimations({ subtree: true }); a.forEach((x) => x.pause()); await sleep(ms); a.forEach((x) => x.play()); };
  const pCenter = () => { const a = arena.getBoundingClientRect(), b = P.getBoundingClientRect(); return [b.left - a.left + b.width / 2, b.top - a.top + b.height * 0.35]; };
  const flinch = (dx = -14) => anim(P, [{ transform: "none" }, { transform: `translateX(${dx}px) rotate(-6deg)` }, { transform: "none" }], { duration: 240, fill: "none" });
  const number = (txt, x, y) => {
    const el = add(esc(txt), "bt-num", `left:${x}px;top:${y}px`);
    anim(el, reduce() ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }] : [{ transform: "translate(-50%,0) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-30px) scale(1.25)", opacity: 1, offset: 0.25 }, { transform: "translate(-50%,-70px) scale(1)", opacity: 0 }], 900);
    gone(el, 950);
  };

  const FXS = {
    async drops() { const [x, y] = [arena.clientWidth / 2, arena.clientHeight * 0.45]; if (!reduce()) burst(x, y, 46, ["#ffd23f", "#ffe98a", "#ffb000", "#fff6c2"]); shake(5); },
    async combo(g) {
      const [px, py] = pCenter(), vx = arena.clientWidth * 0.78, vy = arena.clientHeight * 0.5;
      for (let i = 0; i < 3; i++) {
        const m = add(img("dumpling", "", esc(ctx.emoji)), "bt-mini", `left:${vx}px;top:${vy}px`);
        if (!reduce()) anim(m, [{ transform: "none" }, { transform: `translate(${px - vx}px,${py - vy - 20 + i * 14}px) rotate(-200deg)`, opacity: 1 }, { transform: `translate(${px - vx}px,${py - vy}px) scale(.2)`, opacity: 0 }], { duration: 320, delay: i * 110 });
        gone(m, 460 + i * 110);
        setTimeout(() => { flinch(-8); number(`+${Math.round(g / 3)}`, px + 30, py - 20 - i * 18); beep(660 + i * 120, 0.05); }, 300 + i * 110);
      }
    },
    async counter() {
      const t = add("COUNTER!", "bt-big", "color:var(--c)");
      if (!reduce()) { anim(arena, [{ filter: "none" }, { filter: "saturate(.3) contrast(1.3)" }, { filter: "none" }], { duration: 700, fill: "none" }); anim(t, [{ transform: "translate(-50%,-50%) skewX(-12deg) scale(3)", opacity: 0 }, { transform: "translate(-50%,-50%) skewX(-12deg) scale(1)", opacity: 1, offset: 0.4 }, { transform: "translate(-50%,-50%) skewX(-12deg) scale(1)", opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1100, easing: "cubic-bezier(.2,.8,.2,1)" }); anim(V, [{ transform: "none" }, { transform: "translateX(-40px) scale(1.15)" }, { transform: "none" }], { duration: 700, fill: "none" }); }
      else anim(t, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 900);
      gone(t, 1150); await sleep(reduce() ? 0 : 420); shake(8);
    },
    async stack() {
      const n = 5, H = arena.clientHeight;
      for (let i = 0; i < n; i++) {
        const st = add(img("steamer", "", ""), "bt-steamer" + (art?.steamer ? " art" : ""), `left:${(i % 2 ? 8 : 48) + (i * 7) % 10}%;bottom:${i * 11}%`);
        anim(st, reduce() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: `translateY(-${H}px)` }, { transform: "translateY(6px)", offset: 0.8 }, { transform: "none" }], { duration: 260, delay: i * 90 });
        setTimeout(() => { shake(3, 120); beep(220 - i * 20, 0.05); }, 250 + i * 90);
        setTimeout(() => anim(st, [{ opacity: 1 }, { opacity: 0 }], 400), 1300);
        gone(st, 1750);
      }
    },
    async steam() {
      for (let i = 0; i < 9; i++) {
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
        setTimeout(() => anim(P, [{ transform: "none" }, { transform: "rotate(-70deg) translateY(10px)" }, { transform: "rotate(-70deg) translateY(10px)", offset: 0.6 }, { transform: "none" }], { duration: 700, fill: "none" }), 420);
        setTimeout(() => shake(6), 520);
      } else anim(b, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 800);
      gone(b, 850);
    },
  };

  const setGauge = () => {
    $(".bt-gauge i").style.width = (s.happy / GAUGE_MAX) * 100 + "%";
    $(".bt-gauge").classList.toggle("full", s.ko);
    $(".bt-gauge").setAttribute("aria-valuenow", s.happy);
    $("[data-hp]").textContent = s.happy;
  };

  async function eat() {
    if (s.ko) return;
    const now = performance.now(), fast = now - s.last < 700, my = ++seq;
    s = bite(s, now);
    const st = s, m = moves[st.move];
    maxCombo = Math.max(maxCombo, st.combo);
    if (st.ko) $("[data-eat]").disabled = true;
    live(`${m.name}! 행복 +${st.gain}. 행복 ${st.happy}`);
    // ① 빌런 얼굴로 줌인(필살기 기합). 연타 중엔 건너뛴다
    setV("special");
    if (!fast) { await camTo(V, 0.45, 1.8, 150); await sleep(reduce() ? 260 : 170); }
    // ② 타격: 플레이어 쪽으로 팬 + 히트 스톱, 한 입 먹고 황홀한 얼굴
    navigator.vibrate?.(st.ko ? [40, 60, 120] : 30);
    beep(440 + st.combo * 90);
    setP("bite");
    camTo(P, 0.24, 1.5, fast ? 90 : 120);
    flash();
    await hitStop();
    fx.querySelectorAll(".bt-move,.bt-combo").forEach((el) => el.remove()); // 연타해도 이름은 하나만
    const banner = add(`${esc(m.name)}!<small>${esc(m.axis)} ${(+ctx.stats.vals[st.move]).toFixed(1)}</small>`, "bt-move");
    anim(banner, reduce() ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }] : [{ transform: "translateX(40%) skewX(-10deg)", opacity: 0 }, { transform: "translateX(-50%) skewX(-10deg)", opacity: 1, offset: 0.2 }, { transform: "translateX(-50%) skewX(-10deg)", opacity: 1, offset: 0.75 }, { transform: "translateX(-120%) skewX(-10deg)", opacity: 0 }], 1100);
    gone(banner, 1150);
    if (st.combo) { const c = add(`${st.combo + 1} COMBO!`, "bt-combo"); anim(c, [{ transform: "scale(1.6)" }, { transform: "scale(1)", offset: 0.2 }, { opacity: 0 }], 900); gone(c, 950); }
    FXS[m.fx]?.(st.gain);
    flinch();
    const [x, y] = pCenter();
    number(`행복 +${st.gain}`, x + 20, y - 30 - (st.combo % 3) * 38);
    setGauge(); nextMove();
    if (st.ko) return ko();
    // ③ 놀라면서도 웃는 얼굴 → 줌아웃해서 둘 다
    await sleep(240); if (my !== seq) return;
    setP("hit"); camReset(320);
    await sleep(520); if (my !== seq) return;
    setP("idle"); setV("idle");
  }

  async function ko() {
    $("[data-eat]").disabled = true;
    seq++;
    await sleep(350);
    fx.replaceChildren(); // 클라이맥스는 깨끗하게
    // 플레이어 얼굴로 천천히 줌인(감은 눈 웃음·발그레한 볼) → 잠깐 멈춤 → 줌아웃하며 배 불룩 누운 전신
    setV("win"); setP("bite");
    await camTo(P, 0.22, 2.4, 1100, "ease-in-out");
    await sleep(reduce() ? 900 : 650);
    setP("ko");
    camReset(800);
    beep(523, 0.12); beep(659, 0.12, 0.13); beep(784, 0.3, 0.26);
    arena.classList.add("warm");
    arena.insertAdjacentHTML("beforeend", `<div class="bt-steam">${Array.from({ length: 8 }, (_, i) => `<i style="left:${i * 13}%;animation-delay:${i * 0.45}s"></i>`).join("")}</div>`);
    const t = add("행복<br>K.O.", "bt-big", "text-align:center");
    anim(t, reduce() ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translate(-50%,-50%) scale(5)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.9)", opacity: 1, offset: 0.5 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], 700);
    if (!reduce() && !PF) { shake(10, 420); anim(P, [{ transform: "none" }, { transform: "translateY(6px) scaleY(.8) scaleX(1.15)", offset: 0.3 }, { transform: "translateY(30px) rotate(-82deg) scaleY(.72) scaleX(1.25)" }], { duration: 1400, delay: 300, easing: "cubic-bezier(.5,0,.6,1.4)" }); }
    live(`행복 K.O. ${s.bites}입 만에 쓰러졌어요`);
    const save = ctx.onKO({ bites: s.bites, maxCombo }).catch(() => ({ saved: false, note: "기록 저장에 실패했어요. 잠시 후 다시 해 봐요" }));
    if (PF && !reduce()) shake(8, 380);
    await sleep(reduce() ? 1200 : 2200);
    result(save);
  }

  function result(save) {
    const res = document.createElement("div");
    res.className = "bt-res";
    res.innerHTML = `<div class="bt-steam">${Array.from({ length: 8 }, (_, i) => `<i style="left:${i * 13}%;animation-delay:${i * 0.5}s"></i>`).join("")}</div>
      <div class="bt-card"><span class="tape">RESULT · 행복 KO 패배</span>
        ${art?.ko ? img("ko", "art") : ""}
        <div class="bt-down">${PF ? `<div class="lie sp">${pix(PF.ko, 2)}</div>` : `<div class="lie">${ctx.avatar(true)}</div>`}<span class="zz">♥ 배불러…</span></div>
        <h2>행복 K.O.</h2>
        <div class="line">${esc(koLine(ctx.target.name, s.bites))}</div>
        <div class="quote">“${esc(ctx.koLine)}”</div>
        <div class="meta">최대 콤보 ${maxCombo + 1} · 맞은 필살기 ${new Set(Array.from({ length: s.bites }, (_, i) => s.order[i % 6])).size}종 · 지는 게 최고의 찬사예요</div>
        <div class="meta" data-note>기록하는 중…</div>
        <div class="inline"><button class="btn" type="button" data-again>🥢 한 판 더</button><button class="btn ghost" type="button" data-done>닫기</button></div>
      </div>`;
    $(".bt").append(res);
    anim(res, [{ opacity: 0 }, { opacity: 1 }], 400);
    res.querySelector("[data-done]").onclick = close;
    res.querySelector("[data-again]").onclick = () => openBattle(ctx);
    res.querySelector("[data-done]").focus();
    save.then((r) => { const n = res.querySelector("[data-note]"); if (n) n.textContent = r?.note || ""; });
  }

  $("[data-eat]").addEventListener("click", eat);
  addEventListener("resize", fit);
  dlg.addEventListener("close", () => removeEventListener("resize", fit));
  dlg.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && e.target === dlg) { e.preventDefault(); eat(); } });
  dlg.showModal();
  if (VF) V.replaceChildren();
  fit();
  setTimeout(() => { if (!s.bites) setV("idle"); }, 1600); // 도발하다가 대기
  $("[data-eat]").focus();
}
