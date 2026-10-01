// ADR-004 · Verificación de GSAP en Node SIN DOM. Requiere: npm i gsap@3.15.0
// Uso: node adr004_verify_gsap.js
'use strict';
const { gsap } = require('gsap');
const { MorphSVGPlugin } = require('gsap/MorphSVGPlugin');
gsap.registerPlugin(MorphSVGPlugin);
console.log('gsap version =', gsap.version);
// Reloj propio: se retira el ticker interno; el tiempo se inyecta
gsap.ticker.remove(gsap.updateRoot); gsap.ticker.lagSmoothing(0);
const TAU = 2 * Math.PI;

// G1 · Determinismo: dos corridas con el mismo reloj controlado producen la misma serie
function run() { const q = { v: 0 }; const t = gsap.to(q, { v: 100, duration: 2, ease: 'power2.inOut', paused: true }); const s = []; for (let i = 0; i <= 120; i++) { t.time(i / 60); s.push(q.v); } t.kill(); return s; }
console.log('G1 corridas idénticas =', JSON.stringify(run()) === JSON.stringify(run()));

// G2 · sine del repo = yoyo sine.inOut de duración T/2 (fase −π/2)
for (const [amp, T] of [[1.2, 3.6], [24, 2.0]]) {
  const o = { v: -amp }; const tw = gsap.to(o, { v: amp, duration: T / 2, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true });
  let m = 0; for (let i = 0; i <= 1000; i++) { const t = i * 0.01; tw.totalTime(t); m = Math.max(m, Math.abs(o.v - amp * Math.sin(TAU * t / T - Math.PI / 2))); }
  console.log('G2 amp=' + amp + ' T=' + T + ' error_max =', m.toExponential(2)); tw.kill();
}

// G3 · Dos tweens sobre la misma propiedad: gana el último, no suman
{ const o = { y: 0 };
  const a = gsap.to(o, { y: 10, duration: 1, ease: 'none', paused: true, overwrite: false });
  const b = gsap.to(o, { y: 5, duration: 1, ease: 'none', paused: true, overwrite: false });
  a.time(0.5); b.time(0.5); console.log('G3 y tras a(0.5)->10 y b(0.5)->5 =', o.y, '(aditivo daría 7.5)'); }

// G4 · Ease como función propia (glance = tanh(2.8 sin))
{ const glance = p => Math.tanh(2.8 * Math.sin(TAU * p)); const g = { v: 0 };
  const t = gsap.to(g, { v: 1, duration: 3.6, ease: glance, paused: true }); t.time(0.9);
  console.log('G4 glance en cuarto de periodo =', g.v.toFixed(4), 'esperado', glance(0.25).toFixed(4)); }

// G5 · MorphSVG sin DOM
const N = 48, A = [], B = [];
for (let i = 0; i < N; i++) { const a = TAU * i / N; A.push([100 + 20 * Math.cos(a), 100 + 20 * Math.sin(a)]); B.push([130 + 35 * Math.cos(a), 95 + 10 * Math.sin(a)]); }
const S = r => 'M' + r.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('L') + 'Z';
try { const rp = MorphSVGPlugin.stringToRawPath(S(A)); console.log('G5a stringToRawPath sin DOM = OK, coords', rp[0].length); } catch (e) { console.log('G5a FALLA', e.message); }
{ let renderCalls = 0;   // GSAP avisa por consola; el criterio verificable es que render() nunca se invoca
  const tw = gsap.to({}, { morphSVG: { shape: S(B), render() { renderCalls++; }, updateTarget: false }, duration: 1, paused: true });
  tw.time(0.5); console.log('G5b tween morphSVG sobre objeto plano: render() invocado', renderCalls, 'veces (rechazado =', renderCalls === 0, ')'); }
{ const k = 0.5522847498, r = 20, cx = 100, cy = 100;
  const C = `M${cx + r} ${cy}C${cx + r} ${cy + k * r} ${cx + k * r} ${cy + r} ${cx} ${cy + r}C${cx - k * r} ${cy + r} ${cx - r} ${cy + k * r} ${cx - r} ${cy}C${cx - r} ${cy - k * r} ${cx - k * r} ${cy - r} ${cx} ${cy - r}C${cx + k * r} ${cy - r} ${cx + r} ${cy - k * r} ${cx + r} ${cy}Z`;
  const P = 'M80 110L90 95L100 90L110 95L120 110L100 102Z';
  const [a, b] = MorphSVGPlugin.normalizeStrings(C, P, { shapeIndex: 'auto', map: 'complexity' });
  const ra = MorphSVGPlugin.stringToRawPath(a)[0], rb = MorphSVGPlugin.stringToRawPath(b)[0];
  console.log('G5c normalizeStrings sin DOM: segmentos A/B =', (ra.length - 2) / 6, '/', (rb.length - 2) / 6, ' iguales =', ra.length === rb.length); }
process.exit(0);