# TDD — Motor Gráfico Vectorial basado en Scene Graph

**Estado:** Baseline arquitectónico
**Versión:** 1.0
**Tipo:** Documento de Diseño Técnico (TDD)
**Propósito:** Definir contratos e invariantes del motor gráfico reutilizable.

---

# 1. Resumen y Propósito

## 1.1 Objetivo

Diseñar un motor gráfico 2D vectorial basado en **Scene Graph**, reutilizable para múltiples personajes y escenas animadas.

El motor deberá permitir:

* composición jerárquica de objetos gráficos;
* transformaciones afines;
* geometría vectorial dinámica;
* interpolación y morphing;
* animaciones físicas y temporales;
* partículas;
* overlays jerárquicos;
* proyecciones pseudo-3D;
* interacción mediante hit-testing;
* gestión de eventos;
* máquinas de estados de dominio;
* invalidación selectiva;
* desacoplamiento completo entre Scene Graph y backend gráfico;
* ejecución inicial sobre Canvas2D;
* posibilidad de incorporar WebGL2 posteriormente.

## 1.2 Caso de validación inicial

El primer consumidor será:

`balon_imagen`

Esta escena reproducirá las capacidades visuales y comportamentales relevantes de:

`aora-bot/emotion-ball`

incluyendo:

* cuerpo;
* ojos;
* pupilas;
* boca;
* morphing vectorial;
* movimiento pseudo-3D;
* cintas;
* partículas;
* overlays;
* estados emocionales;
* animaciones;
* interacción.

`balon_imagen` **no define el motor**. Es una composición concreta que utiliza el motor.

---

# 2. Principios Arquitectónicos

## PA-01 — Separación de responsabilidades

Cada capa debe tener una responsabilidad única y explícita.

```text
Math
  ↓
Geometry
  ↓
Scene Graph
  ↓
Animation / Domain
  ↓
Render Commands
  ↓
Renderer
  ↓
Backend
```

Ninguna capa inferior puede depender de una capa superior.

---

## PA-02 — El dominio no conoce el renderer

`EmotionFSM`, `PoseResolver` y demás componentes de dominio no deben conocer:

* Canvas;
* CanvasRenderingContext2D;
* WebGL;
* Renderer;
* RenderCommandQueue.

---

## PA-03 — El Scene Graph no conoce el backend

Un `SceneNode` no debe ejecutar:

```javascript
ctx.fill()
ctx.stroke()
ctx.translate()
ctx.rotate()
```

El nodo describe **qué es** y **dónde está**.

El renderer decide **cómo se dibuja**.

---

## PA-04 — El tiempo pertenece al Engine

Ningún módulo de animación debe consultar directamente:

```javascript
Date.now()
performance.now()
```

El tiempo debe proceder de:

```text
Clock
  ↓
deltaTime
```

Esto permite ejecución determinista en pruebas.

---

## PA-05 — Las emociones son dominio

Una emoción no es una propiedad gráfica.

```text
Emotion
   ↓
EmotionFSM
   ↓
PoseResolver
   ↓
Pose
   ↓
Animation
   ↓
Scene Graph
```

---

# 3. Arquitectura General

```text
                         APPLICATION
                              │
                    ┌─────────┴─────────┐
                    │                   │
              Interaction          EmotionFSM
                    │                   │
                    └─────────┬─────────┘
                              ↓
                         PoseResolver
                              ↓
                         Animation
                              ↓
                         Scene Graph
                              ↓
                  Transform / Geometry
                              ↓
                     Dirty / Bounds
                              ↓
                    RenderCommandQueue
                              ↓
                          Renderer
                              ↓
                    ┌─────────┴─────────┐
                    │                   │
               Canvas2D             WebGL2
```

---

# 4. Estructura del Proyecto

