// rostro_animado/src/tracking/MpLoader.js
/* ============================================================
 * MpLoader.js — Carga única de @mediapipe/tasks-vision desde assets/vendor/.
 *
 * Dos caminos sin reescribir código (decisión 4 del plan):
 *   1. local  (por defecto): WASM + .task servidos desde el repo
 *      → sin CDN, sin CORS externo, sin cuotas; robusto en sandbox/CI.
 *   2. remote (override): opts.cdnBase permite apuntar a un CDN si el
 *      producto prefiere no servir ~7 MB de binarios.
 *
 * El modelo también puede inyectarse como ArrayBuffer vía opts.modelBuffer
 * (fetch propio del host) evitando el segundo request.
 *
 * La Promise de carga se memoiza: una sola import por página.
 * ============================================================ */
(function (global) {
  'use strict';

  /* F2 FIX (v2.5g) — Base derivada de document.baseURI, NO de location.origin:
   * bajo una subruta de despliegue (p. ej.
   * https://usuario.github.io/proyecto/...) location.origin + '/assets/...'
   * apunta a la RAÍZ del dominio → 404 de bundle/WASM/modelo. El patch 2d
   * original usaba rutas relativas resueltas contra la base del documento, que
   * sí funcionan en subruta; v2.5 lo sustituyó por origin y rompió GH Pages.
   * document.baseURI termina en '/' o incluye el archivo: se recorta al
   * directorio del documento antes de resolver. */
  function defaultVendorBase() {
    try {
      var d = (typeof document !== 'undefined' && document) ? document : null;
      var b = d && d.baseURI;
      if (b && /^(https?:|file:)/.test(b)) {
        var dir = b.split('?')[0].split('#')[0];
        dir = dir.slice(0, dir.lastIndexOf('/') + 1);
        return new URL('assets/vendor/mediapipe/', dir).href;
      }
      var loc = (typeof self !== 'undefined' && self.location) ? self.location : null;
      if (loc && loc.href && /^(https?:|file:)/.test(loc.href)) {
        var ldir = loc.href.split('?')[0].split('#')[0];
        ldir = ldir.slice(0, ldir.lastIndexOf('/') + 1);
        return new URL('assets/vendor/mediapipe/', ldir).href;
      }
    } catch (e) { /* entornos sin location/document (tests Node) */ }
    return 'assets/vendor/mediapipe/';
  }
  var VENDOR_BASE = defaultVendorBase();
  /* v2.5b — Reserva remota por defecto: si assets/vendor/mediapipe/ no está
   * desplegado (404 del bundle), se reintenta contra el CDN de la MISMA
   * versión pinneada, tanto para el bundle como para el wasm/.task. Sin esto,
   * un deploy sin los binarios (~13 MB) rompía el seguimiento con un error
   * opaco ("Failed to fetch dynamically imported module"). */
  var CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/';
  var MODEL_CDN_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  var _cache = null;
  /* F4 FIX — contador de reintentos de import: cada intento usa un fragmento
   * único en la URL del blob, evitando que el navegador devuelva el resultado
   * (o el error) cacheado de un import previo con la misma clave. */
  var _importSeq = 0;
  var _blobUrls = [];

  function assert(cond, msg) {
    if (!cond) throw new Error('MpLoader: ' + msg);
  }

  /**
   * Devuelve { FaceLandmarker, FilesetResolver, resolver } (memoizado).
   * @param {Object} opts { bundleUrl?, cdnBase?, wasmPaths?, forceReload? }
   */
  function load(opts) {
    opts = opts || {};
    if (_cache && !opts.forceReload) return _cache;

    _cache = (async function () {
      var base = opts.bundleUrl || (VENDOR_BASE + 'vision_bundle.mjs');
      var cdn = opts.cdnBase || CDN_BASE;
      var mod;
      var modFromCdn = false;   /* true ⇒ el vendor local falló: todo lo demás va al CDN */
      /* F4 FIX — los objectURL de módulos ya instanciado se conservan en el
       * ciclo de vida del loader (revocados solo vía destroy()): revocar la URL
       * de un módulo ES ya evaluado es innecesario y rompería cualquier
       * resolución secundaria contra esa base. */
      var _blobUrlsRef = _blobUrls;
      /* ============================================================
       * v2.5d FIX — carga canónica por contenido (igual que track.worker.js):
       * `import(url)` directo tiene dos fallos silenciosos indistinguibles:
       *   A) un SW/proxy/extensión sirve el .mjs como text/html (fallback SPA)
       *      → el namespace importa "bien" pero SIN exports (error reportado);
       *   B) un dynamic import fallido queda envenenado permanentemente en el
       *      grafo de módulos → reintentos devuelven el mismo error opaco.
       * Por eso NUNCA se importa la URL cruda: fetch → valida status/MIME/
       * símbolos → Blob(text/javascript) → import(objectURL). Inmune a ambos.
       * F4 FIX (v2.5g) — además, cada reintento usa un fragmento único (#rN)
       * en la URL del blob: si el navegador cachea/envenena un import fallido,
       * la clave del grafo de módulos cambia y el reintento NO repite el error.
       * ============================================================ */
      function normKey(u) { return String(u).split('#')[0].split('?')[0]; }
      var candidates = [base];
      if (normKey(base) !== normKey(cdn + 'vision_bundle.mjs')) candidates.push(cdn + 'vision_bundle.mjs');
      var lastErr = null;
      for (var ci = 0; ci < candidates.length && !mod; ci++) {
        var url = candidates[ci];
        try {
          var r = await fetch(url, { cache: 'reload' });
          if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
          var ct = r.headers.get('content-type') || '';
          if (/html|xml/i.test(ct)) {
            throw new Error('servido como ' + ct + ' — SW/proxy/extensión interceptando el asset (un import directo daría un módulo vacío)');
          }
          var text = await r.text();
          if (text.indexOf('FilesetResolver') < 0 || text.indexOf('FaceLandmarker') < 0) {
            throw new Error('el contenido de ' + url + ' no contiene las exportaciones requeridas (¿corrupto o versión equivocada?)');
          }
          var blobUrl = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
          _blobUrlsRef.push(blobUrl);
          var m;
          try {
            m = await import(/* webpackIgnore: true */ blobUrl + '#r' + (++_importSeq));
          } catch (impErr) {
            var alt = URL.createObjectURL(new Blob([text], { type: 'application/javascript' }));
            _blobUrlsRef.push(alt);
            try { m = await import(/* webpackIgnore: true */ alt + '#r' + (++_importSeq)); }
            catch (er2) { throw impErr; }
          }
          if (!m || !m.FaceLandmarker || !m.FilesetResolver) {
            var keys = m ? Object.keys(m).slice(0, 8).join(',') : 'undefined';
            throw new Error('el módulo instanciado desde ' + url + ' no exporta las clases requeridas (exports: ' + (keys || 'ninguno') + ')');
          }
          mod = m;
          modFromCdn = normKey(url).indexOf(normKey(cdn)) === 0;
        } catch (e) {
          lastErr = e;
          console.warn('[MpLoader] fallo cargando ' + url + ': ' + ((e && e.message) || e));
        }
      }
      if (!mod) {
        throw new Error('MpLoader: sin bundle MediaPipe disponible — ' + (lastErr ? lastErr.message : 'desconocido'));
      }

      var wasmRoot = opts.wasmPaths ||
        (modFromCdn ? cdn + 'wasm/' : (opts.cdnBase ? opts.cdnBase + 'wasm/' : VENDOR_BASE + 'wasm/'));
      var resolver = await mod.FilesetResolver.forVisionTasks(wasmRoot);
      return {
        FaceLandmarker: mod.FaceLandmarker,
        FilesetResolver: mod.FilesetResolver,
        resolver: resolver,
        remote: modFromCdn,
        cdnBase: cdn
      };
    })().catch(function (e) {
      _cache = null;   /* permitir reintento tras fallo de red/deploy */
      throw e;
    });

    return _cache;
  }

  /**
   * Crea el FaceLandmarker con delegación GPU→CPU automática (mitiga R1 del plan:
   * WebGL bloqueado/fallback en headless o GPUs antiguas).
   * @param {Object} opts { modelPath?, modelBuffer?, delegate?, numFaces?,
   *                        minFaceDetectionConfidence?, minTrackingConfidence?,
   *                        outputFaceBlendshapes? } + opciones de load()
   */
  async function createLandmarker(opts) {
    opts = opts || {};
    var m = await load(opts);
    /* v2.5b — si el vendor local falló (m.remote), las rutas locales de modelo
     * y wasm se sustituyen por el CDN pinneado; además, si el .task local da
     * 404, se reintenta con la URL oficial del modelo en Google Storage. */
    var modelPath = opts.modelPath || (VENDOR_BASE + 'face_landmarker.task');
    var wasmRoot = opts.wasmPaths || (m.remote ? m.cdnBase + 'wasm/' : VENDOR_BASE + 'wasm/');
    if (m.remote) {
      if (modelPath.indexOf(VENDOR_BASE) === 0 || /^assets\//.test(modelPath)) {
        /* el .task NO se publica en el paquete npm → usar el hosting oficial */
        modelPath = MODEL_CDN_URL;
      }
      wasmRoot = m.cdnBase + 'wasm/';
    }
    var hasBuffer = opts.modelBuffer instanceof ArrayBuffer ||
      (typeof Uint8Array !== 'undefined' && opts.modelBuffer instanceof Uint8Array);
    /* v2.5d — el modelo se pasa SIEMPRE como buffer descargado vía fetch
     * (mismo patrón que track.worker.js): elimina la resolución interna de
     * rutas del runtime MediaPipe y permite reintentos explícitos ante 404. */
    var modelBuffer = null;
    if (!hasBuffer) {
      var tried = [];
      var urls = [modelPath];
      if (modelPath !== MODEL_CDN_URL) urls.push(MODEL_CDN_URL);
      var lastErr = null;
      for (var ui = 0; ui < urls.length; ui++) {
        try {
          var r = await fetch(urls[ui], { cache: 'reload' });
          if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + urls[ui]);
          modelBuffer = await r.arrayBuffer();
          break;
        } catch (e) {
          lastErr = e;
          console.warn('[MpLoader] modelo no disponible (' + urls[ui] + '): ' + ((e && e.message) || e));
        }
      }
      if (!modelBuffer) throw new Error('MpLoader: sin modelo face_landmarker disponible — ' + (lastErr ? lastErr.message : 'desconocido'));
    } else {
      modelBuffer = opts.modelBuffer;
    }
    var baseOpts = {
      baseOptions: {
        modelAssetBuffer: new Uint8Array(modelBuffer),
        delegate: opts.delegate || 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: opts.numFaces || 1,
      minFaceDetectionConfidence: opts.minFaceDetectionConfidence != null ? opts.minFaceDetectionConfidence : 0.3,
      minTrackingConfidence: opts.minTrackingConfidence != null ? opts.minTrackingConfidence : 0.3,
      outputFaceBlendshapes: !!opts.outputFaceBlendshapes
    };
    try {
      return await m.FaceLandmarker.createFromOptions(m.resolver, baseOpts);
    } catch (gpuErr) {
      if (opts.delegate === 'CPU') throw gpuErr;
      console.warn('[MpLoader] delegate GPU falló (' + gpuErr.message + '), reintentando CPU.');
      baseOpts.baseOptions.delegate = 'CPU';
      return await m.FaceLandmarker.createFromOptions(m.resolver, baseOpts);
    }
  }

  global.MM_Tracking = global.MM_Tracking || {};
  global.MM_Tracking.MpLoader = {
    load: load,
    createLandmarker: createLandmarker,
    VENDOR_BASE: VENDOR_BASE,
    CDN_BASE: CDN_BASE,
    MODEL_CDN_URL: MODEL_CDN_URL
  };
})(typeof window !== 'undefined' ? window : globalThis);
