// rostro_animado/src/tracking/TrackingBridge.js
/* ============================================================
 * TrackingBridge.js — Orquestador del seguimiento facial.
 *
 *   MM_Media (cámara, permisos)  →  backend (Worker|Main)  →  Filters
 *                                                            (One Euro)
 *                                   ↓
 *                          EngineAdapter → motor MoodMates
 *
 * FSM de PRESENCIA (D11 fusionado): IDLE → ACQUIRING → ACTIVE ⇄ LOST, ERROR.
 * La FSM SOLO gestiona presencia: NO decide emociones de reposo/sueño por
 * tiempo (eso ya lo hace el motor vía opts.idle standbyAfter/sleepAfter);
 * mientras hay rostro el bridge llama resetIdle() y el reloj de inactividad
 * se reinicia solo. M6 del plan queda absorbido.
 *
 * Emociones: MM_EmotionPolicy (mapa tracking inyectable + validación exists).
 * Exclusión mutua D13: al arrancar/parar se notifica 'tracking-state' para
 * que el host conmute policy.setOwner('tracking'|'call').
 *
 * Gaze/párpados/yaw (fusiones 5-6): setGaze con {source:'tracker', priority:10}
 * (el árbitro del motor da prioridad al tracker sobre el puntero), setEyeOpen
 * [0,1] o null, setLookYaw(rad) por canal propio lookYaw — body.yaw sigue
 * reservado para spin/fx.
 * ============================================================ */