```text
src/
│
├── math/
│   ├── Vector2.js
│   ├── Matrix3x3.js
│   ├── Transform.js
│   └── AABB.js
│
├── geometry/
│   ├── Path.js
│   ├── BezierPath.js
│   ├── Circle.js
│   └── GeometryUtils.js
│
├── scenegraph/
│   ├── SceneNode.js
│   ├── GroupNode.js
│   ├── PathNode.js
│   └── CircleNode.js
│
├── events/
│   ├── Event.js
│   ├── EventDispatcher.js
│   ├── InteractionEngine.js
│   └── HitTester.js
│
├── animation/
│   ├── Animation.js
│   ├── AnimationTrack.js
│   ├── AnimationController.js
│   ├── AnimationQueue.js
│   ├── SpringSolver.js
│   ├── PathInterpolator.js
│   └── Easing.js
│
├── domain/
│   ├── Emotion.js
│   ├── EmotionDefinition.js
│   ├── EmotionEvent.js
│   ├── EmotionFSM.js
│   ├── Pose.js
│   └── PoseResolver.js
│
├── resources/
│   ├── AssetManager.js
│   ├── EmotionLoader.js
│   └── ResourceCache.js
│
├── renderer/
│   ├── Renderer.js
│   └── Canvas2DRenderer.js
│
├── engine/
│   ├── Engine.js
│   ├── Clock.js
│   ├── Scheduler.js
│   └── DirtyRegionManager.js
│
└── character/
    └── balon_imagen.js
```

---

# 5. Contratos Fundamentales

## 5.1 SceneNode

Todo nodo debe proporcionar conceptualmente:

```text
parent
children
localTransform
worldTransform
localBounds
worldBounds
visibility
dirtyState
```

### Contrato

```text
addChild(node)
removeChild(node)

updateWorldTransform()
updateBounds()

localToWorld(point)
worldToLocal(point)

invalidate(flags)

render(renderer)
```

El método `render()` no debe realizar directamente operaciones de backend si se mantiene el desacoplamiento por comandos.

---

# 6. Sistema de Coordenadas

El motor reconoce:

```text
Local Space
     ↓
Parent Space
     ↓
World Space
     ↓
View Space
     ↓
Screen Space
```

## Invariante TRANS-01

Para cualquier nodo:

```text
WorldMatrix =
ParentWorldMatrix × LocalMatrix
```

Para el nodo raíz:

```text
WorldMatrix = LocalMatrix
```

## Invariante TRANS-02

Debe cumplirse:

```text
worldToLocal(localToWorld(P)) ≈ P
```

considerando la tolerancia numérica definida por el motor.

## Invariante TRANS-03

Una matriz no invertible no puede utilizarse para hit-testing inverso.

---

# 7. Transform

`Transform` representa la intención geométrica.

Debe contener conceptualmente:

```text
position
rotation
scale
```

La representación matricial corresponde a:

```text
Matrix3x3
```

`Transform` no debe duplicar la lógica matemática de `Matrix3x3`.

---

# 8. Geometry

La geometría debe ser independiente del Scene Graph.

```text
PathNode
    ↓
Path
    ↓
BezierPath
```

y:

```text
CircleNode
    ↓
Circle
```

## Invariante GEO-01

Modificar una geometría debe invalidar sus bounds.

## Invariante GEO-02

La geometría no conoce:

* SceneNode;
* Renderer;
* Canvas;
* WebGL;
* FSM.

---

# 9. Bounding Boxes

Cada nodo debe poder determinar:

```text
localBounds
worldBounds
```

La transformación de bounds debe producir un AABB válido en el espacio correspondiente.

## Invariante BND-01

Si cambia la geometría o transformación que afecta al nodo:

```text
boundsDirty = true
```

## Invariante BND-02

Un nodo invisible no participa en hit-testing ni renderizado, salvo que una operación explícita indique lo contrario.

---

# 10. Dirty State

Estados mínimos:

```text
TRANSFORM_DIRTY
GEOMETRY_DIRTY
BOUNDS_DIRTY
STYLE_DIRTY
CHILDREN_DIRTY
RENDER_DIRTY
```

## Propagación

Ejemplo:

```text
TRANSFORM_DIRTY
      ↓
BOUNDS_DIRTY
      ↓
RENDER_DIRTY
```

Geometría:

```text
GEOMETRY_DIRTY
      ↓
BOUNDS_DIRTY
      ↓
RENDER_DIRTY
```

Estilo:

```text
STYLE_DIRTY
      ↓
RENDER_DIRTY
```

---

# 11. Dirty Regions

Cuando cambia un objeto animado:

```text
oldBounds
     +
newBounds
     ↓
union(oldBounds, newBounds)
     ↓
DirtyRegion
```

Esto evita dejar residuos visuales de la posición anterior.

El `DirtyRegionManager` administra estas regiones.

---

# 12. Eventos e Interacción

## Flujo

```text
Input
 ↓
InteractionEngine
 ↓
HitTester
 ↓
EventDispatcher
 ↓
Capture
 ↓
Target
 ↓
Bubble
```

## Hit Testing

Para probar un punto global contra un nodo:

```text
Global Point
     ↓
inverse(WorldMatrix)
     ↓
Local Point
     ↓
Local Geometry
     ↓
Hit / Miss
```

## Invariante EVT-01

El hit-testing de un nodo transformado debe producir el mismo resultado independientemente de la transformación utilizada, siempre que el punto corresponda al mismo punto geométrico.

---

# 13. Animation

La animación está separada del Scene Graph.

Componentes:

```text
Animation
AnimationTrack
AnimationController
AnimationQueue
SpringSolver
PathInterpolator
Easing
```

## Flujo

```text
Clock
 ↓
deltaTime
 ↓
AnimationController
 ↓
AnimationTrack
 ↓
Target Property
 ↓
SceneNode / Pose
```

Una animación no debe modificar directamente el renderer.

---

# 14. SpringSolver

Debe representar un sistema físico de segundo orden.

Entrada conceptual:

```text
current
target
velocity
deltaTime
parameters
```

Salida:

```text
newValue
newVelocity
```

## Invariante ANIM-01

Con:

```text
current == target
velocity == 0
```

el solver estable no debe introducir movimiento espontáneo.

## Invariante ANIM-02

El solver no depende del frame rate directamente; utiliza `deltaTime`.

---

# 15. PathInterpolator

Debe permitir:

```text
Path A
   ↓
interpolation(t)
   ↓
Path B
```

## Invariante ANIM-03

Los paths interpolables deben tener una estructura compatible.

Si no son compatibles:

```text
InterpolationError
```

o debe existir un proceso explícito de normalización.

No se permite realizar una interpolación geométrica ambigua silenciosamente.

---

# 16. Domain — EmotionFSM

La FSM administra únicamente estados afectivos.

Ejemplo:

```text
IDLE
HAPPY
SAD
ANGRY
SLEEP
...
```

Entrada:

```text
EmotionEvent
```

Salida:

```text
EmotionState
```

## La FSM NO debe:

```text
modificar SceneNode
calcular AABB
dibujar
ejecutar Canvas
realizar hit testing
```

---

# 17. PoseResolver

Responsabilidad:

```text
EmotionState
      ↓
Pose
```

Una `Pose` describe objetivos visuales.

Ejemplo:

```text
body
eyes
mouth
orientation
gaze
scale
rotation
```

La pose es un **estado objetivo**, no necesariamente el estado visual instantáneo.

---

# 18. InteractionEngine

Gestiona interacción física:

```text
hover
click
drag
pointer movement
```

Puede producir dos tipos de resultado:

### Target directo

Ejemplo:

```text
gazeTarget = mousePosition
```

### Intención de dominio

Ejemplo:

```text
EmotionEvent("SURPRISED")
```

La interacción no modifica directamente la FSM salvo mediante el contrato correspondiente.

---

# 19. Resources

Los recursos deben ser independientes del renderer.

Responsabilidades:

```text
AssetManager
EmotionLoader
ResourceCache
```

No deben contener lógica de presentación.

---

# 20. RenderCommandQueue

El Scene Graph no debe depender de un backend concreto.

