DOCUMENTO DE ESPECIFICACIÓN TÉCNICA Y ARQUITECTURASistema de Seguimiento Facial para Bot Animado SVG1. Arquitectura del Sistema (Inferencia Desacoplada)El sistema opera mediante dos bucles asíncronos desacoplados para aislar el renderizado gráfico de la inferencia pesada y las métricas secundarias:Bucle de Inferencia Crítica (High-Frequency / Worker 1): Inferencia de landmarks de rostro e iris a 30 FPS.Bucle de Análisis Estadístico (Low-Frequency / Worker 2): Estimación de pose de la cabeza (Head Pose) y clasificación demográfica (edad/género) ejecutado de manera stateless a baja frecuencia (~2-5 FPS).Bucle de Renderizado Gráfico (Render Loop / Main Thread): Animación SVG a 60 FPS con interpolación continua (One Euro Filter).   ┌────────────────────────────────────────────────────────┐
   │                   CÁMARA LOCAL                         │
   └──────────────────────────┬─────────────────────────────┘
                              │ HTMLVideoElement (Local Stream)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          WEB WORKER 1                           │
│  MediaPipe Face Landmarker (WASM/WebGL)                         │
│  - Extracción de Bounding Boxes e Iris                          │
└──────────────┬──────────────────────────────────────────────────┘
               │ Landmarker Array @ 30 FPS
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FACESELECTOR MODULE                        │
│  - Criterio: MAX(Width x Height)                                │
└──────────────┬──────────────────────────────────────────────────┘
               │ Target Face Landmarks
               ├──────────────────────────────────┐
               ▼                                  ▼
