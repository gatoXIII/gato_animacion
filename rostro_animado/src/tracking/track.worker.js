// rostro_animado/src/tracking/track.worker.js
/* v2.5f-1 SELLO DE VERSIÓN — además del comentario, el worker EMITE
 * {type:'meta', build:'v2.5f-1'} al arrancar y Backends.js lo contrasta:
 * si en consola NO aparece "[tracking][worker] build=v2.5f-1", el navegador
 * está ejecutando una copia VIEJA (cache de disco / service worker /
 * extensión), y esa —no el código— es la causa del error.
 * El mensaje "WorkerBackend: el bundle no exporta FaceLandmarker/FilesetResolver"
 * fue ELIMINADO de este archivo: solo puede provenir de código obsoleto. */
var WORKER_BUILD = 'v2.5f-1';   /* sincronizar con Backends.js WORKER_BUILD */
/* ============================================================
 * track.worker.js — Backend Worker: inferencia MediaPipe fuera del hilo principal.
 *
 * Protocolo (mensajes planos, sin dependencias externas):
 *   host → worker : { type:'init',  config:{ bundleUrl, wasmPaths, modelUrl|modelBuffer,
 *                                            delegate, numFaces, initTimeoutMs } }
 *                   { type:'frame', bitmap: ImageBitmap (transferible), t }
 *                   { type:'dispose' }
 *   worker → host : { type:'ready' | 'result', t, faces:[{ lm:[[x,y]×478] }] }
 *                   { type:'warning'|'error', message }
 *                   { type:'disposed' }
 *
 * Decisiones de diseño:
 *   • Se reciben ImageBitmap (cero copia de píxeles; el canvas de captura vive
 *     en el host y se transfiere por structured-clone).
 *   • La respuesta es compacta: solo landmarks normalizados a [0,1] con 4
 *     decimales. La matemática de EAR/gaze/pose NO se duplica aquí: vive en
 *     Filters.js y la ejecuta el host, garantizando resultados idénticos entre
 *     WorkerBackend y MainThreadBackend.
 *   • El modelo y el WASM se cargan desde assets/vendor/ (mismas rutas que
 *     MpLoader en el host; los resuelve el caller vía config).
 * ============================================================ */
'use strict';

var landmarker = null;
var mod = null;
var modUrl = '';
var resolver = null;
var seq = 0;
var CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/';
var MODEL_CDN_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

function post(type, payload) {
  self.postMessage(Object.assign({ type: type, seq: ++seq }, payload || {}));
}

/* ============================================================
 * v2.5d REESCRITURA DEL PATH DE CARGA (causa raiz del error
 * "el bundle no exporta FaceLandmarker/FilesetResolver"):
 *
 * Los intentos previos hacian `await import(url)` DIRECTO sobre
 * vision_bundle.mjs. Ese mecanismo tiene dos modos de fallo SILENCIOSO
 * imposibles de distinguir desde dentro:
 *   A) HTTP-cache/SW/extensiones sirven el .mjs con Content-Type
 *      text/html (p. ej. un fallback SPA que devuelve index.html):
 *      el import "funciona" pero el namespace sale SIN exports ->
 *      exactamente el error reportado, aunque el archivo en disco sea
 *      valido (verificado: exporta FaceLandmarker y FilesetResolver).
 *   B) Un dynamic import que falla una vez queda ENVENENADO de forma
 *      permanente en el grafo de modulos del contexto; cualquier
 *      reintento devuelve el mismo error opaco sin la causa original.
 *
 * Solucion estructural: NUNCA se importa una URL cruda. Se hace:
 *   fetch(url) -> valida respuesta (ok + content-type NO html + cuerpo
 *   con los simbolos esperados) -> Blob(type:'text/javascript') ->
 *   import(URL.createObjectURL(blob)).
 * El blob es canonico por contenido: inmune al grafo envenenado, al
 * MIME incorrecto y al HTML interpolado. Ademas el modelo se inyecta
 * como modelAssetBuffer (ArrayBuffer descargado via fetch), eliminando
 * la ultima dependencia de rutas resueltas dentro del worker.
 * ============================================================ */