Flujo:

```text
Scene Graph
     ↓
Render Commands
     ↓
RenderCommandQueue
     ↓
Renderer
```

Comandos conceptuales:

```text
SetTransform
SetOpacity
SetClip
DrawPath
DrawCircle
DrawParticles
PushState
PopState
```

La lista definitiva de comandos será definida en el TDD del renderer.

---

# 21. Renderer

Contrato conceptual:

```text
beginFrame()
submit(commands)
endFrame()
```

El renderer consume comandos.

Implementación inicial:

```text
Canvas2DRenderer
```

Implementación futura:

```text
WebGL2Renderer
```

## Invariante RND-01

Ningún `SceneNode` debe requerir conocimiento de la implementación concreta del renderer.

---

# 22. Engine

`Engine` coordina:

```text
Clock
Scheduler
Scene update
Animation
Invalidation
Render
```

Ciclo:

```text
┌──────────────────────────┐
│         FRAME            │
└────────────┬─────────────┘
             ↓
          Clock
             ↓
       Event Processing
             ↓
        Domain Update
             ↓
       Animation Update
             ↓
       Scene Update
             ↓
       Bounds Update
             ↓
       Dirty Regions
             ↓
      Render Commands
             ↓
          Renderer
             ↓
       Present Frame
```

---

# 23. Scheduler

El Scheduler coordina trabajos temporales.

Debe permitir diferenciar:

```text
update
animation
render
deferred work
```

El orden de ejecución debe ser determinista.

---

# 24. Observabilidad y Trazabilidad

Cada transformación relevante del sistema debe poder rastrearse conceptualmente:

```text
Input
 ↓
InteractionEngine
 ↓
EmotionEvent
 ↓
EmotionFSM
 ↓
PoseResolver
 ↓
AnimationController
 ↓
SceneNode
 ↓
Transform
 ↓
AABB / Dirty
 ↓
RenderCommand
 ↓
Renderer
 ↓
Pantalla
```

La implementación podrá proporcionar instrumentación para inspeccionar este flujo.

---

# 25. Reglas de Dependencia

Las dependencias permitidas son:

```text
math
  ↑
geometry
  ↑
scenegraph
  ↑
animation
  ↑
domain
  ↑
character
```

Pero el renderer se mantiene transversal:

```text
scenegraph
     ↓
renderer
```

y:

```text
domain ─X→ renderer
geometry ─X→ renderer
math ─X→ renderer
```

El dominio nunca debe depender de presentación.

---

# 26. Manejo de Errores

Errores deben clasificarse como mínimo:

```text
MathError
GeometryError
SceneGraphError
AnimationError
DomainError
RenderError
ResourceError
```

Los errores deben producir fallos explícitos.

No se permite convertir silenciosamente:

```text
NaN
Infinity
undefined
matrices inválidas
paths incompatibles
```

en estados gráficos aparentemente válidos.

---

# 27. Rendimiento

El motor será medido mediante:

```text
FPS
Frame Time
CPU Time / Frame
Render Time / Frame
Animation Time / Frame
Nodes Updated
Nodes Rendered
Render Commands
Dirty Area
Memory Allocation / Frame
GC Pauses
```

La métrica objetivo inicial será:

```text
60 FPS
≈ 16.67 ms/frame
```

Este valor es un objetivo de referencia, no una garantía.

Los límites específicos se establecerán después del benchmark de referencia contra `emotion-ball`.

---

# 28. Memoria

Se deberá observar:

```text
Heap utilizado
Heap máximo
Objetos creados por frame
Buffers
Geometrías cacheadas
Render commands
Partículas
```

Especial atención a:

```text
allocation churn
```

durante animaciones continuas.

---

# 29. Pruebas

## 29.1 Math

Debe verificarse:

```text
M × Identity = M
M × inverse(M) ≈ Identity
inverse(inverse(M)) ≈ M
```

## 29.2 Scene Graph

Debe verificarse:

```text
parent → child transform
world/local conversion
bounds propagation
dirty propagation
node insertion/removal
```

