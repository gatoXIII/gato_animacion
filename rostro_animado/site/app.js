/* ============================================================
 * app.js —— Capa de interacción (shell del sitio de la galería, depende del SDK MoodMates + MM_I18N + MM_Tracking)
 *
 * Responsabilidades:
 *   Hero de apertura (personaje de línea semioculto + auto-giro de entrada + pausa en viewport)
 *   Fila de personajes (personajes originales, clicar para cambiar toda la galería)
 *   Doble vista (muro / pasillo de álbum) + paginación con flechas / teclado
 *   Pestañas de agrupación, flujo de miniaturas, recorrido automático
 *   Cajón de configuración (personaje / línea de boceto / recorrido / simulación AI / importar/exportar)
 *   Seguimiento facial (atención visual) ligado EXCLUSIVAMENTE al avatar principal `main`
 *   Bilingüe español/inglés, temas claro/oscuro, persistencia en localStorage
 *
 * Mirada: la ÚNICA fuente de mirada es el tracker de cámara (MM_Tracking).
 * No existe simulación por puntero: sin tracking el avatar no sigue al ratón.
 *
 * Emociones: gobernadas por IA/backend (handleAIMessage). El tracker nunca las toca.
 * ============================================================ */
(function () {
  'use strict';

  var MM = window.MoodMates;
  var I = window.MM_I18N;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Lectura y escritura de preferencias ---------------- */
  var PREF_KEY = 'mm.prefs';
  var prefs = { lang: 'es', theme: 'dark', mode: 'wall', character: 'nimbo', sketch: false, tourMs: 2500, variants: {} };
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
  } catch (e) { /* preferencias dañadas, usar valores por defecto */ }
  if (!MM.characters.get(prefs.character)) prefs.character = MM.characters.defaultId();
  if (!prefs.variants || typeof prefs.variants !== 'object') prefs.variants = {};
  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* modo privado, ignorar */ }
  }
  /* NOTA de privacidad: el estado del tracking NO se persiste. La cámara solo se
   * enciende por una acción explícita del usuario en cada sesión. */

  /* ---------------- Referencias DOM ---------------- */
  var elStage = $('stage');
  var elTips = $('tips');
  var elEmoId = $('emoId');
  var elEmoName = $('emoName');
  var elEmoDesc = $('emoDesc');
  var elPager = $('pager');
  var elTabs = $('tabs');
  var elThumbZone = $('thumbZone');
  var elThumbFlow = $('thumbFlow');
  var elCastRow = $('castRow');
  var elToast = $('toast');
  var elDrawer = $('drawer');
  var elDrawerMask = $('drawerMask');
  var elTourToggle = $('tourToggle');
  var elTourInterval = $('tourInterval');
  var elSketchToggle = $('sketchToggle');
  var elCharSelect = $('charSelect');
  var elVariantField = $('variantField');
  var elVariantSelect = $('variantSelect');
  var elAiInput = $('aiInput');
  var elLangToggle = $('langToggle');
  var elThemeToggle = $('themeToggle');
  var elTrackToggle = $('faceTrackToggle');
  var elTrackBadge = $('trackBadge');

  /* ---------------- Estado del sitio ---------------- */
  var currentTab = 'all';
  var selectedId = '02';
  var thumbs = [];            /* [{ id, def, engine, cell, nameSpan }] */
  var cellById = new Map();
  var castCards = [];         /* [{ id, btn, nameEl, indEl, ch }] */
  var main = null;
  var hero = null;
  var tipsTimer = 0;
  var toastTimer = 0;
  var lastErrorAt = -1;

  /* ---------------- Utilidades de texto ---------------- */
  function dispName(def) {
    return I.lang === 'en' && def.en && def.en.name ? def.en.name : def.name;
  }
  function dispDesc(def) {
    return I.lang === 'en' && def.en && def.en.desc ? def.en.desc : (def.desc || '');
  }
  function groupName(g) {
    return I.lang === 'en' ? (g.en || g.name) : g.name;
  }
  function charName(ch) {
    return I.lang === 'en' && ch.en && ch.en.name ? ch.en.name : ch.name;
  }

  /* ---------------- Toast ---------------- */
  function toast(text, kind) {
    clearTimeout(toastTimer);
    elToast.textContent = text;
    elToast.className = 'toast show' + (kind ? ' ' + kind : '');
    toastTimer = setTimeout(function () { elToast.className = 'toast'; }, 3600);
  }

  /* ---------------- Burbuja de tips ---------------- */
  function showTips(text) {
    clearTimeout(tipsTimer);
    elTips.textContent = text;
    elTips.classList.add('show');
    tipsTimer = setTimeout(function () { elTips.classList.remove('show'); }, 3200);
  }

  /* ============================================================
   *  SEGUIMIENTO FACIAL — ciclo de vida
   *
   *  Propiedad de los recursos:
   *    · La APP es dueña de la cámara (track.stream, una sola captura).
   *    · El PUENTE (TrackingBridge) es dueño del worker + bucle rAF y recibe el
   *      stream por opts.stream → nunca abre ni cierra la cámara por su cuenta.
   *    · El puente se destruye y recrea en cada cambio de avatar / variante;
   *      la captura se conserva SOLO durante ese relevo (sin segunda captura)
   *      y se libera al apagar el tracking, ante error o al cerrar la página.
   *
   *  Reparto de canales (aislamiento estricto):
   *    · Tracker  → setGaze / setEyeOpen / setLookYaw
   *    · IA       → emoción + boca (handleAIMessage)
   *    · signals:false → "rostro detectado/perdido" NUNCA emite emociones
   * ============================================================ */
  var TRACK_CAPTURE = { width: 320, height: 240, frameRate: 30 };
  var track = {
    enabled: false,             /* intención del usuario */
    suspended: false,           /* cedido a la videollamada */
    wasActiveBeforeCall: false,
    bridge: null,
    media: null,                /* MM_Media.MediaDeviceManager dedicado al tracking */
    stream: null,               /* única captura de cámara */
    seq: 0,                     /* generación: descarta callbacks de puentes ya destruidos */
    state: 'IDLE',
    error: ''
  };
  var acquirePromise = null;    /* single-flight de getUserMedia */
  var callBridgeRef = null;

  /** Devuelve la clave i18n del primer requisito que falte, o null si todo está disponible. */
  function trackPrecheck() {
    if (location.protocol === 'file:') return 'trackErrFile';
    if (!window.MM_Tracking || typeof MM_Tracking.create !== 'function' ||
        !MM_Tracking.Filters || !MM_Tracking.Backends) return 'trackErrModules';
    if (!window.MM_SHARED_POLICY) return 'trackErrModules';
    if (!window.MM_Media || !MM_Media.supportsMediaDevices()) return 'trackErrInsecure';
    return null;
  }

  function describeTrackError(e) {
    var name = e && e.name;
    var msg = (e && e.message) || String(e);
    if (name === 'NotAllowedError' || name === 'SecurityError') return I.t('trackErrDenied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return I.t('trackErrNoCam');
    if (name === 'NotReadableError' || name === 'AbortError') return I.t('trackErrBusy');
    return I.t('trackErrGeneric', { err: msg });
  }

  function liveStream() {
    var s = track.stream;
    if (!s) return null;
    return s.getVideoTracks().some(function (t) { return t.readyState === 'live'; }) ? s : null;
  }

  /** Estado visible en la UI: botón de la barra superior + badge. */
  function renderTrackUI() {
    if (!elTrackToggle || !elTrackBadge) return;
    var on = track.enabled;
    elTrackToggle.classList.toggle('active', on);
    elTrackToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    elTrackToggle.title = I.t(on ? 'trackBtnOn' : 'trackBtnOff');
    elTrackToggle.setAttribute('aria-label', I.t(on ? 'trackBtnOn' : 'trackBtnOff'));

    var st = track.error ? 'ERROR' : (track.suspended ? 'SUSPENDED' : (on ? track.state : 'IDLE'));
    var show = st !== 'IDLE';
    elTrackBadge.className = 'track-badge' + (show ? ' show st-' + st.toLowerCase() : '');
    elTrackBadge.textContent = show ? I.t('trackState_' + st) : '';
    elTrackBadge.title = track.error || '';
  }

  /** Captura única y compartida. Single-flight: nunca dos getUserMedia concurrentes. */
  function acquireCamera() {
    var live = liveStream();
    if (live) return Promise.resolve(live);
    if (acquirePromise) return acquirePromise;
    if (!track.media) track.media = new MM_Media.MediaDeviceManager({});
    acquirePromise = track.media.startTrackingCamera(TRACK_CAPTURE).then(function (stream) {
      acquirePromise = null;
      if (!track.enabled) {
        /* El usuario apagó el tracking mientras esperaba el permiso: no dejar la cámara abierta */
        try { track.media.stopTrackingCamera(); } catch (e) { /* noop */ }
        return null;
      }
      track.stream = stream;
      stream.getVideoTracks().forEach(function (t) {
        t.addEventListener('ended', function () {
          if (track.stream !== stream) return;
          failTracking(I.t('trackErrEnded'));
        });
      });
      return stream;
    }, function (e) {
      acquirePromise = null;
      throw e;
    });
    return acquirePromise;
  }

  function releaseCamera() {
    track.stream = null;
    if (track.media) {
      try { track.media.stopTrackingCamera(); } catch (e) { console.warn('[tracking] stopTrackingCamera:', e); }
    }
  }

  /** Eventos del puente → UI. `starting`: el fallo de arranque lo reporta el catch, no este handler. */
  function onTrackingEvent(evt, data, starting) {
    if (evt === 'state') {
      track.state = data.to;
      renderTrackUI();
    } else if (evt === 'warning') {
      console.warn('[tracking]', data.message);
      toast(I.t('trackWarn', { err: data.message }));
    } else if (evt === 'error' && !starting) {
      toast(I.t('trackErrGeneric', { err: data.message }), 'danger');
    }
  }

  /**
   * Detiene la inferencia (rAF), libera el worker y el <video> oculto del puente.
   * opts.releaseCamera=true además apaga la captura.
   */
  function destroyTrackingBridge(opts) {
    opts = opts || {};
    track.seq++;                              /* invalida callbacks/promesas en vuelo */
    var b = track.bridge;
    track.bridge = null;
    if (b) {
      try { b.destroy(); } catch (e) { console.warn('[tracking] destroy:', e); }
    }
    if (opts.releaseCamera) releaseCamera();
  }

  /** Instancia un puente nuevo vinculado EXCLUSIVAMENTE al avatar principal. */
  function bindTrackingToMain() {
    if (!track.enabled || track.suspended || !main) return Promise.resolve(false);
    destroyTrackingBridge();                  /* garantiza un único puente vivo */
    var mySeq = ++track.seq;
    var mate = main;
    track.state = 'ACQUIRING';
    renderTrackUI();

    return acquireCamera().then(function (stream) {
      if (!stream || mySeq !== track.seq) return false;
      var starting = true;
      var bridge = MM_Tracking.create({
        mate: mate,
        stream: stream,                       /* la app es dueña de la cámara */
        policy: window.MM_SHARED_POLICY,      /* política única, sin duplicados */
        signals: false,                       /* presencia ≠ emoción */
        mode: 'attend',                       /* el avatar MIRA a la persona (no copia su mirada) */
        maxFaces: 3,
        mirror: true,
        lostAfterMs: 800
      });
      track.bridge = bridge;
      bridge.on(function (evt, data) {
        if (mySeq === track.seq) onTrackingEvent(evt, data, starting);
      });
      return bridge.start().then(function () {
        starting = false;
        return mySeq === track.seq;
      }, function (e) {
        starting = false;
        throw e;
      });
    }).catch(function (e) {
      if (mySeq !== track.seq) return false;  /* relevado por otro bind/destroy: no es un error */
      failTracking(describeTrackError(e));
      return false;
    });
  }

  /** Fallo explícito: apaga todo y lo muestra en la UI (nunca silencioso). */
  function failTracking(msg) {
    track.enabled = false;
    track.suspended = false;
    track.wasActiveBeforeCall = false;
    destroyTrackingBridge({ releaseCamera: true });
    track.state = 'IDLE';
    track.error = msg;
    renderTrackUI();
    toast(msg, 'danger');
    console.error('[tracking]', msg);
  }

  /** Encendido / apagado por acción del usuario. */
  function setTrackingEnabled(on) {
    on = !!on;
    if (on === track.enabled) return;
    if (on) {
      track.error = '';
      var pre = trackPrecheck();
      if (pre) { failTracking(I.t(pre)); return; }
      track.enabled = true;
      renderTrackUI();
      bindTrackingToMain().then(function (ok) {
        if (ok) toast(I.t('toastTrackOn'), 'ok');
      });
    } else {
      track.enabled = false;
      track.suspended = false;
      track.wasActiveBeforeCall = false;
      destroyTrackingBridge({ releaseCamera: true });
      track.state = 'IDLE';
      track.error = '';
      renderTrackUI();
      toast(I.t('toastTrackOff'));
    }
  }

  /* ---- Contrato con site/call.js (overlay de videollamada) ---- */
  function suspendForCall() {
    if (!track.enabled || track.suspended) return;
    track.wasActiveBeforeCall = true;
    track.suspended = true;
    destroyTrackingBridge();                  /* worker + rAF fuera; la captura se conserva para la llamada */
    renderTrackUI();
  }
  function restoreAfterCall() {
    var was = track.wasActiveBeforeCall;
    track.suspended = false;
    track.wasActiveBeforeCall = false;
    renderTrackUI();
    if (was && track.enabled) bindTrackingToMain();
    else if (!track.enabled) releaseCamera();
  }

  window.MM_TRACKING = {
    get active() { return track.enabled && !track.suspended; },
    get enabled() { return track.enabled; },
    get state() { return track.state; },
    get wasActiveBeforeCall() { return track.wasActiveBeforeCall; },
    getStream: liveStream,
    setEnabled: setTrackingEnabled,
    suspendForCall: suspendForCall,
    restoreAfterCall: restoreAfterCall,
    setCallBridge: function (b) { callBridgeRef = b || null; },
    callRebind: function (mate) { if (callBridgeRef) callBridgeRef.rebindMate(mate); }
  };

  window.addEventListener('pagehide', function () {
    destroyTrackingBridge({ releaseCamera: true });
  });

  /* ---------------- Personaje principal (reconstruir instancia al cambiar de personaje) ---------------- */
  function createMain(charId) {
    var emotion = main ? main.emotionId : selectedId;

    /* 1. El puente del avatar saliente se destruye ANTES que el motor (limpia canales del mate viejo) */
    destroyTrackingBridge();
    if (main) main.destroy();

    /* 2. Nuevo avatar */
    main = MM.create(elStage, {
      character: charId,
      variant: prefs.variants[charId] || '',
      emotion: emotion,
      idle: { standbyAfter: 60000, sleepAfter: 180000 },
      label: I.t('stageLabel')
    });
    main.setStyle({ sketch: elSketchToggle.checked ? 1 : 0 });
    main.on('change', function (e) {
      selectedId = e.id;
      updateMeta(e.def);
      highlightSelected();
      centerSelected();
    });
    main.on('tips', function (e) { showTips(e.text); });
    main.on('error', function (e) { lastErrorAt = performance.now(); toast(e.message, 'danger'); });
    window.MM_MAIN = main;   /* punto de acceso de depuración en consola */

    /* 3. Re-vincular tracker al nuevo avatar en el mismo flujo */
    if (track.enabled && !track.suspended) bindTrackingToMain();
  }

  /* ---------------- Cambio de personaje ---------------- */
  function switchCharacter(charId, opts) {
    opts = opts || {};
    if (!MM.characters.get(charId)) return;
    prefs.character = charId;
    savePrefs();
    if (main && main.touring) stopTourUI();
    createMain(charId);
    buildThumbs();
    fillVariantSelect();
    highlightCast();
    if (elCharSelect.value !== charId) {
      elCharSelect.value = charId;
      refreshDD();
    }
    if (!opts.silent) {
      toast(I.t('toastCharacter', { name: charName(MM.characters.get(charId)) }), 'ok');
    }
  }

  function highlightCast() {
    castCards.forEach(function (c) {
      c.btn.classList.toggle('selected', c.id === prefs.character);
    });
  }

  function buildCast() {
    elCastRow.innerHTML = '';
    castCards = [];
    MM.characters.list().forEach(function (ch) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cast';

      var avatar = document.createElement('div');
      avatar.className = 'cast-avatar';
      btn.appendChild(avatar);

      var nameEl = document.createElement('span');
      nameEl.className = 'cast-name';
      btn.appendChild(nameEl);

      var indEl = document.createElement('span');
      indEl.className = 'cast-industry';
      btn.appendChild(indEl);

      elCastRow.appendChild(btn);

      var engine = MM.create(avatar, {
        character: ch.id,
        emotion: '02',
        lite: true,
        eyeScale: 1.35,
        label: ch.name
      });

      btn.addEventListener('click', function () {
        if (!engine.signature || !engine.signature(0.7)) engine.spin(1);
        if (prefs.character !== ch.id) switchCharacter(ch.id);
      });

      castCards.push({ id: ch.id, btn: btn, nameEl: nameEl, indEl: indEl, ch: ch });
    });
    relabelCast();
    highlightCast();
  }

  function relabelCast() {
    castCards.forEach(function (c) {
      c.nameEl.textContent = charName(c.ch);
      c.indEl.textContent = I.t('industry_' + c.ch.industry);
      c.btn.title = charName(c.ch) + ' · ' + I.t('castClick');
    });
  }

  /* ---------------- Metadatos + paginación ---------------- */
  function currentDefs() {
    return MM.config.list(currentTab === 'all' ? null : currentTab);
  }
  function selectedIndex() {
    var defs = currentDefs();
    for (var i = 0; i < defs.length; i++) if (defs[i].id === selectedId) return i;
    return -1;
  }
  function updateMeta(def) {
    if (!def) def = MM.config.getRaw(selectedId);
    if (!def) return;
    elEmoId.textContent = 'ID ' + def.id;
    elEmoName.textContent = dispName(def);
    elEmoDesc.textContent = dispDesc(def);
    var defs = currentDefs();
    var idx = selectedIndex();
    elPager.textContent = (idx >= 0 ? String(idx + 1).padStart(2, '0') : '--') +
      ' / ' + String(defs.length).padStart(2, '0');
  }

  function highlightSelected() {
    cellById.forEach(function (cell, id) {
      cell.classList.toggle('selected', id === selectedId);
    });
  }

  /* ---------------- Vista de imagen en muro (modal) ---------------- */
  function stageOpen() { return document.body.classList.contains('stage-open'); }
  function openStage() {
    if (!document.body.classList.contains('mode-wall') || stageOpen()) return;
    document.body.classList.add('stage-open');
  }
  function closeStage() {
    if (!stageOpen()) return;
    document.body.classList.remove('stage-open');
  }
  $('stageClose').addEventListener('click', closeStage);
  document.querySelector('.stage-zone').addEventListener('click', function (e) {
    if (e.target === e.currentTarget) closeStage();
  });

  /* Centrar miniatura seleccionada: calcular desplazamiento con rectángulo de viewport,
     evitar que offsetParent trague el margen izquierdo */
  function centerSelected() {
    var cell = cellById.get(selectedId);
    if (!cell) return;
    var zr = elThumbZone.getBoundingClientRect();
    var cr = cell.getBoundingClientRect();
    if (document.body.classList.contains('mode-album')) {
      elThumbZone.scrollTo({
        left: elThumbZone.scrollLeft + (cr.left + cr.width / 2) - (zr.left + zr.width / 2),
        behavior: 'smooth'
      });
    } else {
      var nextTop = elThumbZone.scrollTop + (cr.top + cr.height / 2) - (zr.top + zr.height / 2);
      if (cr.top < zr.top || cr.bottom > zr.bottom) {
        elThumbZone.scrollTo({
          top: nextTop,
          behavior: 'smooth'
        });
      }
    }
  }

  /* ---------------- Paginación izquierda/derecha ---------------- */
  function step(delta) {
    var defs = currentDefs();
    if (!defs.length) return;
    if (main.touring) stopTourUI();
    var idx = selectedIndex();
    var next = idx < 0
      ? (delta > 0 ? 0 : defs.length - 1)
      : (idx + delta + defs.length) % defs.length;
    main.setEmotion(defs[next].id);
    openStage();
  }
  $('navPrev').addEventListener('click', function () { step(-1); });
  $('navNext').addEventListener('click', function () { step(1); });

  document.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
    else if (e.key === 'Escape') {
      if (closeAllDD()) return;
      if (elDrawer.classList.contains('open')) closeDrawer();
      else closeStage();
    }
  });

  /* ---------------- Desplegable personalizado ---------------- */
  var ddList = [];

  function enhanceSelect(sel) {
    var dd = document.createElement('div');
    dd.className = 'dd';
    sel.parentNode.insertBefore(dd, sel);
    dd.appendChild(sel);

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dd-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    var pop = document.createElement('div');
    pop.className = 'dd-pop';
    pop.setAttribute('role', 'listbox');
    dd.appendChild(trigger);
    dd.appendChild(pop);

    function rebuild() {
      pop.innerHTML = '';
      Array.prototype.forEach.call(sel.options, function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dd-item' + (opt.value === sel.value ? ' selected' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', opt.value === sel.value ? 'true' : 'false');
        var label = document.createElement('span');
        label.textContent = opt.textContent;
        btn.appendChild(label);
        var check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.setAttribute('class', 'dd-check');
        check.setAttribute('viewBox', '0 0 24 24');
        check.setAttribute('width', '14');
        check.setAttribute('height', '14');
        check.innerHTML = '<path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
        btn.appendChild(check);
        btn.addEventListener('click', function () {
          close();
          if (sel.value !== opt.value) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change'));
          }
          rebuild();
        });
        pop.appendChild(btn);
      });
      var cur = sel.options[sel.selectedIndex];
      trigger.textContent = cur ? cur.textContent : '';
    }

    function close() {
      dd.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
    function open() {
      closeAllDD();
      rebuild();
      dd.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dd.classList.contains('open')) close(); else open();
    });
    sel.addEventListener('change', rebuild);

    ddList.push({ dd: dd, rebuild: rebuild, close: close });
    rebuild();
  }

  function closeAllDD() {
    var any = false;
    ddList.forEach(function (i) {
      if (i.dd.classList.contains('open')) { any = true; i.close(); }
    });
    return any;
  }
  function refreshDD() {
    ddList.forEach(function (i) { i.rebuild(); });
  }
  document.addEventListener('click', function (e) {
    ddList.forEach(function (i) {
      if (!i.dd.contains(e.target)) i.close();
    });
  });

  /* ---------------- Pestañas de agrupación ---------------- */
  function tabList() {
    var groups = MM.config.groups().filter(function (g) {
      return MM.config.list(g.key).length > 0;
    });
    return [{ key: 'all', name: I.t('tabAll'), en: I.t('tabAll') }].concat(groups);
  }

  function buildTabs() {
    elTabs.innerHTML = '';
    tabList().forEach(function (g) {
      var count = g.key === 'all'
        ? MM.config.list().length
        : MM.config.list(g.key).length;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab' + (g.key === currentTab ? ' active' : '');
      btn.dataset.key = g.key;
      btn.innerHTML = '<span>' + groupName(g) + '</span><span class="tab-count">' + count + '</span>';
      btn.addEventListener('click', function () {
        if (currentTab === g.key) return;
        currentTab = g.key;
        Array.prototype.forEach.call(elTabs.children, function (t) {
          t.classList.toggle('active', t.dataset.key === g.key);
        });
        buildThumbs();
        updateMeta();
        if (main.touring) restartTour();
      });
      elTabs.appendChild(btn);
    });
  }

  /* ---------------- Flujo de miniaturas (muro de emojis del personaje actual) ---------------- */
  function buildThumbs() {
    thumbs.forEach(function (t) { t.engine.destroy(); });
    thumbs = [];
    cellById.clear();
    elThumbFlow.innerHTML = '';

    currentDefs().forEach(function (def) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.title = dispName(def) + ':' + dispDesc(def);

      var thumbEl = document.createElement('div');
      thumbEl.className = 'thumb';
      cell.appendChild(thumbEl);

      var label = document.createElement('div');
      label.className = 'cell-label';
      var cid = document.createElement('span');
      cid.className = 'cid';
      cid.textContent = def.id;
      var nameSpan = document.createElement('span');
      nameSpan.textContent = dispName(def);
      label.appendChild(cid);
      label.appendChild(nameSpan);
      cell.appendChild(label);

      /* Mini personaje: inactivo (costo cero frames), registrarse en el reloj compartido solo al pasar el ratón para reproducir animación */
      var engine = MM.create(thumbEl, {
        character: prefs.character,
        variant: prefs.variants[prefs.character] || '',
        emotion: def.id,
        autostart: false,
        label: dispName(def) + ' ' + I.t('thumbSuffix')
      });
      if (prefs.sketch) engine.setStyle({ sketch: 1 });

      cell.addEventListener('mouseenter', function () {
        engine.setActive(true);
        engine.replay();
      });
      cell.addEventListener('mouseleave', function () {
        engine.setActive(false);
        engine.setEmotion(def.id, { auto: true });
      });
      cell.addEventListener('click', function () {
        if (main.touring) stopTourUI();
        main.setEmotion(def.id);
        openStage();
      });

      elThumbFlow.appendChild(cell);
      thumbs.push({ id: def.id, def: def, engine: engine, cell: cell, nameSpan: nameSpan });
      cellById.set(def.id, cell);
    });

    highlightSelected();
    centerSelected();
  }

  /* ---------------- Pasillo de álbum: arrastrar con pulsación lateral para desplazarse ---------------- */
  (function () {
    var down = false, dragging = false, startX = 0, startLeft = 0, pid = 0;
    elThumbZone.addEventListener('pointerdown', function (e) {
      if (!document.body.classList.contains('mode-album')) return;
      down = true; dragging = false;
      startX = e.clientX;
      startLeft = elThumbZone.scrollLeft;
      pid = e.pointerId;
    });
    elThumbZone.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 6) {
        dragging = true;
        elThumbZone.classList.add('dragging');
        try { elThumbZone.setPointerCapture(pid); } catch (err) { /* puntero ya liberado */ }
      }
      if (dragging) elThumbZone.scrollLeft = startLeft - dx;
    });
    function endDrag() {
      down = false;
      if (dragging) {
        dragging = false;
        elThumbZone.classList.remove('dragging');
      }
    }
    elThumbZone.addEventListener('pointerup', endDrag);
    elThumbZone.addEventListener('pointercancel', endDrag);
  })();

  /* Cambio de idioma: actualizar etiquetas in situ, sin reconstruir la instancia del motor */
  function relabelThumbs() {
    thumbs.forEach(function (t) {
      t.nameSpan.textContent = dispName(t.def);
      t.cell.title = dispName(t.def) + ':' + dispDesc(t.def);
    });
  }

  /* ---------------- Modo de vista ---------------- */
  function setMode(mode) {
    prefs.mode = mode === 'album' ? 'album' : 'wall';
    savePrefs();
    document.body.classList.remove('stage-open');
    document.body.classList.toggle('mode-wall', prefs.mode === 'wall');
    document.body.classList.toggle('mode-album', prefs.mode === 'album');
    $('modeWall').classList.toggle('active', prefs.mode === 'wall');
    $('modeAlbum').classList.toggle('active', prefs.mode === 'album');
    requestAnimationFrame(centerSelected);
  }
  $('modeWall').addEventListener('click', function () { setMode('wall'); });
  $('modeAlbum').addEventListener('click', function () { setMode('album'); });

  /* ---------------- Tema ---------------- */
  function setTheme(theme, silent) {
    prefs.theme = theme === 'light' ? 'light' : 'dark';
    savePrefs();
    document.documentElement.setAttribute('data-theme', prefs.theme);
    elThemeToggle.title = prefs.theme === 'dark' ? I.t('themeToLight') : I.t('themeToDark');
    if (!silent) toast(I.t(prefs.theme === 'dark' ? 'toastThemeDark' : 'toastThemeLight'));
  }
  elThemeToggle.addEventListener('click', function () {
    setTheme(prefs.theme === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- Idioma ---------------- */
  function fillCharSelect() {
    elCharSelect.innerHTML = '';
    MM.characters.list().forEach(function (ch) {
      var opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = charName(ch) + ' · ' + I.t('industry_' + ch.industry);
      elCharSelect.appendChild(opt);
    });
    elCharSelect.value = prefs.character;
  }

  /* ---- Variante de contorno corporal: mostrar solo para personajes que declararon variants ---- */
  function variantName(v) {
    return I.lang === 'en' && v.en && v.en.name ? v.en.name : v.name;
  }
  function fillVariantSelect() {
    var vs = MM.characters.variants(prefs.character);
    /* Limpiar IDs de variantes descontinuados que quedan en localStorage,
       evitar que el select muestre en blanco o se los pase al motor */
    var stored = prefs.variants[prefs.character] || '';
    if (stored && !vs.some(function (v) { return v.id === stored; })) {
      prefs.variants[prefs.character] = '';
      savePrefs();
    }
    if (!vs.length) {
      elVariantField.style.display = 'none';
      return;
    }
    elVariantField.style.display = '';
    elVariantSelect.innerHTML = '';
    var opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = I.t('variantDefault');
    elVariantSelect.appendChild(opt0);
    vs.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = variantName(v);
      elVariantSelect.appendChild(opt);
    });
    elVariantSelect.value = prefs.variants[prefs.character] || '';
    refreshDD();
  }

  function applyI18n() {
    I.set(prefs.lang);
    document.documentElement.lang = prefs.lang === 'en' ? 'en' : 'es';
    document.title = I.t('docTitle');
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = I.t(nodes[i].getAttribute('data-i18n'));
    }
    elLangToggle.textContent = I.t('langBtn');
    $('settingsToggle').title = I.t('settingsBtn');
    $('drawerClose').setAttribute('aria-label', I.t('drawerClose'));
    $('navPrev').title = I.t('prevEmotion');
    $('navNext').title = I.t('nextEmotion');
    $('stageClose').title = I.t('stageClose');
    elThemeToggle.title = prefs.theme === 'dark' ? I.t('themeToLight') : I.t('themeToDark');
    buildTabs();
    relabelThumbs();
    relabelCast();
    updateMeta();
    fillCharSelect();
    fillVariantSelect();
    refreshDD();
    renderTrackUI();
  }
  elLangToggle.addEventListener('click', function () {
    prefs.lang = prefs.lang === 'es' ? 'en' : 'es';
    savePrefs();
    applyI18n();
  });

  /* ---------------- Cajón de configuración ---------------- */
  function openDrawer() {
    elDrawer.classList.add('open');
    elDrawer.setAttribute('aria-hidden', 'false');
    elDrawerMask.hidden = false;
    requestAnimationFrame(function () { elDrawerMask.classList.add('show'); });
  }
  function closeDrawer() {
    closeAllDD();
    elDrawer.classList.remove('open');
    elDrawer.setAttribute('aria-hidden', 'true');
    elDrawerMask.classList.remove('show');
    setTimeout(function () { elDrawerMask.hidden = true; }, 300);
  }
  $('settingsToggle').addEventListener('click', openDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  elDrawerMask.addEventListener('click', closeDrawer);

  /* ---------------- Recorrido automático ---------------- */
  function restartTour() {
    var ids = currentDefs().map(function (d) { return d.id; });
    main.startTour(ids, prefs.tourMs);
  }
  function stopTourUI() {
    main.stopTour();
    elTourToggle.checked = false;
  }
  function tabName(key) {
    var t = tabList().find(function (g) { return g.key === key; });
    return t ? groupName(t) : key;
  }
  elTourToggle.addEventListener('change', function () {
    if (elTourToggle.checked) {
      restartTour();
      openStage();
      toast(I.t('toastTourOn', { name: tabName(currentTab), n: currentDefs().length }), 'ok');
    } else {
      main.stopTour();
      toast(I.t('toastTourOff'));
    }
  });
  elTourInterval.addEventListener('change', function () {
    prefs.tourMs = parseInt(elTourInterval.value, 10) || 2500;
    savePrefs();
    if (main.touring) restartTour();
  });

  /* ---------------- Línea de boceto / personaje ---------------- */
  elSketchToggle.addEventListener('change', function () {
    prefs.sketch = elSketchToggle.checked;
    savePrefs();
    var sv = prefs.sketch ? 1 : 0;
    main.setStyle({ sketch: sv });
    /* La línea de boceto también afecta a las miniaturas de previsualización */
    thumbs.forEach(function (t) { t.engine.setStyle({ sketch: sv }); });
    toast(I.t(prefs.sketch ? 'toastSketchOn' : 'toastSketchOff'), prefs.sketch ? 'ok' : '');
  });

  elCharSelect.addEventListener('change', function () {
    if (elCharSelect.value !== prefs.character) switchCharacter(elCharSelect.value);
  });

  elVariantSelect.addEventListener('change', function () {
    prefs.variants[prefs.character] = elVariantSelect.value;
    savePrefs();
    if (main.touring) stopTourUI();
    createMain(prefs.character);
    buildThumbs();
    var cur = elVariantSelect.options[elVariantSelect.selectedIndex];
    toast(I.t('toastVariant', { name: cur ? cur.textContent : '' }), 'ok');
  });

  /* ---------------- Seguimiento facial: control de UI ---------------- */
  if (elTrackToggle) {
    elTrackToggle.addEventListener('click', function () {
      setTrackingEnabled(!track.enabled);
    });
  }

  /* ---------------- Simulación de conexión AI ---------------- */
  function sendAI() {
    var raw = elAiInput.value.trim();
    if (!raw) return;
    if (main.touring) stopTourUI();
    var before = performance.now();
    var ok = main.handleAIMessage(raw);
    if (ok) openStage();
    if (ok && lastErrorAt < before) toast(I.t('toastAiSent') + ': ' + raw, 'ok');
  }
  $('aiSend').addEventListener('click', sendAI);
  elAiInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendAI();
  });
  $('aiSampleErr').addEventListener('click', function () {
    elAiInput.value = '{"emotionId":"34","tips":"Falló la llamada a la API, comprobar la red"}';
    sendAI();
  });
  $('aiSampleBad').addEventListener('click', function () {
    elAiInput.value = '{"emotionId":"99","tips":"Este es un ID de emoción inexistente"}';
    sendAI();
  });

  /* ---------------- Exportar / importar configuración ---------------- */
  $('btnExport').addEventListener('click', function () {
    var blob = new Blob([MM.config.exportConfig()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mood-mates-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast(I.t('toastExported', { n: MM.config.list().length }), 'ok');
  });
  var elImportFile = $('importFile');
  $('btnImport').addEventListener('click', function () { elImportFile.click(); });
  elImportFile.addEventListener('change', function () {
    var file = elImportFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = MM.config.importConfig(String(reader.result));
      buildTabs();
      buildThumbs();
      updateMeta();
      if (res.ok) toast(I.t('toastImportOk', { n: res.added }), 'ok');
      else toast(I.t('toastImportFail', { n: res.added, err: res.errors.join('；') }), 'danger');
    };
    reader.readAsText(file);
    elImportFile.value = '';
  });

  /* ---------------- Logotipo de marca: instancia mini en la barra superior ---------------- */
  function buildBrand() {
    var elBrand = $('brandBall');
    var brand = MM.create(elBrand, {
      character: MM.characters.defaultId(),
      emotion: '02',
      lite: true,
      eyeScale: 1.7,
      label: 'Mood Mates'
    });
    elBrand.addEventListener('click', function () {
      if (!brand.signature || !brand.signature(0.6)) brand.spin(1);
    });
  }

  /* ---------------- Hero de apertura: personaje de línea semioculto ---------------- */
  function buildHero() {
    hero = MM.create($('heroBot'), {
      character: prefs.character,
      emotion: '02',
      label: 'Mood Mates'
    });
    hero.setStyle({ sketch: 1 });

    /* Entrar con la acción de firma (sin firma, retroceder a girar); después las antics de espera de '02' se disparan periódicamente */
    setTimeout(function () {
      if (!hero.signature || !hero.signature(1)) hero.spin(2);
    }, 700);

    $('heroBot').addEventListener('click', function () {
      if (!hero.signature || !hero.signature(0.8)) hero.spin(1);
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        hero.setActive(entries[0].isIntersecting);
      }, { threshold: 0.05 }).observe($('hero'));
    }

    $('heroCta').addEventListener('click', function () {
      $('gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------- Interacción del escenario ---------------- */
  elStage.addEventListener('click', function () {
    /* Nimbo: al clicar celebrar sopla burbujas (sin cambiar de emoción); Twinkle: firma + cuerpo + confeti */
    if (main.celebrate) main.celebrate(1);
    else if (!main.signature || !main.signature(1)) main.spin(1);
  });

  /* Cualquier interacción del usuario reinicia el temporizador de espera
   * FIX v22b: guarda nula — si la creación principal falló antes (p. ej. excepción en
   * setEmotion), `main` es null y estos listeners globales inundaban la consola. */
  ['pointerdown', 'keydown'].forEach(function (evt) {
    document.addEventListener(evt, function () { if (main) main.resetIdle(); }, { passive: true });
  });

  /* ---------------- Inicialización ---------------- */
  function init() {
    I.set(prefs.lang);
    setTheme(prefs.theme, true);
    setMode(prefs.mode);
    elSketchToggle.checked = !!prefs.sketch;
    elTourInterval.value = String(prefs.tourMs);
    if (!elTourInterval.value) { elTourInterval.value = '2500'; prefs.tourMs = 2500; }
    fillCharSelect();
    enhanceSelect(elCharSelect);
    enhanceSelect(elVariantSelect);
    enhanceSelect(elTourInterval);

    createMain(prefs.character);
    buildCast();
    buildBrand();
    buildHero();
    applyI18n();
    buildThumbs();
    updateMeta();
    highlightSelected();
    renderTrackUI();
  }

  /* Catálogo externo opcional: si existe data/emotions.json se aplica antes de arrancar.
   * loadFromUrl nunca rechaza: ante cualquier fallo seguimos con el seed embebido.
   * En file:// (sin servidor) o sin fetch, iniciamos directamente. */
  function boot() {
    var url = window.MM_EMOTIONS_URL || 'data/emotions.json';
    if (location.protocol === 'file:' || typeof fetch !== 'function') { init(); return; }
    MM.config.loadFromUrl(url).then(function (r) {
      if (!r.ok && r.added === 0 && r.errors && r.errors.length &&
          String(r.errors[0]).indexOf('HTTP') === 0) {
        /* 404 u otro error de red: comportamiento normal sin catálogo externo */
      } else if (!r.ok) {
        console.warn('[MoodMates] ' + url + ' no aplicado del todo, se conserva el seed embebido para lo inválido:', r.errors);
      }
      init();
    });
  }
  boot();
})();