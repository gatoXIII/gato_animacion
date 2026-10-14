# Plan de Implementación — Capa de Seguimiento Facial para Mood Mates

**Proyecto:** `gatoXIII/gato_animacion/rostro_animado`
**Documento base:** Especificación Técnica — Sistema de Seguimiento Facial para Bot Animado SVG
**Versión:** 1.0 · **Estado:** Aprobado para ejecución · **Alcance:** Fases 1 y 2 (demografía diferida)

---

## 0. Decisiones marco (resumen ejecutivo)

| # | Decisión | Sustituye en la spec |
|---|---|---|
| M1 | **Un solo Web Worker** de inferencia (landmarks + iris + pose). El Worker 2 demográfico se elimina del alcance. | Spec §1 (dos workers) |
| M2 | **La mirada se deriva de landmarks (iris vs. esquinas oculares)**; la pose de cabeza se deriva de la **matriz de transformación facial** de FaceLandmarker, no de landmarks. | Spec §2.3 |
| M3 | **Sin transformaciones 3D/CSS perspective** sobre el SVG. La pose se mapea a parámetros 2D existentes del motor (`body.rotate`, `body.y`, skew sutil). | — |
| M4 | **Política de emociones inyectable** (mapa estado→emotionId configurable en runtime, alimentado por backend), siguiendo el patrón `EMO` ya existente en `CallSession.js`. | Spec §2.2 (estados fijos) |
| M5 | **Mutación DOM del motor se conserva** (diff-guard + `setAttribute`); no se migra a CSS Custom Properties. Desviación justificada de spec §2.4. | Spec §2.4 |
| M6 | Motor instanciado con `idle: false` y `saccades: false` bajo tracking: la State Machine externa es la única autoridad de estado y la mirada no se decorrelaciona. | — |
| M7 | Estilo del código: **ES5 + IIFE + globals** (`window.MM_Tracking`), sin bundler, orden de `<script>` fijo — consistente con el repo. | — |

---

## 1. Arquitectura objetivo

```
┌──────────────────────────────────────────────────────────────────┐
│ MAIN THREAD                                                      │
│                                                                  │
│  ┌─────────────┐   stream    ┌──────────────────────────────┐    │
│  │ CameraSource│────────────▶│ FrameGrabber (canvas 320×240 │    │
│  │ (MM_Media o │             │  + createImageBitmap)        │    │
│  │  getUserMedia│            └──────────┬───────────────────┘    │
│  │  propio)    │                       │ ImageBitmap (transfer)  │
│  └─────────────┘                       ▼                         │
│                          ┌─────────────────────────────┐         │
│                          │ InferenceBackend            │         │
│                          │  ├─ WorkerBackend (default) │         │
│                          │  └─ MainThreadBackend       │         │
│                          │    (fallback, delegate GPU) │         │
│                          └──────────┬──────────────────┘         │
│                                     │ TrackingPacket (~200 B)    │
│                                     ▼                            │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────────┐    │
│  │ FaceSelector │─▶│ GazeEstim. │─▶│ OneEuroFilter ×(x,y,   │    │
│  │ argmax(W·H)  │  │ +EAR +pose │  │  ear, yaw, pitch, roll)│    │
│  └──────────────┘  └────────────┘  └──────────┬─────────────┘    │
│                                               ▼                  │
│                          ┌─────────────────────────────┐         │
│                          │ TrackingStateMachine        │         │
│                          │ INIT→ACTIVE→LOST→INACTIVE   │         │
│                          │ (histéresis 1000ms, watchdog)│        │
│                          └──────────┬──────────────────┘         │
│                                     ▼                            │
│                          ┌─────────────────────────────┐         │
│                          │ TrackingBridge              │         │
│                          │ política de emociones (mapa │         │
│                          │ inyectable desde backend)   │         │
│                          └──────────┬──────────────────┘         │
└─────────────────────────────────────┼────────────────────────────┘
                                      ▼
                    ┌───────────────────────────────────┐
                    │ EngineAdapter (capacidades motor) │
                    │  setGaze · setEmotion ·           │
                    │  setEyeOpen (extensión nueva)     │
                    └───────────────┬───────────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │  MoodMates Engine (rAF único) │
                    └───────────────────────────────┘
```

**Flujo de datos:** cámara → frame reducido → worker (30 FPS objetivo, adaptativo) → paquete compacto → selección de rostro → estimación → filtrado → máquina de estados → puente → adaptador → motor (rAF 60 FPS).

