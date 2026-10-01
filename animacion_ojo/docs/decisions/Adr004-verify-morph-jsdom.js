// ADR-004 · MorphSVG con DOM simulado (jsdom, NO navegador real). Requiere: npm i gsap@3.15.0 jsdom
// Mide la desviación del morph de GSAP frente a lerpRing (interpolación lineal por índice) en anillos de 48 puntos.
// Advertencia: sin el process.exit final, el ticker interno de GSAP mantiene vivo el proceso.
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><svg xmlns="http://www.w3.org/2000/svg"><path id="a"/><path id="b"/></svg>',{pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.self=dom.window;
try{Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});}catch(e){}
const {gsap}=require('gsap');const {MorphSVGPlugin}=require('gsap/MorphSVGPlugin');
gsap.registerPlugin(MorphSVGPlugin);
// ---- Manual clock: quitar ticker propio y avanzar con tiempo inyectado
gsap.ticker.remove(gsap.updateRoot);
gsap.ticker.lagSmoothing(0);
// 48-point rings (circulo y elipse desplazada) - correspondencia por indice
const N=48, A=[],B=[];
for(let i=0;i<N;i++){const a=2*Math.PI*i/N;A.push([100+20*Math.cos(a),100+20*Math.sin(a)]);B.push([130+35*Math.cos(a),95+10*Math.sin(a)]);}
const S=r=>'M'+r.map(p=>p[0].toFixed(3)+' '+p[1].toFixed(3)).join('L')+'Z';
const pa=document.getElementById('a'),pb=document.getElementById('b');
pa.setAttribute('d',S(A));pb.setAttribute('d',S(B));
gsap.to(pa,{morphSVG:{shape:pb,shapeIndex:0},duration:1,ease:'none',paused:false});
gsap.updateRoot(0);            // t=0
gsap.updateRoot(0.5);          // t=0.5 s por reloj inyectado
const d=pa.getAttribute('d');
const raw=MorphSVGPlugin.stringToRawPath(d);
console.log('segmentos',raw.length,'coords',raw[0].length,'=> puntos cubicos',(raw[0].length-2)/6);
// vertices (anclas) de la salida: cada 6 coords desde el indice 0 y 6,12...
const anchors=[];for(let i=0;i<raw[0].length;i+=6)anchors.push([raw[0][i],raw[0][i+1]]);
// comparar con lerpRing a t=.5
let maxErr=1e9,bestShift=null;
const L=A.map((p,i)=>[p[0]+(B[i][0]-p[0])*.5,p[1]+(B[i][1]-p[1])*.5]);
for(let s=0;s<anchors.length;s++){let m=0;for(let i=0;i<N;i++){const q=anchors[(i+s)%anchors.length];m=Math.max(m,Math.hypot(q[0]-L[i][0],q[1]-L[i][1]));}if(m<maxErr){maxErr=m;bestShift=s;}}
console.log('anclas salida',anchors.length,'mejor desplazamiento',bestShift,'error max vs lerpRing',maxErr.toFixed(4));
process.exit(0)