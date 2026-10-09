// rostro_animado/src/media/CallSession.js
/* ============================================================
 * CallSession.js —— Orquestor de la "videollamada con bot animado"
 *
 * Une tres mundos:
 *
 *   MediaDeviceManager (MM_Media)  ── dispositivos locales
 *              │                       cámara / micrófono / bocina / mute
 *              ▼
 *   WebRTCClient (MM_WebRTC)       ── conexión P2P + señalización
 *              │
 *              ▼
 *   MoodMates engine               ── el bot reacciona ANIMADAMENTE
 *                                      a cada evento de la llamada
 *
 * Mapa estado de llamada → emoción del bot (contrato emotionId):
 *   connecting            → '30' pensar        + tips "Conectando…"
 *   connected             → '33' completado    + celebrate()
 *   remote-stream         → '13' sorpresa      (llega la cara remota)
 *   disconnected / failed → '34' error
 *   mute mic on           → '38' rechazar (señal breve) · off → '02' espera
 *   camera off            → '02' espera · camera on → '03' curiosidad
 *   devicechange          → '01' despertar (algo cambió en el hardware)
 *
 * Uso mínimo:
 *   var session = MM_Call.create({
 *     mate: main,                      // instancia MoodMates.create(...)
 *     signalUrl: 'wss://mi-servidor/signal',
 *     videoElement, remoteVideoElement, audioElements: [...]
 *   });
 *   await session.setup();             // permisos + enumerate + watches
 *   await session.startCall();         // cámara+mic+WebRTC
 *   session.toggleMute(); session.switchCamera(id); session.endCall();
 * ============================================================ */
(function (global) {
  'use strict';

  /* Emociones usadas por la sesión (ver docs/INTEGRATION.md, tabla de segmentos). */
  var EMO = {
    standby: '02',
    curious: '03',
    happy: '10',
    surprise: '13',
    thinking: '30',
    done: '33',
    error: '34',
    reject: '38'
  };

  function create(options) {
    options = options || {};
    var M = global.MM_Media;
    var W = global.MM_WebRTC;
    if (!M) throw new Error('MM_Call: cargue primero src/media/MediaDeviceManager.js');
    if (!W) throw new Error('MM_Call: cargue primero src/media/WebRTCClient.js');

    var mate = options.mate || null;   /* instancia del motor MoodMates (opcional) */

    /* ---- traductor de estados → emociones del bot ---- */
    function react(emotionId, tips) {
      if (!mate) return;
      try {
        mate.handleAIMessage({ emotionId: emotionId, tips: tips || undefined });
      } catch (e) { console.error('[CallSession] react:', e); }
    }

    /* ---- gestor de dispositivos multimedia ---- */
    var media = new M.MediaDeviceManager({
      videoElement: options.videoElement || null,
      audioElements: options.audioElements || [],
      onChange: function (evt, data) {
        if (options.onMediaEvent) options.onMediaEvent(evt, data);
        if (evt === 'start' && data.manager === 'camera') react(EMO.curious);
        if (evt === 'stop' && data.manager === 'camera') react(EMO.standby);
        if (evt === 'mute' && data.manager === 'microphone') {
          react(data.muted ? EMO.reject : EMO.standby);
        }
        if (evt === 'error') react(EMO.error, data.message);
      }
    });

    /* ---- cliente WebRTC (lazy: se crea al iniciar la llamada) ---- */
    var rtc = null;

    function ensureRtc() {
      if (rtc) return rtc;
      rtc = new W.WebRTCClient({
        mediaManager: media,
        signalUrl: options.signalUrl,
        signal: options.signal,           /* inyección para pruebas (mock) */
        roomId: options.roomId,
        clientId: options.clientId,
        iceServers: options.iceServers,
        remoteVideoElement: options.remoteVideoElement || null,
        onEvent: function (evt, data) {
          if (options.onCallEvent) options.onCallEvent(evt, data);
          if (evt === 'state') {
            if (data.state === 'connecting') react(EMO.thinking, 'Conectando…');
            else if (data.state === 'connected') { react(EMO.done); if (mate) mate.celebrate(); }
            else if (data.state === 'disconnected' || data.state === 'failed') react(EMO.error);
            else if (data.state === 'idle') react(EMO.standby);
          }
          if (evt === 'remote-stream') react(EMO.surprise);
          if (evt === 'error') react(EMO.error, data.message);
        }
      });
      return rtc;
    }

    var session = {
      media: media,
      options: options,          /* espejo vivo: permite cambiar signalUrl/signal antes de llamar */
      get rtc() { return rtc; },
      mate: mate,

      /** Paso 1 permisos → paso 2 enumerate (los labels solo existen tras el permiso). */
      setup: async function () {
        try { await media.requestPermissions(); }
        catch (e) {
          /* Denegado: seguimos sin labels pero la app sigue viva. */
          react(EMO.error, 'Permiso de cámara/micrófono denegado');
        }
        await media.refreshDevices();
        media.watchDeviceChanges(function (devices) {
          react(EMO.standby);
          if (options.onDevicesChanged) options.onDevicesChanged(devices);
        });
        return media.devices;
      },

      /** Enciende cámara+mic e inicia la conexión WebRTC. */
      startCall: async function () {
        if (media.camera.deviceId === undefined) media.camera.deviceId = '';
        await media.startCamera(media.camera.deviceId);
        await media.startMicrophone(media.microphone.deviceId);
        return ensureRtc().connect();
      },

      endCall: function () {
        if (rtc) { rtc.disconnect(); }
        media.stopCamera();
        media.stopMicrophone();
        react(EMO.standby);
      },

      toggleMute: function () {
        var wasMuted = media.microphone.isMuted();
        var muted = !wasMuted;
        media.setMuted(muted, 'microphone');
        /* El evento 'mute' solo vive si hay pista; reaccionar también sin stream. */
        react(muted ? EMO.reject : EMO.standby);
        return muted;
      },

      toggleCamera: function () {
        if (media.camera.isRunning()) { media.stopCamera(); react(EMO.standby); return false; }
        media.startCamera(media.camera.deviceId);
        return true;
      },

      /** Cambio de cámara en caliente: applyConstraints + replaceTrack en la PC. */
      switchCamera: async function (deviceId) {
        await media.camera.switchDevice(deviceId);
        if (rtc && rtc.pc && media.camera.track) {
          await rtc.replaceLocalTrack(media.camera.track, 'video');
        }
      },

      switchMicrophone: async function (deviceId) {
        await media.microphone.switchDevice(deviceId);
        if (rtc && rtc.pc && media.microphone.track) {
          await rtc.replaceLocalTrack(media.microphone.track, 'audio');
        }
      },

      selectSpeaker: function (deviceId) {
        return media.selectSpeaker(deviceId);
      },

      setMate: function (m) { mate = session.mate = m; },

      dispose: function () {
        session.endCall();
        media.dispose();
      }
    };

    return session;
  }

  global.MM_Call = {
    create: create,
    EMOTION_MAP: EMO
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.MM_Call;
  }
})(typeof window !== 'undefined' ? window : globalThis);