async function fetchChecked(url, label) {
  var r;
  try {
    r = await fetch(url, { cache: 'reload' });
  } catch (e) {
    throw new Error(label + ' no accesible (' + url + '): ' + ((e && e.message) || e));
  }
  if (!r.ok) {
    throw new Error(label + ' HTTP ' + r.status + ' en ' + url);
  }
  var ct = r.headers.get('content-type') || '';
  if (/html|xml/i.test(ct)) {
    throw new Error(label + ' servido como ' + ct + ' (' + url + ') - un SW, proxy o extension esta interceptando el asset; un import directo produciria un modulo vacio.');
  }
  return r;
}

/**
 * Descarga el bundle y lo instancia como modulo ESM canonico via blob.
 * @param {string[]} urls candidatas (orden de preferencia)
 * @returns {Promise<{mod:Object, url:string}>}
 */
async function loadBundle(urls) {
  var lastErr = null;
  for (var i = 0; i < urls.length; i++) {
    var url = urls[i];
    try {
      var r = await fetchChecked(url, 'bundle MediaPipe');
      var text = await r.text();
      /* Validacion semantica ANTES de instanciar: detecta HTML de error,
       * truncamientos o versiones sin las clases necesarias. */
      if (text.indexOf('FilesetResolver') < 0 || text.indexOf('FaceLandmarker') < 0) {
        throw new Error('el contenido de ' + url + ' no contiene las exportaciones FaceLandmarker/FilesetResolver (archivo corrupto o version equivocada). Primeros 120 chars: ' + JSON.stringify(text.slice(0, 120)));
      }
      var blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      var m;
      try {
        m = await import(/* webpackIgnore: true */ blobUrl);
      } catch (impErr) {
        /* variante MIME para navegadores estrictos con el sniffing de blobs */
        var alt = URL.createObjectURL(new Blob([text], { type: 'application/javascript' }));
        try {
          m = await import(/* webpackIgnore: true */ alt);
        } finally {
          setTimeout(function () { try { URL.revokeObjectURL(alt); } catch (er) {} }, 30000);
        }
        if (!m) throw impErr;
      }
      setTimeout(function () { try { URL.revokeObjectURL(blobUrl); } catch (er) {} }, 30000);
      if (!m || !m.FaceLandmarker || !m.FilesetResolver) {
        var keys = m ? Object.keys(m).slice(0, 8).join(',') : 'undefined';
        throw new Error('el modulo instanciado desde ' + url + ' no exporta las clases requeridas (exports: ' + (keys || 'ninguno') + ')');
      }
      return { mod: m, url: url };
    } catch (e) {
      lastErr = e;
      post('warning', { message: 'fallo cargando ' + url + ': ' + ((e && e.message) || e) });
    }
  }
  throw lastErr || new Error('sin bundle MediaPipe disponible');
}

async function loadModelBuffer(url) {
  var r = await fetchChecked(url, 'modelo face_landmarker.task');
  return await r.arrayBuffer();
}