---

## 2. Decisiones técnicas detalladas

### D1. Worker único de inferencia (fusión de pose)

La spec proponía dos workers (landmarks @30FPS + pose/demografía @2-5FPS). **Se fusionan en uno** porque:

- `FaceLandmarker` de MediaPipe **ya entrega `facialTransformationMatrix` en la misma inferencia** — la pose sale gratis, sin segundo modelo.
- Un segundo worker duplicaría el costo de transferencia de frames y la superficie de fallo.
- La demografía (edad/género) requeriría un modelo aparte (~MBs) con riesgo legal (inferencia biométrica); sin valor para el tracking. **Eliminada del alcance** (documentado como desviación aceptada; reactivable como módulo futuro que solo ajuste `blinkMs` vía política de emociones).

### D2. Empaquetado de MediaPipe para workers

- **Artefactos:** `@mediapipe/tasks-vision` (WASM + JS) y `face_landmarker.task` (~4 MB).
- **Alojamiento:** `assets/vendor/mediapipe/` (versionado, sin CDN) para control de versión y funcionamiento offline; `Cache-Control: immutable`.
- **Carga en worker:** `importScripts('wasm/vision_wasm_internal.js', 'wasm/vision_wasm_nosimd_internal.js')` + `FilesetResolver.forVisionTasks(basePath)`; el `.task` se pasa por ruta, no por buffer (el resolver lo cachea).
- **Loader main-thread (`MpLoader.js`):** resuelve rutas, verifica integridad, precarga durante `INITIALIZING` con progreso, y decide backend (D3).
- **Detección de SIMD:** el resolver de MediaPipe selecciona automáticamente; el loader solo registra cuál se usó para telemetría.

### D3. Backends de inferencia y mecanismo de respaldo

Interfaz común `InferenceBackend` (misma API en ambos):

```
init(config) → Promise<{ok, delegate, error?}>
detect(bitmap, timestampMs) → Promise<RawFacePacket|null>
setRunning(fps)             // adaptativo
dispose()
```

| Backend | Condición de activación | Notas |
|---|---|---|
| `WorkerBackend` | Por defecto | `createImageBitmap` + transfer; delegado GPU en worker (Chrome/Edge) |
| `MainThreadBackend` | `Worker` no disponible, fallo de `importScripts`, o error de WebGL en worker | Delegado `GPU` con fallback a `CPU`; throttling a 15 FPS |

**Cadena de fallback:** Worker+GPU → Worker+CPU → Main+GPU → Main+CPU → degradado (tracking off, bot en modo autónomo clásico). Cada salto emite evento `backend` para telemetría. El watchdog (D7) dispara el descenso de cadena si no llegan paquetes en 1500ms tras `init` exitoso.

### D4. Captura de fotogramas y creación de bitmaps

- Un `<canvas>` oculto a **320×240** (suficiente para landmarks; el modelo reescala internamente a 192×192).
- Por tick (30 FPS objetivo): `ctx.drawImage(video, 0, 0, 320, 240)` → `createImageBitmap(canvas)` → `postMessage(bitmap, [bitmap])` (transfer, costo ~0).
- El timestamp usa `performance.now()` del main thread (fuente única de verdad temporal para `detectForVideo`).
- **Throttling adaptativo:** si `detect()` tarda >33ms de mediana (ventana de 30 frames), bajar a 15 FPS y reducir canvas a 256×192; si <20ms sostenido, subir. Histerésis de 3s entre cambios.
- Sin `requestVideoFrameCallback` como dependencia: reloj propio con `setTimeout` calibrado (compatibilidad Safari).

### D5. Estructura de datos compacta por rostro (TrackingPacket)

Objeto plano (structured clone, ~200 B; sin Float32Array — el volumen no lo justifica):

```js
// Worker → Main, 15-30 msg/s
{
  t: 12345.6,            // timestamp del frame
  n: 2,                  // rostros detectados
  faces: [
    {
      a: 0.042,          // área bbox normalizada (W·H) — clave de FaceSelector
      // Gaze pre-estimado en worker (ahora cómputo en main):
      gx: 0.31, gy: -0.12,       // mirada [-1,1] cruda (convención D8)
      ear: 0.28,                  // Eye Aspect Ratio medio (0 cerrado, ~0.3 abierto)
      pitch: 4.2, yaw: -11.5, roll: 2.0,  // grados, desde facialTransformationMatrix
      c: 0.91                    // confianza (min score de landmarks)
    }
  ]
}
```