(function (global) {
  'use strict';

  var T = (global.MM_Tracking = global.MM_Tracking || {});

  var STATES = ['IDLE', 'ACQUIRING', 'ACTIVE', 'LOST', 'ERROR'];
  var TRACKER_PRIORITY = 10;    /* > puntero (1) — árbitro del motor */

  function requireFilters() {
    if (!T.Filters) throw new Error('MM_Tracking: cargue primero src/tracking/Filters.js');
    return T.Filters;
  }

  /* ---------------- EngineAdapter (D16: fachada de capacidades) ---------------- */

  /**
   * Adapta una instancia MoodMates a las necesidades del tracker SIN asumir
   * versión del motor: feature detection puro. Motores antiguos simplemente
   * pierden párpados/pose (no-op) pero conservan la mirada.
   */
  T.EngineAdapter = function (mate) {
    if (!mate || typeof mate.handleAIMessage !== 'function') {
      throw new Error('EngineAdapter: se requiere una instancia del motor MoodMates');
    }
    return {
      mate: mate,   /* referencia para que el host detecte cambios de instancia */
      setGaze: function (x, y, meta) {
        mate.setGaze(x, y, meta || { source: 'tracker', priority: TRACKER_PRIORITY });
      },
      clearGaze: function (meta) {
        mate.clearGaze(meta || { source: 'tracker' });
      },
      setEyeOpen: typeof mate.setEyeOpen === 'function'
        ? function (v) { mate.setEyeOpen(v); }
        : function () {},
      setLookYaw: typeof mate.setLookYaw === 'function'
        ? function (rad) { mate.setLookYaw(rad); }
        : function () {},
      handleAIMessage: function (msg) { return mate.handleAIMessage(msg); },
      resetIdle: function () { if (typeof mate.resetIdle === 'function') mate.resetIdle(); },
      hasEyeControl: typeof mate.setEyeOpen === 'function',
      hasPoseChannel: typeof mate.setLookYaw === 'function'
    };
  };

  /* ---------------- Factoría del bridge ---------------- */

  /**
   * @param {Object} opts
   *   mate            instancia MoodMates (obligatoria)
   *   media           MediaDeviceManager existente → usa startTrackingCamera (D14)
   *   stream          MediaStream externo compartido (modo overlay de llamada)
   *   videoElement    <video> propio del host (si quiere ver el feed)
   *   policy          MM_EmotionPolicy.create(...) — si falta se crea default
   *   constraints     { width, height, frameRate } para la cámara de tracking
   *   deviceId        cámara concreta para tracking (opcional)
   *   backend         'auto'|'worker'|'main'
   *   workerUrl       ruta del track.worker.js (default 'src/tracking/track.worker.js')
   *   loader          override MpLoader {bundleUrl, wasmPaths, modelPath, modelBuffer, cdnBase}
   *   delegate        'GPU'|'CPU' (default GPU con fallback CPU automático)
   *   lostAfterMs     sin rostro N ms → LOST (default 800)
   *   probeEveryMs    frecuencia de sondeo en LOST/ERROR (default 500)
   *   earClosed / earOpen  umbrales de calibración EAR (default 0.06/0.22)
   *   mirror          espejar horizontalmente (default true)
   *   oneEuro         { minCutoff, beta, dCutoff } (default 1.0/0.007/1.0)
   *   onState(evt,data)/onError(err)  atajos además de .on()
   */
  T.create = function (opts) {
    opts = opts || {};
    var F = requireFilters();
    if (!opts.mate) throw new Error('MM_Tracking.create: opts.mate es obligatorio');

    var adapter = T.EngineAdapter(opts.mate);
    var policy = opts.policy ||
      (global.MM_EmotionPolicy && global.MM_EmotionPolicy.create({
        tracking: opts.trackingMap,
        exists: global.MoodMates && global.MoodMates.config
          ? function (id) { return !!global.MoodMates.config.getRaw(id); }
          : null
      }));
    if (!policy) throw new Error('MM_Tracking.create: no hay MM_EmotionPolicy disponible (cargue src/media/EmotionPolicy.js)');

    var lostAfterMs = opts.lostAfterMs != null ? opts.lostAfterMs : 800;
    var probeEveryMs = opts.probeEveryMs != null ? opts.probeEveryMs : 500;
    var earClosed = opts.earClosed != null ? opts.earClosed : 0.06;
    var earOpen = opts.earOpen != null ? opts.earOpen : 0.22;
    var mirror = opts.mirror !== false;
    /* v2.5 — modo de mirada (decisión de producto):
     *   'attend' (default): el avatar MIRAL AL USUARIO — la posición del rostro
     *     dentro del encuadre se mapea a gaze objetivo y giro de cabeza. Con
     *     webcam espejada, moverse a la derecha del encuadre → el bot mira y
     *     gira a su derecha (coincidencia visual directa con el usuario).
     *   'mimic': copia la dirección de mirada/yaw del usuario (plan D7/D10
     *     original; el avatar imita en vez de atender).
     * irisGaze/yawFromLandmarks devuelven HACIA DÓNDE mira/gira la persona, no
     * DÓNDE está: en 'attend' esas señales se ignoran para gaze/yaw y manda la
     * geometría del rostro en el frame. El parpadeo (EAR) sigue siendo imitación
     * en ambos modos (único canal mimic por diseño). */
    var mode = (opts.mode === 'mimic') ? 'mimic' : 'attend';
    /* 2a FIX — API canónica de parches.md §2a: attendGain (ganancia única) y
     * attendYaw (tope de yaw). Los nombres específicos v2.5 (attendGainX/Y,
     * attendYawK) quedan como overrides opcionales con prioridad si se pasan. */
    var attendGain = opts.attendGain != null ? +opts.attendGain : 1.5;
    var attendYaw = opts.attendYaw != null ? +opts.attendYaw : 0.45;
    var attendGainX = opts.attendGainX != null ? +opts.attendGainX : attendGain;
    var attendGainY = opts.attendGainY != null ? +opts.attendGainY : attendGain * 0.9;
    var attendYawK = opts.attendYawK != null ? +opts.attendYawK : 1;
    var oe = opts.oneEuro || {};
    function dz(v) { return Math.abs(v) < 0.04 ? 0 : v; }
    function absUrl(u) { try { return new URL(u, document.baseURI).href; } catch (e) { return u; } }

    var state = 'IDLE';
    /* v2.5 — epoch/generación: si destroy() ocurre durante start() (await de
     * backend.init/acquireStream), las promesas en vuelo y el rAF del ciclo
     * anterior deben autodescartarse; sin esto quedaba cámara abierta + bridge
     * fantasma inferenciando contra un mate destruido. */
    var epoch = 0;
    var listeners = [];
    var rafId = 0;
    var stopped = true;
    var lastSeenAt = 0;
    var lastProbeAt = 0;
    var inflight = false;
    var backend = null;
    var ownStream = !opts.stream;   /* ¿gestionamos la cámara o compartimos la del host? */

    var bank = F.oneEuroBank(['gx', 'gy', 'open', 'yaw'],
      oe.minCutoff != null ? oe.minCutoff : 1.0,
      oe.beta != null ? oe.beta : 0.007,
      oe.dCutoff != null ? oe.dCutoff : 1.0);

    /* Selección de rostro objetivo (plan §3). opts.selector permite inyectar
     * una política propia (mock en tests / VAD externo); opts.maxFaces>1 activa
     * el FaceSelector por defecto; maxFaces===1 lo desactiva (v2.3 clásico). */
    var selector = null;
    if (typeof opts.selector === 'object' && opts.selector && typeof opts.selector.select === 'function') {
      selector = opts.selector;                       /* política inyectada por el host */
    } else if (T.FaceSelector && (opts.maxFaces == null ? 3 : opts.maxFaces) > 1) {
      selector = T.FaceSelector.create(Object.assign(
        { maxFaces: opts.maxFaces != null ? opts.maxFaces : 3 },
        opts.selectorOpts || {}));
    } else {
      selector = null;                                 /* cara 0 clásico (v2.3) */
    }

    /* ---- vídeo de captura (oculto salvo que el host dé uno visible) ---- */
    var video = opts.videoElement || document.createElement('video');
    if (!opts.videoElement) {
      video.muted = true; video.playsInline = true; video.autoplay = true;
      /* v2.5 FIX — era opacity:0 SIN position:absolute: un <video> con stream
       * activo ocupa flujo normal, empujaba el layout del stage y en algunos
       * navegadores se autorretrataba sobre la escena. 1px + aria-hidden basta. */
      video.style.position = 'absolute';
      video.style.left = '-9999px';
      video.style.top = '0';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      document.body.appendChild(video);
    }
    video.setAttribute('aria-hidden', 'true');

    var canvas = document.createElement('canvas');
    canvas.width = opts.captureWidth || 320;
    canvas.height = opts.captureHeight || 240;
    var ctx = canvas.getContext('2d');

    /* ---- eventos ---- */
    function emit(evt, data) {
      listeners.slice().forEach(function (fn) {
        try { fn(evt, data); } catch (e) { console.error('[MM_Tracking]', e); }
      });
    }

    function setState(s, why) {
      if (s === state) return;
      var prev = state;
      state = s;
      var payload = { from: prev, to: s, reason: why || null };
      emit('state', payload);
      /* D13 exclusión mutua: el host decide cómo propagar el owner; se expone
       * como evento para que app/call.js haga policy.setOwner(...) y reacciones. */
      emit('tracking-state', payload);
      /* v2.3.1 — Señales emocionales SOLO si el bridge es dueño del bot (D13)
       * y hay política configurada. Antes se emitía handleAIMessage en todo
       * start/stop/lost: en modo standalone (sin backend de IA) eso secuestraba
       * la expresión del personaje con '03'/'02' arbitrarios y reiniciaba
       * transiciones — el usuario veía la animación "luchar" contra el tracker.
       * opts.signals:false desactiva por completo las señales de emoción. */
      /* Owner por defecto 'call': si nadie gestiona el owner (modo standalone),
       * las señales de emoción se suprimen — el tracking solo mueve mirada,
       * párpados y giro de cabeza, nunca la expresión. */
      /* parches.md §2b — señales de emoción ahora son OPT-IN: solo con
       * opts.signals === true explícito (y política + owner 'tracking').
       * false/undefined → el tracking jamás toca la expresión. */
      var emotional = opts.signals === true && !!policy;
      if (s === 'LOST') {
        if (emotional && policy.owner() === 'tracking') {
          adapter.handleAIMessage({ emotionId: policy.tracking('lost') });
        }
        adapter.setEyeOpen(null);
        adapter.clearGaze({ source: 'tracker' });
        adapter.setLookYaw(0);
      } else if (s === 'ERROR') {
        if (emotional && policy.owner() === 'tracking') {
          adapter.handleAIMessage({ emotionId: policy.tracking('error') });
        }
        emit('error', { message: why || 'error de tracking' });
      } else if (s === 'ACTIVE' && prev === 'LOST') {
        /* Recuperación desde LOST: semilla 'present'. Desde ACQUIRING NO se
         * emite — al arrancar, el motor ya está en su estado natural. */
        if (emotional && policy.owner() === 'tracking') {
          adapter.handleAIMessage({ emotionId: policy.tracking('present') });
        }
      }
    }

    /* ---- procesamiento de un resultado crudo del backend ---- */
    function onFrame(raw) {
      if (stopped) return;
      var now = performance.now();
      if (!raw || !raw.faces || !raw.faces.length) {
        if ((state === 'ACTIVE' || state === 'ACQUIRING') && now - lastSeenAt > lostAfterMs) {
          setState('LOST', 'timeout-presencia');
        }
        return;
      }
      lastSeenAt = now;
      if (state !== 'ACTIVE') setState('ACTIVE', 'rostro-detectado');

      /* Selección multi-cara (plan §3): FaceSelector decide el objetivo con
       * histéresis; sin módulo cargado se degrada a cara 0 (comportamiento v2.3). */
      var selectedFace = raw.faces[0];
      if (selector) {
        var pick = selector.select(raw.faces, now);
        if (!pick) return;                       /* sin caras evaluables este frame */
        if (pick.switched) emit('face-switch', { index: pick.index, score: pick.score });
        selectedFace = pick.face;
      }
      var lmArr = selectedFace.lm.map(function (p) { return { x: p[0], y: p[1] }; });

      var earL = F.eyeAspectRatio(lmArr, 'left');
      var earR = F.eyeAspectRatio(lmArr, 'right');
      var openAvg = F.opennessFromEAR((earL + earR) / 2, earClosed, earOpen);

      var gazeX, gazeY, yawOut;
      if (mode === 'mimic') {
        var gazeL = F.irisGaze(lmArr, 'left');
        var gazeR = F.irisGaze(lmArr, 'right');
        /* Convención de signo (v2.3.2): el escenario NO aplica scaleX(-1) al
         * personaje, así que la pantalla coincide con las coordenadas crudas de
         * la cámara. irisGaze ya devuelve x en coordenadas de CABEZA (el ojo
         * derecho se voltea internamente con sx=-1): NO volver a invertir. */
        var pose = F.yawFromLandmarks(lmArr, false);
        yawOut = mirror ? -pose.yaw : pose.yaw;
        gazeX = (gazeL.x + gazeR.x) / 2;
        gazeY = (gazeL.y + gazeR.y) / 2;
      } else {
        /* attend/parches.md §2c: dónde ESTÁ la persona en el encuadre → hacia
         * dónde mira/gira el avatar. cx/cy normalizados [0,1] sobre los
         * landmarks de la cara seleccionada; sesgo vertical a 0.45 (parches.md
         * §2c) porque los rostros suelen quedar algo por encima del centro. */
        var minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (var li = 0; li < lmArr.length; li++) {
          var p = lmArr[li];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        /* 2c FIX — fórmula canónica de parches.md §2c: nx/ny centrados y
         * multiplicados por 2; ex espejado derivado de nx (con mirror=true,
         * nx ya está espejado → ex = -nx coincide con el comportamiento v2.5). */
        var nx = ((cx - 0.5) * 2);
        var ny = ((cy - 0.45) * 2);
        if (mirror) nx = -nx;
        gazeX = dz(nx * attendGainX);
        gazeY = dz(ny * attendGainY * 0.9);
        /* 2a FIX — tope de giro = attendYaw (defecto 0.45), aplicado tras
         * clamp(gazeX,-1,1), idéntico a parches.md §2c. La ganancia angular
         * del patch es 1; solo un override explícito attendYawK la modifica. */
        yawOut = F.clamp(gazeX * attendYawK, -1, 1) * attendYaw;   /* gira la cabeza hacia la persona */
      }
      var g = F.sanitizeVec(gazeX, gazeY);

      var f = bank.filter(now / 1000, { gx: g.x, gy: g.y, open: openAvg, yaw: yawOut });
      var s = F.sanitizeVec(f.gx, f.gy);

      adapter.setGaze(s.x, s.y, { source: 'tracker', priority: TRACKER_PRIORITY });
      adapter.setLookYaw(F.clamp(f.yaw, -0.6, 0.6));
      adapter.setEyeOpen(F.clamp(f.open, 0, 1));
      adapter.resetIdle();          /* fusión D11/M6: presencia ≠ emoción; el motor decide tiempos */
    }

    /* ---- bucle rAF con backpressure de 1 inferencia en vuelo ---- */
    async function loop() {
      if (stopped) return;
      rafId = requestAnimationFrame(loop);
      if (inflight || !backend) return;
      if (video.readyState < 2) return;
      if (state === 'LOST' || state === 'ERROR') {
        var n = performance.now();
        if (n - lastProbeAt < probeEveryMs) return;
        lastProbeAt = n;
      }
      inflight = true;
      var myEpoch = epoch;
      try {
        var t = performance.now();
        var raw;
        if (backend.kind === 'worker') {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          var bmp = await createImageBitmap(canvas);
          raw = await backend.frame(bmp, t);
        } else {
          raw = await backend.frame(video, t);
        }
        /* v2.5 — puente destruido/reiniciado durante la inferencia en vuelo:
         * descartar resultado y detener este ciclo (no tocar mates viejos). */
        if (myEpoch !== epoch || stopped) return;
        onFrame(raw);
      } catch (e) {
        if (myEpoch === epoch && !stopped && state !== 'ERROR') {
          setState('ERROR', String((e && e.message) || e));
        }
      } finally {
        if (myEpoch === epoch) inflight = false;
      }
    }

    /* ---- adquisición de stream (D14: siempre a través de MM_Media cuando existe) ---- */
    async function acquireStream() {
      if (opts.stream) {
        video.srcObject = opts.stream;
        ownStream = false;
        return;
      }
      if (opts.media && typeof opts.media.startTrackingCamera === 'function') {
        /* Camino canónico: segunda CameraManager dentro de MM_Media —
         * permisos, getUserMedia inyectable y eventos ya resueltos allí. */
        video.srcObject = await opts.media.startTrackingCamera(opts.constraints, opts.deviceId);
        return;
      }
      /* Sin MM_Media (páginas de demo): getUserMedia directo con constraints
       * bajos; el consentimiento lo debe haber gestionado el host antes. */
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia no disponible y no se proveyó opts.media/stream');
      }
      var stream = await navigator.mediaDevices.getUserMedia({
        video: Object.assign({ facingMode: 'user' }, opts.constraints || { width: 320, height: 240, frameRate: 30 }),
        audio: false
      });
      video.srcObject = stream;
    }

    function releaseStream() {
      if (!ownStream) return;
      if (opts.media && typeof opts.media.stopTrackingCamera === 'function') {
        opts.media.stopTrackingCamera();
      } else if (video.srcObject) {
        video.srcObject.getTracks().forEach(function (tr) { tr.stop(); });
      }
      video.srcObject = null;
    }

    /* ---- ciclo de vida ---- */
    var bridge = {
      states: STATES,
      get state() { return state; },
      get kind() { return backend ? backend.kind : null; },
      adapter: adapter,
      policy: policy,

      on: function (fn) {
        if (typeof fn === 'function') listeners.push(fn);
        return bridge;
      },

      start: async function () {
        if (state === 'ACQUIRING' || state === 'ACTIVE') return;
        epoch++;                          /* v2.5 — invalida ciclos anteriores */
        var myEpoch = epoch;
        setState('ACQUIRING', 'start');
        try {
          /* v2.5 FIX — cfg sin hardcodear rutas relativas duplicadas: se parte
           * de la VENDOR_BASE resuelta por MpLoader (absoluta de origen), que
           * también usa el MainThreadBackend y el worker para wasm/bundle. */
          var vendor = (T.MpLoader && T.MpLoader.VENDOR_BASE) || 'assets/vendor/mediapipe/';
          var cfg = Object.assign({
            bundleUrl: vendor + 'vision_bundle.mjs',
            wasmPaths: vendor + 'wasm/',
            modelPath: vendor + 'face_landmarker.task',
            delegate: opts.delegate || 'GPU',
            numFaces: selector ? (opts.maxFaces != null ? opts.maxFaces : 3) : 1,
            /* v2.3.2 — umbrales bajados de 0.5 (default) a 0.3: con iluminación
             * mediocre/webcams de portátil el detector por debajo de 0.5 no
             * entregaba caras y el bridge nunca llegaba a ACTIVE ("no sigue el
             * rostro" sin ningún error en consola). */
            minFaceDetectionConfidence: opts.minFaceDetectionConfidence != null ? opts.minFaceDetectionConfidence : 0.3,
            minTrackingConfidence: opts.minTrackingConfidence != null ? opts.minTrackingConfidence : 0.3
          }, opts.loader || {});
          /* Normalización de claves: MpLoader usa modelPath; el worker usa
           * modelUrl. Sin esto, en el camino Worker el landmarker se creaba sin
           * modelo (modelAssetPath undefined) y la inferencia devolvía 0 caras:
           * "no sigue el rostro" incluso con todo lo demás correcto. */
          cfg.modelUrl = cfg.modelUrl || cfg.modelPath;
          /* parches.md §2d — las URLs relativas dentro del Worker se resolvían
           * contra src/tracking/track.worker.js (404 de bundle/WASM/modelo).
           * Se pasan absolutas. */
          ['bundleUrl', 'wasmPaths', 'modelPath', 'modelUrl'].forEach(function (k) {
            if (typeof cfg[k] === 'string') cfg[k] = absUrl(cfg[k]);
          });
          backend = T.Backends
            ? T.Backends.create(opts.backend || 'auto', {
                workerUrl: opts.workerUrl,
                onError: function (e) { emit('warning', { message: e.message }); },
                /* F4 FIX — onWarning propagado: sin esto se perdía el aviso del
                 * worker (p. ej. caída de GPU→CPU en MediaPipe). */
                onWarning: function (e) { emit('warning', { message: e.message }); }
              })
            : null;
          if (!backend) throw new Error('cargue primero src/tracking/Backends.js');
          try {
            await backend.init(cfg);
          } catch (eInit) {
            /* v2.5f — FALLBACK AUTOMÁTICO WORKER→MAIN: si el worker falla por
             * cualquier causa del path de carga (cache obsoleta, SW, MIME,
             * grafo de módulos envenenado), se reintenta en el hilo principal
             * vía MpLoader (mismo pipeline validado, solo cambia el hilo de
             * inferencia). El seguimiento queda FUNCIONAL y el diagnóstico del
             * worker original se conserva en consola. opts.backend==='worker'
             * explícito desactiva el fallback (modo estricto de depuración). */
            var kindWanted = opts.backend || 'auto';
            if (kindWanted !== 'worker' && T.MpLoader) {
              console.warn('[MM_Tracking] WorkerBackend falló (' + ((eInit && eInit.message) || eInit) +
                ') → reintentando con MainThreadBackend (fallback v2.5f).');
              if (backend) { try { backend.dispose(); } catch (er) {} }
              backend = T.Backends.create('main', { onError: function (e) { emit('warning', { message: e.message }); } });
              await backend.init(cfg);
              emit('warning', { message: 'tracking en hilo principal (worker no disponible)' });
            } else {
              throw eInit;
            }
          }
          /* F1 FIX — `|| stopped` eliminado: `stopped` vale true por diseño hasta
           * el final de start(), por lo que la comprobación cancelaba SIEMPRE el
           * arranque tras init() con éxito (state='IDLE' silencioso, toast falso).
           * La invalidación legítima de stop()/destroy() en vuelo la gestiona el
           * epoch (§2e). El catch de cancelación hace teardown completo y setState. */
          if (myEpoch !== epoch) throw new Error('__cancelled__');
          await acquireStream();
          if (myEpoch !== epoch) throw new Error('__cancelled__');
          await video.play();
          if (myEpoch !== epoch) throw new Error('__cancelled__');
          stopped = false;
          lastSeenAt = performance.now();
          loop();
        } catch (e) {
          if (String((e && e.message) || e) === '__cancelled__') {
            /* destroy()/stop() durante el arranque: teardown completo aquí,
             * NO propagar rechazo al caller (no es un fallo, es una cancelación). */
            if (backend) { try { backend.dispose(); } catch (er) {} backend = null; }
            releaseStream();
            state = 'IDLE';
            return;
          }
          stopped = true;
          setState('ERROR', String((e && e.message) || e));
          if (backend) { try { backend.dispose(); } catch (er) {} backend = null; }
          releaseStream();               /* v2.5 — no dejar LED encendido tras fallo */
          throw e;
        }
      },

      stop: function (stopOpts) {
        epoch++;                          /* v2.5 — descarta work en vuelo */
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (backend) { backend.dispose(); backend = null; }
        /* v2.5 — con stream compartido (opts.stream, sin cámara propia) NO se
         * libera nada salvo que el host lo fuerce explícitamente: stop() de un
         * bridge prestado no debe apagar la webcam de la llamada. */
        if ((stopOpts && stopOpts.force) || ownStream) releaseStream();
        bank.reset();
        adapter.setEyeOpen(null);
        adapter.clearGaze({ source: 'tracker' });
        adapter.setLookYaw(0);
        setState('IDLE', 'stop');
      },

      /* Overlay de llamada: suspende sin destruir (stream compartido) o libera
       * la cámara propia si es exclusiva (evita dos luces LED encendidas). */
      suspend: function () {
        if (ownStream) { bridge.stop(); return; }
        epoch++;                                /* v2.5 — descarta frame en vuelo */
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        setState('LOST', 'suspendido-por-llamada');
      },
      resume: function () {
        if (ownStream) { bridge.start().catch(function () { /* ERROR ya emitido */ }); return; }
        if (stopped && backend) {               /* v2.5 — sin backend no hay nada que reanudar */
          stopped = false;
          lastSeenAt = performance.now();
          setState('ACQUIRING', 'resume');
          loop();
        } else if (stopped) {
          bridge.start().catch(function () { /* ERROR ya emitido */ });
        }
      },

      /* API pública de remapeo (pregunta abierta §7.1 del plan → resuelta sí): */
      setEmotionMap: function (patch) {
        policy.setTrackingMap(patch);
        return bridge;
      },

      /* Reancla el motor objetivo sin reiniciar cámara ni recargar MediaPipe.
       * Uso: cambio de personaje (createMain destruye la instancia vieja).
       * Libera los canales del mate viejo (puede estar ya destruido: try/catch),
       * valida el nuevo contra EngineAdapter y conmuta la referencia atómica. */
      rebindMate: function (newMate) {
        var next = T.EngineAdapter(newMate);   /* throws si no es un motor válido */
        var old = adapter.mate;
        if (old && old !== newMate) {
          try {
            old.clearGaze({ source: 'tracker' });
            if (typeof old.setEyeOpen === 'function') old.setEyeOpen(null);
            if (typeof old.setLookYaw === 'function') old.setLookYaw(0);
          } catch (e) { /* instancia ya destruida: nada que liberar */ }
        }
        adapter = next;
        bank.reset();
        emit('rebind', { mate: newMate });
        return bridge;
      },

      /* Inyección VAD/diarización (plan §3, contrato desacoplado): hint = key o
       * índice de la cara activa, level ∈ [0,1]. Delega en FaceSelector si hay. */
      setVoiceActivity: function (hint, level) {
        if (selector && typeof selector.setVoiceActivity === 'function') {
          selector.setVoiceActivity(hint, level);
        }
        return bridge;
      },
      get lockedFaceKey() { return selector ? selector.lockedKey : null; },

      /* v2.5 — acceso al stream de captura (propio o compartido) para hosts
       * que quieran mostrar preview o compartirlo con un segundo bridge
       * (cero doble captura, plan §3). */
      getStream: function () { return video.srcObject || null; },

      destroy: function () {
        /* v2.5 — stop() liberaba la cámara SIEMPRE, incluso con opts.stream
         * compartido (llamada): colgaba el vídeo local del usuario en plena
         * videollamada. El bridge propio solo es dueño de lo que él abrió;
         * force=true (host que se apaga explícitamente) libera igualmente. */
        var ownStreamNow = ownStream;
        bridge.stop({ force: true });
        if (ownStreamNow) releaseStream();
        if (selector && typeof selector.reset === 'function') selector.reset();
        listeners.length = 0;
        if (!opts.videoElement && video.parentNode) video.parentNode.removeChild(video);
      }
    };

    if (opts.onError) bridge.on(function (evt, data) { if (evt === 'error') opts.onError(data); });
    if (opts.onState) bridge.on(function (evt, data) { if (evt === 'state') opts.onState(data); });

    return bridge;
  };
})(typeof window !== 'undefined' ? window : globalThis);