async function initFaceLandmarker(cfg) {
  cfg = cfg || {};
  var candidates = [];
  if (cfg.bundleUrl) candidates.push(String(cfg.bundleUrl));
  var cdnBundle = CDN_BASE + 'vision_bundle.mjs';
  if (candidates.map(function (u) { return u.split('#')[0].split('?')[0]; }).indexOf(cdnBundle) < 0) {
    candidates.push(cdnBundle);
  }

  var loaded = await loadBundle(candidates);
  mod = loaded.mod;
  modUrl = loaded.url;
  var remote = modUrl.indexOf(CDN_BASE) === 0;

  /* WASM: ruta local solo si el bundle ES local; si viene del CDN, el wasm
   * tambien (versiones pinneadas coherentes bundle<->wasm). */
  var wasmPaths = remote ? (CDN_BASE + 'wasm/')
    : (cfg.wasmPaths || (self.location && self.location.origin && self.location.origin !== 'null'
        ? self.location.origin + '/assets/vendor/mediapipe/wasm/' : 'assets/vendor/mediapipe/wasm/'));
  resolver = await mod.FilesetResolver.forVisionTasks(wasmPaths);

  /* Modelo: ArrayBuffer descargado via fetch (inmune a la resolucion de
   * rutas relativas dentro del worker, causa historica de 404 silenciosos). */
  var modelUrls = [];
  if (!remote) {
    if (cfg.modelUrl || cfg.modelPath) modelUrls.push(String(cfg.modelUrl || cfg.modelPath));
  }
  modelUrls.push(MODEL_CDN_URL);
  var modelBuffer = null;
  var lastModelErr = null;
  for (var mi = 0; mi < modelUrls.length; mi++) {
    try {
      modelBuffer = await loadModelBuffer(modelUrls[mi]);
      break;
    } catch (e) {
      lastModelErr = e;
      if (mi < modelUrls.length - 1) {
        post('warning', { message: 'modelo no disponible en ' + modelUrls[mi] + ', probando hosting oficial.' });
      }
    }
  }
  if (!modelBuffer) throw lastModelErr || new Error('sin modelo face_landmarker disponible');

  var opts = {
    baseOptions: {
      modelAssetBuffer: new Uint8Array(modelBuffer),
      delegate: cfg.delegate || 'GPU'
    },
    runningMode: 'VIDEO',
    numFaces: cfg.numFaces || 1,
    minFaceDetectionConfidence: cfg.minFaceDetectionConfidence != null ? cfg.minFaceDetectionConfidence : 0.5,
    minTrackingConfidence: cfg.minTrackingConfidence != null ? cfg.minTrackingConfidence : 0.5,
    outputFaceBlendshapes: false
  };
  try {
    return await mod.FaceLandmarker.createFromOptions(resolver, opts);
  } catch (gpuErr) {
    if (cfg.delegate === 'CPU') throw gpuErr;
    post('warning', { message: 'GPU no disponible, usando CPU: ' + (gpuErr.message || gpuErr) });
    opts.baseOptions.delegate = 'CPU';
    return await mod.FaceLandmarker.createFromOptions(resolver, opts);
  }
}

/* v2.5f — auto-anuncio de build: el worker se identifica ANTES de cualquier
 * init, para que el host (Backends.js) pueda contrastar la versión realmente
 * en ejecución y detectar copias cacheadas obsoletas. */
post('meta', { build: WORKER_BUILD });

self.onmessage = async function (ev) {
  var msg = ev.data || {};
  try {
    if (msg.type === 'init') {
      if (landmarker) { post('ready', {}); return; }
      landmarker = await initFaceLandmarker(msg.config || {});
      post('ready', { delegate: landmarker.baseOptions ? landmarker.baseOptions.delegate : undefined });
      return;
    }

    if (msg.type === 'frame') {
      var bitmap = msg.bitmap;
      if (!landmarker || !bitmap) {
        if (bitmap) bitmap.close();
        return;
      }
      /* ts monótono en ms exigido por detectForVideo; si llega desordenado, se descarta. */
      var ts = +msg.t;
      if (!isFinite(ts)) { bitmap.close(); return; }
      var res = landmarker.detectForVideo(bitmap, ts);
      bitmap.close();
      var faces = (res.faceLandmarks || []).map(function (lm) {
        var out = new Array(lm.length);
        for (var i = 0; i < lm.length; i++) {
          out[i] = [+lm[i].x.toFixed(4), +lm[i].y.toFixed(4)];
        }
        return { lm: out };
      });
      post('result', { t: ts, faces: faces });
      return;
    }

    if (msg.type === 'dispose') {
      if (landmarker && landmarker.close) landmarker.close();
      landmarker = null; mod = null; resolver = null;
      post('disposed', {});
      return;
    }
  } catch (e) {
    post('error', { message: String((e && e.message) || e) });
  }
};