Los índices de landmarks nunca cruzan la frontera del worker: **toda la geometría (gaze, EAR, pose) se calcula dentro del worker** y solo viajan escalares. Esto minimiza el mensaje (spec §3: mutación y filtro <1ms en main).

### D6. Índices de landmarks (Face Mesh 478, con iris)

| Elemento | Índices |
|---|---|
| Iris izquierdo (centro) | **468** (anillo: 469–472) |
| Iris derecho (centro) | **473** (anillo: 474–477) |
| Ojo izq. — comisuras | externa **33**, interna **133** |
| Ojo der. — comisuras | interna **362**, externa **263** |
| Ojo izq. — párpados (EAR) | sup. **159**, inf. **145** (secundarios 160/144, 158/153) |
| Ojo der. — párpados (EAR) | sup. **386**, inf. **374** (secundarios 385/380, 373/390) |
| Referencia escala facial | distancia 33↔263 (anchura interocular) para normalización |

### D7. Cálculo de la mirada y posición del iris

**Horizontal (por ojo):**
```
ratioX = (irisCx − innerX) / (outerX − innerX)   // ∈ [0,1]
gazeX_ojo = clamp(2·ratioX − 1, −1, 1)
```
**Vertical (por ojo):** punto medio de párpado superior (159/386) e inferior (145/374) como rango; posición relativa del centro del iris.

**Fusión:** promedio de ambos ojos; si un iris tiene confianza baja (<0.5), se usa el otro; si ambos fallan, se degrada a dirección de cabeza (`yaw/15°`) como aproximación.

**Compensación de pose:** se resta la componente de cabeza para que mirar con los ojos y girar la cabeza no se sumen dos veces:
```
gazeX_final = clamp(gazeX_ojos − k·(yaw/20°), −1, 1)   // k ≈ 0.6
gazeY_final = clamp(gazeY_ojos − k·(pitch/15°), −1, 1)
```

### D8. Convención de ejes y origen del vector de mirada

- **Origen:** el vector describe *hacia dónde mira el usuario en su propio campo visual*, normalizado [-1,1].
- **Y:** `gy > 0` = el usuario mira **hacia abajo** — coincide con la convención interna del motor (`render.js`: `lookY > 0` desplaza el iris abajo). Sin inversión.
- **X con cámara selfie (imagen espejada):** el frame crudo de `getUserMedia` tiene el eje X **invertido** respecto al movimiento real del usuario. **Decisión:** el bot actúa como espejo (si el usuario mira a su derecha, el bot mira a la izquierda de pantalla, "encontrándose" con la mirada) → **se niega `gx`** en el worker. Configurable (`mirror: false`) para cámaras traseras.
- **Pitch:** en la matriz de MediaPipe, pitch positivo = cabeza hacia abajo en imagen selfie; se normaliza para que `pitch > 0` = usuario mira abajo, consistente con `gy`. Verificado en calibración (Fase 1, T-9).
- **Sanitización (validación antes de aplicar):** todo valor que cruce al main thread pasa por `sanitize()`: `Number.isFinite`, clamp [-1,1] (gaze), [-45,45]° (ángulos), [0,0.6] (EAR); valores corruptos se descartan con contador de errores (no rompen el bucle). El motor ya clampa en `setGaze`, pero la capa de tracking no delega esa responsabilidad.

### D9. Pose de cabeza: matriz vs. landmarks → matriz

**Decisión: `facialTransformationMatrix`** (salida nativa de FaceLandmarker, 4×4 columna-mayor).

- Extracción de Euler: `pitch = atan2(−m[9], m[10])`, `yaw = atan2(m[8], m[10])`, `roll = atan2(m[4], m[0])` (descomposición XYZ, orden verificado en calibración).
- Más estable que PnP con landmarks (sin modelo 3D canónico que mantener) y sin costo extra.
- Fallback documentado: si `facialTransformationMatrix` viene vacía (modo CPU en builds antiguos), estimación por landmarks: yaw ≈ asimetría de distancias iris↔comisuras, roll ≈ pendiente de la línea 33↔263.

### D10. Rotación de cabeza: ¿3D? → No

El motor es SVG 2D con animación por morfosis de paths. Aplicar `rotate3d`/CSS `perspective` sobre el `<svg>`:

- rasteriza y desenfoca el vectorial en rotaciones intermedias,
- rompe el diff-guard (cada frame sería escritura forzada),
- desalinea el clipPath de párpados.

**Decisión:** mapeo 2D sutil sobre parámetros existentes:
`roll → pose.body.rotate` (±6° máx), `yaw → face.sx` (±4% de skew) + sesgo de `lookX`, `pitch → body.y` (±3px). El backend puede desactivarlo (`headPose: false`). La cabeza del bot *sugiere* la pose; no la reproduce.

### D11. Máquina de estados rediseñada (anti-bloqueo)

```
INITIALIZING ──(modelo listo)──▶ ACQUIRING ──(rostro 500ms)──▶ ACTIVE
     │                              │  ▲                          │
     │(error irrecuperable)         │  └──(recuperación)──┐       │(pérdida ≥1000ms, histéresis)
     ▼                              ▼                     │       ▼
   ERROR ◀──(watchdog 1500ms)──  LOST (grace) ◀───────────┴── INACTIVE
     │                              │
     └──(reintento backoff ────────▶│ (ausencia ≥1000ms)──▶ INACTIVE
        2s→4s→8s, máx 3)            └─(rostro detectado)──▶ ACTIVE
```

Reglas anti-deadlock (corrige la fragilidad de la spec §2.2, que solo contempla ACTIVE/INACTIVE):

1. **Toda transición se evalúa por timestamps**, nunca por contadores de mensajes (un worker colgado no puede dejar el sistema en `ACTIVE` eterno).
2. **Watchdog:** si no llega `TrackingPacket` en 1500ms estando en `ACTIVE`/`ACQUIRING` → `LOST` + evento `stalled` + descenso de backend (D3).
3. **`ERROR` siempre reintenta** con backoff exponencial; tras 3 fallos, degrada a "modo autónomo clásico" (motor con su `idle` propio reactivado) — el bot nunca queda muerto.
4. **`INACTIVE` no es terminal:** cualquier rostro detectado retorna a `ACTIVE` sin pasar por calibración.
5. La histéresis de 1000ms (spec §2.2) se conserva, pero aplica solo `ACTIVE→LOST→INACTIVE`; la recuperación es inmediata (asimetría intencional: perder es lento, recuperar es rápido).

### D12. Política de emociones: variables desde backend

El mapa estado→emoción **no se hardcodea**: se inyecta en la creación del puente y es actualizable en runtime (WebSocket/polling del backend), siguiendo el patrón `EMO` de `CallSession.js`:

```js
var bridge = MM_Tracking.create(videoEl, mate, {
  emotions: {            // sobreescribible por backend
    INITIALIZING: '30',  // pensar (mientras carga el modelo)
    ACQUIRING:    '03',  // curiosidad (buscando rostro)
    ACTIVE:       null,  // null = no forzar; la IA/backend manda vía handleAIMessage
    LOST:         '02',  // espera
    INACTIVE:     '00',  // dormir
    ERROR:        '34'   // error
  },
  onEvent: function (type, payload) { /* telemetría al backend */ }
});
bridge.setEmotionMap(nuevoMapa);   // actualización en caliente desde backend
```

- `ACTIVE: null` es deliberado: en estado activo la emoción la dicta el **backend conversacional** (`handleAIMessage`), no el tracker. El tracker solo gobierna estados de *presencia*.
- Validación: cada emotionId se verifica contra `MoodMates.config.getRaw(id)`; ID desconocido → fallback `'02'` + evento `error` (el motor ya garantiza que nunca hay pantalla en blanco).

### D13. Separación de políticas: tracking vs. llamada

`CallSession` y `TrackingBridge` son **autoridades de emoción mutuamente excluyentes sobre la misma instancia**:

- En `call.html`/overlay de llamada: el bot de llamada es una instancia **propia** (`#callBotBox`, creada por `site/call.js`) gobernada por `CallSession`. El tracking **no se activa** sobre esa instancia por defecto.
- En la galería (`index.html`): el tracking gobierna la instancia principal; al abrirse el overlay de llamada, el bridge recibe `suspend()` (libera cámara si la comparte, deja de emitir) y `resume()` al cerrar.
- Si un producto quiere tracking *dentro* de la llamada: instancia explícita con `policy: 'tracking'` y prioridad documentada — el bridge ignora transiciones de presencia mientras `CallSession` esté en `connecting`/`failed` (la llamada manda en sus propios estados).