┌───────────────────────────────┐  ┌──────────────────────────────┐
│         WEB WORKER 2          │  │     STATE MACHINE CONTROLLER │
│  Inferencia Stateless (~3 Hz) │  │  - Active / Inactive State   │
│  - Head Pose (Roll, Pitch, Yaw│  │  - Hysteresis Timer (1000ms) │
│  - Demographics (Age/Gender)  │  └──────────────┬───────────────┘
└──────────────┬────────────────┘                 │
               │ Metadata                         │ Target Coords + State
               └─────────────────┬────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PUPILTRACKER                            │
│  - Coordenadas Normalizadas [-1.0, 1.0]                         │
│  - One Euro Filter (Anti-Jitter / Smoothing)                    │
└──────────────┬──────────────────────────────────────────────────┘
               │ Target Look Vector (x, y)
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EYEVISUALSTATE                           │
│  - Mapeo de Parámetros SVG                                      │
│  - Gestión de Estados: "INACTIVE", "INITIALIZING", "ACTIVE"     │
└──────────────┬──────────────────────────────────────────────────┘
               │ EyeState Object
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SVG RENDER ENGINE (60 FPS)                   │
│  - Mutación directa de CSS Variables / Attributes (transform)   │
└─────────────────────────────────────────────────────────────────┘
2. Definición de Módulos y Contratos de Datos2.1. FaceSelector (Selección Multirrostro)Filtra los rostros detectados en el cuadro para seleccionar únicamente el rostro dominante de mayor proximidad a la cámara.Fórmula de Selección:$$\text{TargetFace} = \arg\max_{i \in \text{Faces}} (\text{Width}_i \times \text{Height}_i)$$JavaScriptclass FaceSelector {
  static selectPrimaryFace(faces) {
    if (!faces || faces.length === 0) return null;
    
    let maxArea = 0;
    let primaryFace = null;

    for (let i = 0; i < faces.length; i++) {
      const bbox = faces[i].boundingBox;
      const area = bbox.width * bbox.height;
      if (area > maxArea) {
        maxArea = area;
        primaryFace = faces[i];
      }
    }
    return primaryFace;
  }
}
2.2. State Machine Controller (Manejo de Pérdida de Tracking con Histéresis)Evita transiciones abruptas del estado del bot ante oclusiones temporales, parpadeos o pérdidas momentáneas de detección.Regla de Negocio: La transición al estado "INACTIVE" solo se concreta tras la ausencia continua del objetivo durante 1000 ms.TypeScripttype SystemState = "INITIALIZING" | "ACTIVE" | "INACTIVE";

interface StateConfig {
  inactivityTimeoutMs: number; // Defecto: 1000ms
}

class TrackingStateMachine {
  private currentState: SystemState = "INITIALIZING";
  private lastDetectedTimestamp: number = 0;
  private readonly timeoutMs: number;

  constructor(config: StateConfig = { inactivityTimeoutMs: 1000 }) {
    this.timeoutMs = config.inactivityTimeoutMs;
  }

  public update(faceDetected: boolean, currentTimestamp: number): SystemState {
    if (faceDetected) {
      this.lastDetectedTimestamp = currentTimestamp;
      this.currentState = "ACTIVE";
    } else {
      if (this.currentState === "ACTIVE") {
        const elapsedTime = currentTimestamp - this.lastDetectedTimestamp;
        if (elapsedTime >= this.timeoutMs) {
          this.currentState = "INACTIVE";
        }
      }
    }
    return this.currentState;
  }

  public getState(): SystemState {
    return this.currentState;
  }
}
2.3. PupilTracker (Filtro de Ruido e Interpolación)Transforma las coordenadas absolutas de la imagen en vectores de mirada normalizados $X, Y \in [-1.0, 1.0]$, suavizando la señal con un One Euro Filter para eliminar jittering manteniendo baja latencia.TypeScriptinterface NormalizedGazeVector {
  x: number; // [-1.0, 1.0]
  y: number; // [-1.0, 1.0]
  confidence: number;
}

// Estructura de Salida hacia EyeVisualState
interface TrackingFramePayload {
  gazeVector: NormalizedGazeVector;
  systemState: SystemState;
  demographics?: {
    gender: "male" | "female" | "unknown";
    ageGroup: string;
  };
  headPose?: {
    pitch: number;
    yaw: number;
    roll: number;
  };
}
2.4. EyeVisualState y Motor SVGPara maximizar el rendimiento en un contexto de renderizado SVG interactivo sin provocar colapsos del DOM Layout/Reflow, la manipulación del motor gráfico se realiza exclusivamente mediante variables CSS personalizadas (CSS Custom Properties) o transformaciones matriciales directas (transform="matrix(...)").Estrategia de Renderizado SVGSe descarta modificar atributos que forcen reclculo de layout (ej. cx, cy, r dinámicos vía setAttribute repetitivo).Se utilizan nodos manipulados por transformación de hardware: transform: translate3d(var(--pupil-x), var(--pupil-y), 0).JavaScriptclass SVGEyeRenderer {
  constructor(svgRootElement) {
    this.svgRoot = svgRootElement;
  }

  render(eyeVisualState) {
    const { state, pupilX, pupilY, eyelidAperture } = eyeVisualState;

    if (state === "INACTIVE") {
      // Aplicar animación o postura neutral por CSS/Estado
      this.svgRoot.classList.add("bot-state-inactive");
      this.svgRoot.classList.remove("bot-state-active");
      return;
    }

    this.svgRoot.classList.add("bot-state-active");
    this.svgRoot.classList.remove("bot-state-inactive");

    // Mutación eficiente de baja sobrecarga (No Layout Thrashing)
    this.svgRoot.style.setProperty('--pupil-x', `${pupilX}px`);
    this.svgRoot.style.setProperty('--pupil-y', `${pupilY}px`);
    this.svgRoot.style.setProperty('--eyelid-aperture', `${eyelidAperture}`);
  }
}
3. Matriz de Requisitos de RendimientoMóduloFrecuencia de EjecuciónEntorno de EjecuciónUmbral Máximo de LatenciaInferencia Landmark/Iris30 FPSWeb Worker (WASM/WebGL)$< 20\text{ ms}$Análisis Demográfico/Pose2–5 FPS (Stateless)Web Worker (Dedicado)$< 150\text{ ms}$Filtro & State Machine60 FPS (Bucle local)Main Thread$< 1\text{ ms}$Mutación DOM (SVG)60 FPS (rAF)Main Thread$< 2\text{ ms}$4. Compromisos de Diseño AceptadosEficiencia SVG: La reactividad del Bot dependerá de la complejidad interna del documento SVG. Las pupilas, párpados y elementos móviles deben estar contenidos en grupos <g> aislados para garantizar aceleración por GPU.Independencia Demográfica: El Bot no modificará su vector de seguimiento al recibir actualización de la inferencia demográfica; esta información actuará únicamente como metadato secundario para cambiar reglas de comportamiento global en EyeVisualState (ej. tasa de parpadeo, expresividad o escala de respuesta).