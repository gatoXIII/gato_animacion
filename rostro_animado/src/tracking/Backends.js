// rostro_animado/src/tracking/Backends.js
/* ============================================================
 * Backends.js — Interfaz única de inferencia facial (D3):
 *
 *   backend.init(config)            → Promise<void>
 *   backend.frame(input, tMs)       → Promise<{ t, faces:[{ lm:[[x,y]×N] }] }>
 *   backend.dispose()               → void
 *
 * El payload `rawResult` es IDÉNTICO en ambos caminos, por lo que
 * TrackingBridge/Filters no conocen el backend concreto.
 *
 * Caminos:
 *   • WorkerBackend      — MediaPipe en worker dedicado (primario).
 *   • MainThreadBackend  — MediaPipe en el hilo principal (respaldo funcional).
 *
 * Alcance de navegadores (decisión 3): Safari >= 17 por defecto; bajo esa
 * premisa WorkerBackend es siempre viable y MainThreadBackend NO es camino
 * crítico — queda como fallback explícito ({backend:'main'}) para entornos
 * sin Worker o con CSP que lo prohíba. Revisable si cambia el mínimo soportado.
 * ============================================================ */
(function (global) {
  'use strict';

  var T = (global.MM_Tracking = global.MM_Tracking || {});

  /* ---------------- WorkerBackend ---------------- */

  function WorkerBackend(opts) {
    opts = opts || {};
    var worker = null;
    var ready = false;
    var pending = null;          /* resolver del frame en vuelo (backpressure: 1 in-flight) */
    var lastTs = 0;
    var disposed = false;
    /* Sello canónico: debe coincidir con WORKER_BUILD de track.worker.js */
    var WORKER_BUILD = 'v2.5f-1';

    function init(config) {
      config = config || {};
      return new Promise(function (resolve, reject) {
        if (disposed) { reject(new Error('WorkerBackend: backend destruido')); return; }
        /* v2.5f — RESOLUCIÓN SINCRÓNICA DEL BUILD REAL ANTES DE INSTANCIAR:
         * se hace fetch(cache:'reload') del script del worker y se busca el
         * sello WORKER_BUILD en el TEXTO. Así sabemos si el ARCHIVO EN SERVIDOR
         * es actual o viejo — independiente de qué copia ejecute el navegador.
         * Un build desalineado aquí significa que el servidor está sirviendo
         * una versión obsoleta (p. ej. se editó otro directorio / no se salvó),
         * y la causa del error queda identificada sin ambigüedad. */
        var wurl0 = opts.workerUrl || 'src/tracking/track.worker.js';
        if (!/^(https?:|blob:)/.test(wurl0)) {
          try { wurl0 = new URL(wurl0, document.baseURL || (location.href.replace(/[^/]*$/, ''))).href; }
          catch (eU) { /* dejar como está */ }
        }
        var expectedBuildRe = /WORKER_BUILD\s*=\s*'([^']+)'/;
        var preflight = (typeof fetch === 'function')
          ? fetch(wurl0, { cache: 'reload' })
              .then(function (r) { return r.ok ? r.text() : ''; })
              .catch(function () { return ''; })
          : Promise.resolve('');

        preflight.then(function (srcText) {
        /* build realmente presente en el ARCHIVO SERVIDO (no asumido). */
        var mBuild = expectedBuildRe.exec(srcText || '');
        var serverBuild = mBuild ? mBuild[1] : '(sin sello: archivo VIEJO en servidor)';
        if (!mBuild || mBuild[1] !== WORKER_BUILD) {
          console.warn('[tracking][worker] el SERVIDOR está sirviendo track.worker.js build=' + serverBuild +
            ' (esperado ' + WORKER_BUILD + '). Verifica que el python -m http.server apunta al directorio ' +
            'editado y que el archivo se guardó.');
        }
        try {
          /* v2.5 — URL absoluta del worker: new Worker(res) se resuelve contra
           * la URL del DOCUMENTO, no del script; en call.html (raíz) la ruta
           * relativa 'src/tracking/...' coincide, pero si el host embedder está
           * en otro path daría 404 de script y el worker moriría sin mensaje. */
          var wurl = opts.workerUrl || 'src/tracking/track.worker.js';
          if (!/^(https?:|blob:)/.test(wurl)) {
            wurl = new URL(wurl, document.baseURL || (location.href.replace(/[^/]*$/, ''))).href;
          }
          /* v2.5d-1 — bypass de caché en la URL del worker: los Workers se
           * instancian desde la copia EN CACHÉ del script (cache de disco y,
           * si existe, interceptación del service worker). Con python -m
           * http.server (que envía Last-Modified y responde 304) el navegador
           * podía seguir ejecutando una versión VIEJA del worker aunque el
           * archivo en disco ya estuviera corregido — causa exacta de que el
           * error "el bundle no exporta FaceLandmarker/FilesetResolver"
           * sobreviviera a los fixes v2.5c/v2.5d (ese mensaje ya no existe
           * en el código actual). El query ?v= fuerza una entrada de caché
           * nueva; type:'module' permite dynamic import dentro del worker. */
          try {
            var wu = new URL(wurl);
            wu.searchParams.set('v', String(Date.now()));
            wurl = wu.href;
          } catch (e) { /* URLs relativas degeneradas: se deja wurl intacta */ }
          try {
            worker = new Worker(wurl, { type: 'module' });
          } catch (eMod) {
            /* fallback defensivo: workers clásicos (clase sin dynamic import
             * propio; el nuestro usa import() de blobs, soportado también por
             * workers clásicos en Chrome/Firefox actuales) */
            worker = new Worker(wurl);
          }
        } catch (e) {
          reject(new Error('WorkerBackend: no se pudo crear el Worker — ' + e.message));
          return;
        }
        /* v2.5f — DIAGNÓSTICO DE VERSIÓN EJECUTADA: el worker se auto-anuncia
         * con {type:'meta', build} al instanciarse (antes del init). El host
         * contrasta ese build con WORKER_BUILD y con el sello leído del archivo
         * servido (preflight): tres fuentes —esperado/servido/en memoria— que
         * eliminan toda ambigüedad entre "bug en el código" y "copia cacheada
         * vieja ejecutándose". */
        var metaSeen = false;
        var settled = false;
        /* v2.5f — si tras 4 s el worker NUNCA se anunció con 'meta', es una
         * copia vieja (los builds nuevos siempre emiten meta al instanciarse)
         * o murió en tiempo de análisis: diagnóstico explícito, no silencio. */
        setTimeout(function () {
          if (!metaSeen && !disposed) {
            console.warn('[tracking][worker] sin anuncio de build tras 4 s → el script ejecutado es ANTERIOR a v2.5f ' +
              '(cache/SW/extensión) o falló al parsear. Borrar datos del sitio y recargar con Ctrl+Shift+R.');
          }
        }, 4000);
        var to = setTimeout(function () {
          if (settled) return;
          settled = true;
          terminateQuiet();
          reject(new Error('WorkerBackend: timeout de init (' + (config.initTimeoutMs || 15000) + ' ms)'));
        }, config.initTimeoutMs || 15000);

        worker.onmessage = function (ev) {
          var m = ev.data || {};
          if (m.type === 'meta') {
            metaSeen = true;
            if (m.build !== WORKER_BUILD) {
              console.warn('[tracking][worker] build en memoria=' + m.build +
                ' esperado=' + WORKER_BUILD + ' → el navegador ejecuta una copia VIEJA del worker ' +
                '(cache de disco / service worker registrado / extensión interceptora). ' +
                'Acción: DevTools → Application → Clear site data + Unregister service workers, o Chrome → Más herramientas → Borrar datos de navegación → "Imagen en caché" con "Todo el tiempo", y recarga con Ctrl+Shift+R.');
            } else {
              console.info('[tracking][worker] build=' + m.build + ' (versión actual en ejecución)');
            }
          } else if (m.type === 'ready') {
            clearTimeout(to);
            if (!settled) { settled = true; ready = true; resolve(); }
          } else if (m.type === 'result') {
            if (pending) {
              var r = pending; pending = null;
              lastTs = m.t || lastTs;
              r({ t: m.t, faces: m.faces || [] });
            }
          } else if (m.type === 'error') {
            clearTimeout(to);
            var err = new Error('WorkerBackend: ' + m.message);
            if (!settled) { settled = true; terminateQuiet(); reject(err); }
            else if (opts.onError) opts.onError(err);
          } else if (m.type === 'warning' && opts.onWarning) {
            opts.onWarning(new Error(m.message));
          }
        };
        worker.onerror = function (e) {
          clearTimeout(to);
          var err = new Error('WorkerBackend crash: ' + (e && e.message ? e.message : 'desconocido'));
          if (!settled) { settled = true; terminateQuiet(); reject(err); }
          else if (opts.onError) opts.onError(err);
        };
        worker.postMessage({ type: 'init', config: config });
        }).catch(function (e) {
          if (!settled) { settled = true; terminateQuiet(); reject(e); }
        });
      });
    }

    /** input: ImageBitmap (se TRANSFIERE y consume). Devuelve rawResult o vacío si cae. */
    function frame(input, t) {
      if (!ready || disposed || !worker) {
        if (input && input.close) input.close();
        return Promise.resolve({ t: t, faces: [] });
      }
      /* ts monótono estricto (detectForVideo lo exige): si el reloj retrocede, se descarta el frame. */
      if (t <= lastTs) {
        if (input && input.close) input.close();
        return Promise.resolve({ t: lastTs, faces: [] });
      }
      return new Promise(function (resolve) {
        var settled = false;
        var done = function (res) {
          if (settled) return;
          settled = true;
          pending = null;
          resolve(res);
        };
        pending = function (res) { done(res); };
        try {
          worker.postMessage({ type: 'frame', bitmap: input, t: t }, [input]);
        } catch (e) {
          if (input && input.close) input.close();
          done({ t: t, faces: [] });
          return;
        }
        /* Red de seguridad: worker colgado ⇒ no bloquear el bucle de animación. */
        setTimeout(function () { done({ t: t, faces: [] }); }, 1000);
      });
    }

    function terminateQuiet() {
      if (worker) {
        try { worker.terminate(); } catch (e) { /* noop */ }
        worker = null;
      }
      ready = false;
    }

    function dispose() {
      disposed = true;
      if (worker) { try { worker.postMessage({ type: 'dispose' }); } catch (e) { /* noop */ } }
      terminateQuiet();
      pending = null;
    }

    return { kind: 'worker', init: init, frame: frame, dispose: dispose };
  }

  /* ---------------- MainThreadBackend ---------------- */

  function MainThreadBackend(opts) {
    opts = opts || {};
    var landmarker = null;
    var lastTs = 0;

    async function init(config) {
      if (!T.MpLoader) throw new Error('MainThreadBackend: cargue primero src/tracking/MpLoader.js');
      landmarker = await T.MpLoader.createLandmarker(config || {});
    }

    /** input: HTMLVideoElement directamente (sin copia a canvas). */
    async function frame(input, t) {
      if (!landmarker || !input) return { t: t, faces: [] };
      if (t <= lastTs) return { t: lastTs, faces: [] };
      try {
        var res = landmarker.detectForVideo(input, t);
        lastTs = t;
        return {
          t: t,
          faces: (res.faceLandmarks || []).map(function (lm) {
            var out = new Array(lm.length);
            for (var i = 0; i < lm.length; i++) out[i] = [lm[i].x, lm[i].y];
            return { lm: out };
          })
        };
      } catch (e) {
        if (opts.onError) opts.onError(e);
        return { t: t, faces: [] };
      }
    }

    function dispose() {
      if (landmarker && landmarker.close) landmarker.close();
      landmarker = null;
    }

    return { kind: 'main', init: init, frame: frame, dispose: dispose };
  }

  /**
   * Selección automática (feature detection, no version detection — D16):
   * Worker + ImageBitmap disponibles → worker; si no, hilo principal.
   */
  function autoKind() {
    return (typeof Worker !== 'undefined' && typeof createImageBitmap !== 'undefined')
      ? 'worker' : 'main';
  }

  function create(kind, opts) {
    var k = kind === 'auto' || kind == null ? autoKind() : kind;
    if (k === 'worker') return WorkerBackend(opts);
    if (k === 'main') return MainThreadBackend(opts);
    throw new Error('Backends.create: backend desconocido "' + k + '" (esperado "worker"|"main"|"auto")');
  }

  T.Backends = {
    WorkerBackend: WorkerBackend,
    MainThreadBackend: MainThreadBackend,
    autoKind: autoKind,
    create: create
  };
})(typeof window !== 'undefined' ? window : globalThis);