### D14. Reutilización de cámara entre demo e integración

- **Modo por defecto (desacoplado):** el tracking abre su propio stream con constraints de baja resolución (`{width: 320, height: 240, frameRate: 30}`) vía `navigator.mediaDevices.getUserMedia`. El navegador multiplexa el mismo dispositivo físico sin conflicto con la cámara de la llamada (720p).
- **Modo compartido (opcional):** `MM_Tracking.create` acepta `{ stream }` o `{ videoElement }` externos — la demo de `call.html` puede pasar su `localStream` y el bridge solo hace `drawImage`, sin pedir permisos dos veces.
- Se reutiliza `MM_Media.PermissionManager` para la petición de permisos y el manejo de errores (`NotAllowedError` → `ERROR` con tips al usuario), sin duplicar lógica de permisos.
- El `<video>` de captura del tracking es oculto (`display:none`, `muted`, `playsinline`), separado del `<video>` visible de la llamada.

### D15. Extensión del motor: control externo de párpados

**Cambio acotado en `src/core/engine.js`** (única modificación al core, retrocompatible):

```js
/* API pública nueva — control externo de apertura (EAR del tracker).
 * v ∈ [0,1] (0 cerrado, 1 abierto); null devuelve el control al sistema autónomo. */
setEyeOpen: function (v) {
  this._eyeOpenExt = (v == null) ? null : clamp(+v || 0, 0, 1);
  return this;
}
```

**Mezcla externo/autónomo** (en `_compose`, junto al cálculo actual de `openS`):

```js
var openS = clamp(this._open.x, 0.02, 1.5);       // parpadeo autónomo (spring w=26)
if (this._eyeOpenExt != null) {
  /* El EAR externo pasa por su propio resorte lento (w=14): los párpados
   * siguen al usuario con inercia natural, sin jitter de landmarks.
   * La mezcla es MULTIPLICATIVA (min implícito): el parpadeo autónomo
   * sigue visible sobre la apertura rastreada — un ojo entrecerrado
   * (EAR bajo) aún puede parpadear. */
  this._eyeOpenExtSpring = this._eyeOpenExtSpring || spring(1);
  this._eyeOpenExtSpring.t = this._eyeOpenExt;
  openS = clamp(openS * clamp(this._eyeOpenExtSpring.x, 0, 1), 0.02, 1.5);
}
```

**Rapidez de resortes** (imitar parpadeos reales):

| Resorte | ω actual | ω nuevo | Justificación |
|---|---|---|---|
| `_open` (parpadeo autónomo) | 26 | **26 (sin cambio)** | Cierre+apertura ≈ 150ms ≈ parpadeo humano real (100–400ms) |
| `_eyeOpenExtSpring` (EAR externo) | — | **14** | Seguimiento suave del entrecierre; más rápido que 14 transmitiría jitter de landmarks, más lento se sentiría borroso |
| Paso de integración | subpasos 1/120 | sin cambio | Estabilidad numérica ya garantizada |

### D16. Adaptador de capacidades del motor (`EngineAdapter.js`)

Fachada que desacopla al bridge de la versión del motor (feature detection, no detección de versión):

```js
MM_Tracking.EngineAdapter = function (mate) {
  return {
    setGaze:    function (x, y) { mate.setGaze(x, y); },
    setEyeOpen: mate.setEyeOpen
      ? function (v) { mate.setEyeOpen(v); }
      : function () {},                       // motor antiguo: no-op silencioso
    setEmotion: function (id) { mate.setEmotion(id); },
    hasEyeControl: !!mate.setEyeOpen,
    emotionExists: function (id) { return !!window.MoodMates.config.getRaw(id); }
  };
};
```

El bridge jamás llama al motor directamente: una capa que absorbe diferencias de versión y facilita tests con un motor mock.

### D17. Filtrado One Euro y tamaño de mensajes

- **Filtros independientes** para `gx, gy` (minCutoff 1.0, beta 0.02, dCutoff 1.0 — sintonía inicial, expuesta en config), `ear` (minCutoff 0.8), `pitch/yaw/roll` (minCutoff 0.6, más pesados).
- Los filtros viven en **main thread** (el worker envía datos crudos): permite recalibrar sin reiniciar el worker y mantener el worker stateless (spec §1).
- Frecuencia de mensajes: cada frame procesado (15–30/s), ~200 B por mensaje → ≤6 KB/s de structured clone; despreciable frente al presupuesto <1ms de la spec §3.
- El suavizado exponencial residual del motor (k=5.66, τ≈177ms) actúa como **interpolador 30→60 FPS**; no se desactiva. El One Euro aporta anti-jitter; el del motor aporta continuidad temporal. No es doble filtrado conflictivo porque operan a frecuencias distintas.