## 29.3 Events

Debe verificarse:

```text
hit testing
capture
target
bubble
transformed nodes
nested nodes
```

## 29.4 Animation

Debe verificarse:

```text
deltaTime
spring convergence
path interpolation
animation sequencing
priority
interruption
```

## 29.5 FSM

Debe verificarse:

```text
valid transitions
invalid transitions
priority
queue
determinism
```

## 29.6 Renderer

Debe verificarse:

```text
command generation
command ordering
transform application
clipping
opacity
geometry rendering
```

---

# 30. Criterios de Aceptación

El motor será considerado funcional cuando:

* [ ] Los nodos puedan componerse jerárquicamente.
* [ ] Las transformaciones local/world funcionen correctamente.
* [ ] Las matrices puedan invertirse correctamente.
* [ ] Los bounds se actualicen correctamente.
* [ ] La invalidación sea consistente.
* [ ] El hit-testing funcione con transformaciones.
* [ ] Los eventos puedan propagarse Capture/Target/Bubble.
* [ ] Las animaciones sean independientes del frame rate.
* [ ] El SpringSolver sea determinista bajo un `Clock` controlado.
* [ ] La FSM sea determinista.
* [ ] `PoseResolver` produzca poses válidas.
* [ ] Scene Graph y renderer estén desacoplados.
* [ ] Canvas2D pueda consumir `RenderCommandQueue`.
* [ ] `balon_imagen` reproduzca las capacidades visuales definidas del caso `aora-bot`.
* [ ] Exista instrumentación suficiente para rastrear `evento → estado → pose → animación → nodo → render`.

---

# 31. Criterio de Arquitectura

La implementación **no se considerará correcta únicamente porque la animación se vea bien**.

Debe cumplir simultáneamente:

```text
Correctitud matemática
        +
Correctitud geométrica
        +
Correctitud temporal
        +
Correctitud de estados
        +
Correctitud de interacción
        +
Correctitud de render
        +
Separación de responsabilidades
        +
Trazabilidad
```

Una implementación que produzca la misma imagen pero viole estos contratos será considerada arquitectónicamente incorrecta.

---

# 32. Orden de Implementación

La implementación deberá seguir el grafo de dependencias:

```text
1. Vector2
       ↓
2. Matrix3x3
       ↓
3. Transform
       ↓
4. AABB
       ↓
5. Geometry
       ↓
6. SceneNode
       ↓
7. GroupNode / PathNode / CircleNode
       ↓
8. HitTester / Events
       ↓
9. Clock
       ↓
10. Animation primitives
       ↓
11. AnimationController
       ↓
12. EmotionFSM
       ↓
13. PoseResolver
       ↓
14. RenderCommandQueue
       ↓
15. Canvas2DRenderer
       ↓
16. Engine
       ↓
17. balon_imagen
```

Cada etapa debe contar con sus propias pruebas antes de avanzar a la siguiente.

---

# 33. Regla de Evolución

Ningún nuevo componente debe incorporarse al motor únicamente porque resulte conveniente para una implementación concreta.

Antes de agregar una abstracción deberá responderse:

1. ¿Qué responsabilidad encapsula?
2. ¿Qué contrato expone?
3. ¿Qué dependencia introduce?
4. ¿Qué problema arquitectónico resuelve?
5. ¿Qué componente existente no debería asumir esa responsabilidad?

Si no existe una respuesta clara, la abstracción no debe incorporarse.

---

# 34. Definición de Éxito

El resultado final será un motor gráfico reutilizable en el que:

```text
Character
   ↓
Domain
   ↓
Pose
   ↓
Animation
   ↓
Scene Graph
   ↓
Geometry
   ↓
Render Commands
   ↓
Renderer
   ↓
Backend
```

estén separados mediante contratos explícitos.

`balon_imagen` será la primera implementación de referencia y servirá como prueba de que el motor puede reproducir una escena vectorial animada compleja sin acoplar la arquitectura general a ese personaje.
