// ADR-004 · Verificación numérica sin dependencias (Node >= 16). Uso: node adr004_verify.js
'use strict';
const TAU = 2 * Math.PI, out = [];
const log = (k, v) => { out.push(k + ' = ' + v); console.log(k + ' = ' + v); };

// V1 · Resorte del repo (Euler semi-implícito, ζ=1) frente a la solución analítica desde reposo
const analytic = (w, t) => 1 - (1 + w * t) * Math.exp(-w * t);
function eulerMaxErr(w, dt, T) {
  let x = 0, v = 0, best = { t: 0, e: 0 };
  for (let i = 1; i <= Math.round(T / dt); i++) {
    v += (-2 * w * v - w * w * (x - 1)) * dt; x += v * dt;
    const e = x - analytic(w, i * dt);
    if (Math.abs(e) > Math.abs(best.e)) best = { t: i * dt, e };
  }
  return best;
}
for (const w of [7, 10]) {
  const b = eulerMaxErr(w, 1 / 120, 2.5);
  log('V1 Euler dt=1/120 w=' + w + ' err_max', b.e.toFixed(4) + ' en t=' + b.t.toFixed(3) + ' s');
}
log('V1 Euler w=7 t=0.15 dt=1/120 vs 1/1200', [1 / 120, 1 / 1200].map(dt => {
  let x = 0, v = 0; const n = Math.round(0.15 / dt);
  for (let i = 0; i < n; i++) { v += (-2 * 7 * v - 49 * (x - 1)) * dt; x += v * dt; }
  return (x - analytic(7, 0.15)).toExponential(2);
}).join(' | '));

// V2 · Integrador exacto ζ=1 con objetivo constante durante el paso
const exact = (x0, v0, tg, w, t) => { const A = x0 - tg, B = v0 + w * A, e = Math.exp(-w * t); return [tg + (A + B * t) * e, (B - w * (A + B * t)) * e]; };
const w26 = 26, segs = [[0.05, 0.07], [1.08, 0.08], [1, 0.15]];
function fine() { let x = 1, v = 0; const dt = 1e-6; for (const [tg, T] of segs) for (let i = 0, n = Math.round(T / dt); i < n; i++) { v += (-2 * w26 * v - w26 * w26 * (x - tg)) * dt; x += v * dt; } return x; }
const ref = fine();
for (const s of [1 / 240, 1 / 60, 1 / 30, 0.07]) {
  let x = 1, v = 0;
  for (const [tg, T] of segs) { let rem = T; while (rem > 1e-12) { const h = Math.min(s, rem); [x, v] = exact(x, v, tg, w26, h); rem -= h; } }
  log('V2 exacto paso=' + s.toFixed(4) + ' |x-ref|', Math.abs(x - ref).toExponential(2));
}

// V3 · Mínimo de open(t) en un parpadeo (keyframes 0/.05, 70/.05, 150/1.08, 300/1 ms; ω=26; paso 1/2400)
{ let x = 1, v = 0, tg = 1, min = 9; const dt = 1 / 2400, kf = [[0, .05], [.07, .05], [.15, 1.08], [.3, 1]];
  for (let i = 0; i < 1440; i++) { const t = i * dt; for (const [at, val] of kf) if (t >= at) tg = val; [x, v] = exact(x, v, tg, 26, dt); if (x < min) min = x; }
  log('V3 min open(t) parpadeo', min.toFixed(4)); }

// V4 · Mirada: k = 1-exp(-5.66 dt); residuo tras 1 s
log('V4 residuo 1 s (dt=1/30,1/60,1/120)', [1 / 30, 1 / 60, 1 / 120].map(dt => Math.pow(Math.exp(-5.66 * dt), Math.round(1 / dt)).toExponential(3)).join(' | '));
log('V4 tau mirada', (1 / 5.66).toFixed(4) + ' s');

// V5 · mulberry32(1)
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
{ const r = mulberry32(1); log('V5 mulberry32(1)', [r(), r(), r()].map(v => v.toFixed(10)).join(', ')); }

// V6 · Cúbica de cuarto de círculo (kappa) y cota para las tapas de cinta del repo
{ const k = 0.5522847498; let m = 0;
  for (let i = 0; i <= 1000; i++) { const t = i / 1000, u = 1 - t;
    const x = u*u*u + 3*u*u*t + 3*u*t*t*k, y = 3*u*u*t*k + 3*u*t*t + t*t*t; m = Math.max(m, Math.abs(Math.hypot(x, y) - 1)); }
  log('V6 error radial r=1', m.toExponential(3));
  const rMax = 8.6, width = rMax * 1.0 * 1.7, hw = width * (0.5 + 0.5) / 2;   // planeG∈{4,5,6}: r máx 8.6 (planeG=4); pz≤1; grow≤1
  log('V6 semi-ancho máx cabeza / cota abs', hw.toFixed(3) + ' / ' + (m * hw).toExponential(2) + ' unidades'); }

// V7 · Rebote y giro
log('V7 duración rebote', [.5, .382, .27, .177].reduce((a, b) => a + b, 0).toFixed(3) + ' s');
log('V7 pico ω giro 1 vuelta / 2 vueltas', (TAU * 6.2 / Math.E).toFixed(2) + ' / ' + (2 * TAU * 6.2 / Math.E).toFixed(2) + ' rad/s');
log('V7 |Δyaw| por frame dt=0.05, 2 vueltas (guard del repo 1.2)', (2 * TAU * 6.2 / Math.E * 0.05).toFixed(3));

// V8 · Ojo oculto
log('V8 acos(0.02) / cos(1.15)', Math.acos(0.02).toFixed(5) + ' / ' + Math.cos(1.15).toFixed(4));

// V9 · Confeti del repo (Euler por frame): dependencia del dt
function conf(vx, vy, T, dt) { let x = 0, y = 0; for (let i = 0, n = Math.round(T / dt); i < n; i++) { x += vx * dt; y += vy * dt; const d = Math.pow(.94, 60 * dt); vx *= d; vy = vy * d + 40 * dt; } return [x.toFixed(2), y.toFixed(2)]; }
log('V9 confeti T=0.6 s dt=1/60', conf(300, 0, .6, 1 / 60).join(','));
log('V9 confeti T=0.6 s dt=1/30', conf(300, 0, .6, 1 / 30).join(','));
log('V9 drag equivalente exp(-c dt)', (-60 * Math.log(.94)).toFixed(4));

// V10 · Comandos por frame en el peor caso de partículas (opción A del D-10)
log('V10 comandos peor caso confeti (60 x 6)', 60 * 6);