---

## 3. Alcance de archivos a entregar

| Archivo | Estado | Contenido |
|---|---|---|
| `src/tracking/MpLoader.js` | 🆕 | Resolución de rutas vendor, precarga, decisión de backend |
| `src/tracking/InferenceBackends.js` | 🆕 | `WorkerBackend` + `MainThreadBackend` + cadena de fallback |
| `src/tracking/FaceTrackerWorker.js` | 🆕 | Script de worker: init modelo, `detectForVideo`, geometría D5–D9 |
| `src/tracking/FaceSelector.js` | 🆕 | argmax(área) + estabilidad temporal (evita cambio de objetivo por 1 frame) |
| `src/tracking/GazeEstimator.js` | 🆕 | Referencia de índices D6 y fórmulas D7 (compartida worker/main) |
| `src/tracking/OneEuroFilter.js` | 🆕 | Filtro + banco de filtros por canal |
| `src/tracking/TrackingStateMachine.js` | 🆕 | Máquina D11 con watchdog y backoff |
| `src/tracking/TrackingBridge.js` | 🆕 | Orquestador + política de emociones D12 + suspend/resume |
| `src/tracking/EngineAdapter.js` | 🆕 | Fachada D16 |
| `src/core/engine.js` | ✏️ parche | `setEyeOpen` + mezcla D15 (~25 líneas, retrocompatible) |
| `assets/vendor/mediapipe/**` | 🆕 binarios | tasks-vision WASM/JS + `face_landmarker.task` |
| `tools/tracking-test.html` | 🆕 | Harness: calibración de ejes, medidor de latencia/FPS, overlay de landmarks |
| `docs/TRACKING.md` | 🆕 | Guía de integración (mismo formato que `INTEGRATION.md`) |

**Sin cambios:** `render.js`, `geometry.js`, `features.js`, `fx.js`, `site/*`, `src/media/*`, personajes, catálogo de emociones.

---

## 4. Plan por fases

### Fase 0 — Fundaciones (0.5 día)
- T-1. Descargar y fijar versión de tasks-vision + `face_landmarker.task` en `assets/vendor/mediapipe/`.
- T-2. `MpLoader.js` + `InferenceBackends.js` con cadena de fallback y telemetría `backend`.

### Fase 1 — Pipeline de tracking (3 días)
- T-3. `FaceTrackerWorker.js`: init, `detectForVideo` en modo `VIDEO`, extracción D5.
- T-4. `GazeEstimator.js` + índices D6; fórmulas D7 con compensación de pose.
- T-5. `FaceSelector.js` (área + estabilidad temporal de 300ms).
- T-6. `OneEuroFilter.js` con parámetros D17.
- T-7. `TrackingStateMachine.js` (D11) con tests de transiciones por timestamps.
- T-8. `TrackingBridge.js` + `EngineAdapter.js` + política de emociones inyectable D12.
- T-9. **Calibración en `tools/tracking-test.html`:** verificación de signos D8 (espejo X, pitch), orden de Euler D9, y amplitud de mapeo del motor (±24/±15px).

### Fase 2 — Párpados y pose (1.5 días)
- T-10. Parche `engine.js`: `setEyeOpen` + resorte externo ω=14 + mezcla multiplicativa D15.
- T-11. Mapeo de pose 2D D10 (roll→rotate, yaw→skew, pitch→y) con límites y atenuación.
- T-12. Integración `index.html`: orden de scripts, botón de activación con consentimiento, `suspend/resume` con overlay de llamada D13.

### Fase 3 — Endurecimiento (1 día)
- T-13. Pruebas de fallback: worker bloqueado, modelo 404, permisos denegados, pestaña en background (throttling de timers).
- T-14. Presupuesto de rendimiento: verificar matriz spec §3 (inferencia <33ms adaptativa, filtro+FSM <1ms, mutación DOM <2ms) en hardware medio y bajo.
- T-15. `docs/TRACKING.md` + tabla de desviaciones aceptadas de la spec (M1, M4, M5).

**Estimación total: 6 días de desarrollo + calibración.**

---

## 5. Matriz de riesgos

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | `createImageBitmap`/Worker sin soporte (Safari antiguo) | Media | Alto | Cadena de fallback D3 + `MainThreadBackend` |
| R2 | Orden de Euler / signos incorrectos en pose | Media | Medio | Calibración T-9 con harness visual antes de integrar |
| R3 | Latencia de inferencia >33ms en hardware bajo | Media | Medio | Throttling adaptativo D4 (15 FPS + 256×192) |
| R4 | Doble permiso de cámara (tracking + llamada) | Baja | Bajo | Modo stream compartido D14 |
| R5 | Parpadeo externo peleando con autónomo | Baja | Medio | Mezcla multiplicativa D15 (probada en harness) |
| R6 | Regresión en motor por parche `engine.js` | Baja | Alto | Parche aditivo (`_eyeOpenExt == null` → comportamiento idéntico al actual); suite de galería sin tracking |
| R7 | Backend envía emotionId inexistente | Media | Bajo | Validación D12 + fallback `'02'` del motor |

---

## 6. Desviaciones aceptadas de la especificación

1. **Worker 2 demográfico eliminado** (M1) — sin valor para el tracking, riesgo legal.
2. **Pose por matriz, no por análisis separado** (M2/D9).
3. **Sin CSS Custom Properties en render** (M5) — el diff-guard del motor es equivalente o superior.
4. **Estados ampliados** (D11) — la spec ACTIVE/INACTIVE/INITIALIZING se extiende con ACQUIRING/LOST/ERROR para eliminar bloqueos.
5. **Emociones por presencia vs. por conversación** (D12) — en `ACTIVE` manda el backend, no el tracker.

---

## 7. Preguntas abiertas (bloquean solo su ítem, no el plan)

1. **URL/formato del canal backend** para `setEmotionMap` en caliente (¿WebSocket existente o nuevo endpoint?). *Por defecto: API pública `bridge.setEmotionMap()` y el backend la invoca como prefiera.*
2. **¿Consentimiento de cámara con UI propia** (modal de la galería) o se integra en un flujo existente del producto?
3. **Versión mínima de navegadores objetivo** — si Safari < 17 está en alcance, el `MainThreadBackend` pasa de fallback a camino crítico y se prioriza su endurecimiento en Fase 1.


---

## 8. Trazabilidad de requisitos del solicitante

| Punto solicitado | Sección |
|---|---|
| Plan de integración en formato de documento | Este documento completo |
| Extensión del motor para seguimiento de mirada | D15 (`setEyeOpen`) + M6 (config de instancia) |
| Emociones por estado asignadas por variable desde backend | D12 |
| Convención de ejes y origen del vector de mirada | D8 |
| Índices de landmarks para iris y contorno ocular | D6 |
| Fusión de pose en un único worker | D1 |
| Compatibilidad de MediaPipe en workers | D2, D3, R1 |
| Interfaz de respaldo worker ↔ hilo principal | D3 |
| Control externo de apertura de párpados | D15 |
| Mezcla apertura externa/autónoma | D15 |
| Rapidez de resorte para parpadeos reales | D15 (tabla ω) |
| Giro de cabeza con rotación 3D | D10 (decisión: no) |
| Validación y saneo de valores de mirada | D8 (sanitize) |
| Dirección de mirada desde puntos faciales | D7 |
| Posición del iris respecto a esquinas del ojo | D7 |
| Máquina de estados anti-bloqueo | D11 |
| Filtrado de suavizado y tamaño de mensajes | D17, D5 |
| Empaquetado de MediaPipe para workers | D2 |
| Captura de fotogramas con reducción por canvas | D4 |
| Estructura de datos compacta por rostro | D5 |
| Ángulos de cabeza desde la matriz | D9 |
| Sentido del cabeceo con imagen espejada | D8 |
| Orientación: landmarks vs. matriz | D9 (decisión: matriz) |
| Alcance de archivos de seguimiento | §3 |
| Módulos de carga y ejecución de MediaPipe | D2 (`MpLoader`) |
| Reutilización de cámara demo/integración | D14 |
| Políticas de emoción separadas tracking/llamada | D13 |
| Flujo de fotogramas y detección de rostro objetivo | §1, D4, D5 |
| Adaptador de capacidades del motor | D16 |
| Backends de inferencia y mecanismo de respaldo | D3 |
| Captura de fotogramas y creación de bitmaps | D4 |
