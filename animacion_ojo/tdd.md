# TDD — Motor Gráfico Vectorial basado en Scene Graph

**Archivo:** `tdd.md`  
**Versión contractual:** 3.0  
**Estado:** Especificación cerrada para implementación  
**Naturaleza:** Contrato técnico, funcional, matemático, temporal y de integración  
**Caso de referencia:** `emotion-ball` de `sam70361/aora-bot`  
**Backend inicial:** Canvas2D  
**Backend futuro previsto:** WebGL2  

---

# 0. Propósito y carácter contractual

Este documento es la especificación contractual cerrada del motor.

No es una descripción orientativa, una colección de sugerencias ni una guía de estilo.

Toda implementación derivada de este documento DEBE conservar:

- responsabilidades;
- contratos de funciones;
- precondiciones;
- postcondiciones;
- mutaciones;
- invariantes;
- secuencias;
- errores;
- relaciones de dependencia;
- efectos observables;
- capacidades funcionales del caso de referencia.

Una implementación interna diferente sólo es admisible cuando demuestre equivalencia con el contrato observable y no viole ninguna restricción explícita.

## 0.1 Léxico normativo

- **DEBE:** obligatorio.
- **NO DEBE:** prohibido.
- **PUEDE:** permitido sin obligación.
- **NO ES VÁLIDO:** incumplimiento contractual.
- **INVARIANTE:** propiedad que debe permanecer válida.
- **PRECONDICIÓN:** condición necesaria antes de una operación.
- **POSTCONDICIÓN:** condición exigida después de una operación exitosa.
- **MUTACIÓN:** modificación de estado observable o relevante.
- **EFECTO OBSERVABLE:** resultado que puede verificar otro módulo, renderer, prueba o instrumentación.
- **TARGET:** estado objetivo hacia el cual evoluciona una animación.
- **CURRENT:** estado actualmente representado.

## 0.2 Regla de ausencia de especificación

Si una función requiere una decisión semántica que no está definida aquí, NO DEBE inventarse una política silenciosa.

La conducta debe considerarse **bloqueada por especificación** hasta completar el contrato.

NO ES VÁLIDO resolver ambigüedades mediante:

- valores por defecto arbitrarios;
- degradación silenciosa;
- eliminación de una capacidad;
- sustitución por una aproximación visual;
- comportamiento dependiente del runtime;
- comportamiento dependiente del orden accidental de llamadas.

## 0.3 Regla de integridad funcional

Una optimización sólo puede reducir trabajo interno. Nunca puede eliminar una operación requerida por contrato ni cambiar su efecto observable.

---

# 1. Objetivo funcional del motor

El motor DEBE proporcionar una plataforma agnóstica reutilizable para personajes vectoriales animados.

Debe soportar, sin depender de un personaje concreto:

1. jerarquía de nodos;
2. transformaciones afines 2D;
3. conversión entre espacios de coordenadas;
4. geometría vectorial;
5. morphing/interpolación de geometría compatible;
6. bounds locales y globales;
7. invalidación por dirty flags;
8. dirty regions;
9. hit testing geométrico mediante transformación inversa;
10. propagación de eventos Capture/Target/Bubble;
11. animaciones temporales;
12. solver de muelle de segundo orden;
13. colas y prioridad de animación;
14. FSM emocional determinista;
15. resolución de estado a pose;
16. partículas;
17. proyección pseudo-3D;
18. overlays jerárquicos;
19. generación de comandos de render;
20. backend Canvas2D;
21. sustitución futura por WebGL2 sin modificar dominio, geometría ni Scene Graph.

---

# 2. Composición funcional de referencia

`balon_imagen` DEBE poder representar como mínimo:

```text
balon_imagen
├── BodyNode
├── LeftEyeNode
│   └── PupilNode
├── RightEyeNode
│   └── PupilNode
├── MouthNode
├── RibbonLayer
├── ParticleLayer
└── ZzzLayer
```

La composición anterior es un requisito funcional para el personaje de referencia. El motor general no puede depender de que exista exactamente esta composición.

---

# 3. Arquitectura de capas y dependencias

```text
math
  ↓
geometry
  ↓
scenegraph
  ↓
animation
  ↓
domain
  ↓
character
```

La ruta de render es transversal:

```text
SceneGraph
   ↓
RenderCommandQueue
   ↓
Renderer
   ↓
Backend
```

La interacción entra por:

```text
Input
  ↓
InteractionEngine
  ↓
HitTester / EventDispatcher
  ↓
Runtime Target o EmotionEvent
```

## 3.1 Prohibiciones por capa

### `math/` NO DEBE

- conocer Scene Graph;
- conocer emociones;
- conocer renderer;
- producir eventos.

### `geometry/` NO DEBE

- conocer Scene Graph;
- conocer FSM;
- conocer renderer;
- modificar estado externo arbitrariamente.

### `scenegraph/` NO DEBE

- decidir emociones;
- ejecutar FSM;
- acceder directamente a Canvas2D;
- acceder directamente a WebGL2.

### `animation/` NO DEBE

- decidir transiciones emocionales;
- acceder directamente al backend;
- obtener tiempo mediante relojes propios.

### `domain/` NO DEBE

- renderizar;
- modificar nodos directamente;
- realizar hit testing;
- acceder a Canvas/WebGL.

### `renderer/` NO DEBE

- cambiar FSM;
- alterar Pose;
- generar eventos de negocio;
- inventar animaciones.

### `engine/` NO DEBE

- contener reglas específicas de `balon_imagen`;
- decidir emociones por conveniencia;
- corregir silenciosamente estados inválidos.

---

# 4. Contrato obligatorio de toda función

Toda función pública, protegida y toda función interna que cambie estado significativo DEBE tener identificado como mínimo:

```text
FUNCTION-ID
Nombre y firma
Responsabilidad única
Caller autorizado
Dependencias directas
Entradas
Precondiciones
Estado leído
Operación exacta
Estado modificado
Estado prohibido para modificar
Salida
Postcondiciones
Efectos secundarios
Eventos generados
Errores
Invariantes preservadas
Consumidores
Efecto observable
Casos límite
Complejidad esperada
Pruebas obligatorias
```

Si una función auxiliar cambia una condición relevante, también queda sometida a esta regla.

## 4.1 Regla de no ocultación

Una función NO DEBE ocultar dentro de otra función una responsabilidad que este TDD haya asignado a otro módulo.

Ejemplo NO VÁLIDO:

```text
PoseResolver.resolve()
    └── modifica SceneNode directamente
```

---

# 5. Convenciones globales de datos

## 5.1 Números

Toda entrada numérica geométrica o temporal DEBE ser finita.

`NaN`, `Infinity` y `-Infinity` son entradas inválidas salvo una representación explícita de estado que el contrato de esa función defina.

## 5.2 Unidades

- posiciones: unidades lógicas del mundo/escena;
- rotaciones: radianes en APIs matemáticas internas;
- tiempo: segundos;
- opacidad: rango `[0,1]`;
- parámetros normalizados: `[0,1]` cuando el contrato lo indique.

## 5.3 Aproximación numérica

Las comparaciones de punto flotante DEBEN utilizar tolerancia explícita cuando corresponda.

No se permite usar comparación exacta para validar equivalencia matemática aproximada de matrices o vectores transformados.

---

# 6. Ciclo de frame contractual

Cada frame debe respetar el siguiente orden lógico:

```text
F0  Clock.getDeltaTime()
F1  Captura/recepción de input
F2  Hit testing y dispatch
F3  Procesamiento de EmotionEvent
F4  EmotionFSM
F5  PoseResolver
F6  AnimationController
F7  Actualización de Scene Graph
F8  Transform propagation
F9  Geometry update
F10 Bounds update
F11 DirtyRegionManager
F12 RenderCommandQueue
F13 Renderer
F14 Presentación
```

## 6.1 Prohibiciones

NO ES VÁLIDO:

- renderizar antes de terminar F10 para comandos dependientes de bounds;
- actualizar dominio durante F13;
- modificar geometría mientras F13 consume comandos;
- utilizar varios relojes independientes;
- ejecutar una misma animación dos veces en el mismo frame;
- aplicar una transición emocional parcialmente antes de completar la resolución de la entrada correspondiente.

---

# 7. `math/Vector2.js`

## Estado contractual

```text
x: number finito
y: number finito
```

### 7.1 `constructor(x, y)`

**FUNCTION-ID:** `VEC-001`  
**Responsabilidad:** crear un vector válido.  
**Caller:** cualquier módulo matemático o consumidor autorizado.  
**Precondiciones:** `x` e `y` deben ser números finitos.  
**Lee:** argumentos.  
**Muta:** crea una instancia; no modifica argumentos externos.  
**Salida:** `Vector2`.  
**Postcondición:** `result.x === x` y `result.y === y`.  
**Error:** `InvalidNumericInputError` si algún componente no es finito.  
**Invariantes:** componentes finitos.  
**Efecto observable:** existe un vector con los componentes solicitados.  
**Casos límite:** cero permitido; negativos permitidos.  
**Pruebas:** cero, negativo, decimal, `NaN`, infinito.

### 7.2 `clone()`

**FUNCTION-ID:** `VEC-002`  
**Responsabilidad:** producir una copia independiente.  
**Entrada:** ninguna.  
**Lee:** `this.x`, `this.y`.  
**Muta:** no modifica `this`.  
**Salida:** nuevo `Vector2`.  
**Postcondición:** componentes iguales y referencias distintas.  
**Error:** ninguno en estado válido.  
**Efecto observable:** mutar la copia no cambia el original.

### 7.3 `add(other)`

**FUNCTION-ID:** `VEC-003`  
**Entrada:** `Vector2 other`.  
**Precondición:** `other` válido.  
**Operación:** `(this.x + other.x, this.y + other.y)`.  
**Muta:** NO `this`, NO `other`.  
**Salida:** nuevo `Vector2`.  
**Postcondición:** resultado matemáticamente igual a la suma.  
**Error:** `InvalidVectorError` para argumento inválido.  
**Pruebas:** positivo, negativo, cero, decimales, operandos extremos finitos.

### 7.4 `subtract(other)`

**FUNCTION-ID:** `VEC-004`  
**Entrada:** `Vector2`.  
**Operación:** resta componente a componente.  
**Mutación:** ninguna sobre operandos.  
**Salida:** nuevo vector.  
**Error:** `InvalidVectorError`.  
**Invariante:** resultado finito si las entradas producen resultado finito dentro del rango representable.

### 7.5 `multiplyScalar(scalar)`

**FUNCTION-ID:** `VEC-005`  
**Entrada:** escalar finito.  
**Operación:** multiplica ambos componentes.  
**Mutación:** ninguna sobre `this`.  
**Salida:** nuevo vector.  
**Error:** `InvalidNumericInputError`.  
**Pruebas:** `0`, `1`, negativo, decimal.

### 7.6 `dot(other)`

**FUNCTION-ID:** `VEC-006`  
**Salida:** número `x1*x2 + y1*y2`.  
**No muta estado.  
**Error:** argumento inválido.

### 7.7 `lengthSq()`

**FUNCTION-ID:** `VEC-007`  
**Salida:** `x*x + y*y`.  
**No muta estado.  
**Uso:** cálculos que no requieren raíz cuadrada.

### 7.8 `length()`

**FUNCTION-ID:** `VEC-008`  
**Salida:** norma euclídea.  
**No muta estado.

### 7.9 `normalize()`

**FUNCTION-ID:** `VEC-009`  
**Entrada:** ninguna.  
**Precondición:** vector válido.  
**Regla cero:** un vector de longitud cero DEBE producir error `ZeroLengthVectorError`; NO se permite devolver `NaN` ni un vector arbitrario.  
**Mutación:** NO `this`.  
**Salida:** vector unitario nuevo.  
**Invariante:** `|result| ≈ 1` para entrada no cero.

### 7.10 `equalsApprox(other, epsilon)`

**FUNCTION-ID:** `VEC-010`  
**Entrada:** vector válido y `epsilon > 0` finito.  
**Salida:** booleano.  
**Mutación:** ninguna.  
**Regla:** comparación componente a componente dentro de tolerancia.

### 7.11 `isFinite()`

**FUNCTION-ID:** `VEC-011`  
**Salida:** booleano.  
**Mutación:** ninguna.  
**Uso:** validación sin lanzar excepción.

---

# 8. `math/Matrix3x3.js`

## Representación contractual

La matriz se interpreta como matriz homogénea 3×3 para transformaciones afines 2D.

El contrato de composición es:

```text
World = Parent × Local
```

No puede invertirse este orden.

### 8.1 `constructor(values)`

**FUNCTION-ID:** `MAT-001`  
**Entrada:** exactamente 9 números finitos o una representación de identidad definida por constructor sin argumentos.  
**Salida:** matriz válida.  
**Error:** `InvalidMatrixError`.  
**Mutación:** no de entradas externas.

### 8.2 `identity()`

**FUNCTION-ID:** `MAT-002`  
**Tipo:** factoría.  
**Salida:** matriz identidad.  
**Postcondición:** diagonal principal `1`, demás valores `0`.

### 8.3 `translation(x, y)`

**FUNCTION-ID:** `MAT-003`  
**Entrada:** `x,y` finitos.  
**Salida:** matriz de traslación pura.  
**No contiene rotación ni escala distinta de uno.

### 8.4 `rotation(radians)`

**FUNCTION-ID:** `MAT-004`  
**Entrada:** ángulo finito en radianes.  
**Salida:** matriz de rotación pura.

### 8.5 `scale(sx, sy)`

**FUNCTION-ID:** `MAT-005`  
**Entrada:** escalas finitas.  
**Salida:** matriz de escala.  
**Cero permitido en construcción; su inversibilidad dependerá de `invert()`.

### 8.6 `multiply(other)`

**FUNCTION-ID:** `MAT-006`  
**Entrada:** matriz válida.  
**Operación:** producto matricial en el orden `this × other`.  
**Mutación:** NO modifica operandos.  
**Salida:** matriz nueva.  
**Invariante:** asociatividad matemática dentro de la precisión numérica.

### 8.7 `determinant()`

**FUNCTION-ID:** `MAT-007`  
**Salida:** determinante escalar.  
**Mutación:** ninguna.

### 8.8 `invert()`

**FUNCTION-ID:** `MAT-008`  
**Entrada:** ninguna.  
**Precondición:** matriz invertible; `|determinant| > epsilon`.  
**Salida:** matriz inversa nueva.  
**Mutación:** no modifica original.  
**Error:** `NonInvertibleMatrixError`.  
**Postcondición:** `M × inverse(M) ≈ I`.

### 8.9 `transformPoint(point)`

**FUNCTION-ID:** `MAT-009`  
**Entrada:** `Vector2`.  
**Operación:** aplicación afín homogénea con coordenada `w=1`.  
**Salida:** `Vector2` transformado.  
**Mutación:** ninguna.

### 8.10 `transformVector(vector)`

**FUNCTION-ID:** `MAT-010`  
**Entrada:** `Vector2`.  
**Operación:** aplicación con `w=0`; la traslación NO debe afectar al resultado.  
**Salida:** vector transformado.

### 8.11 `clone()`

**FUNCTION-ID:** `MAT-011`  
**Salida:** copia independiente.

### 8.12 `equalsApprox(other, epsilon)`

**FUNCTION-ID:** `MAT-012`  
**Salida:** booleano por comparación elemento a elemento.

### 8.13 `isFinite()`

**FUNCTION-ID:** `MAT-013`  
**Salida:** booleano.

---

# 9. `math/Transform.js`

## Estado

```text
position: Vector2
rotation: radians
scale: Vector2
matrixCache: Matrix3x3 | null
dirty: boolean
```

### 9.1 `constructor(position, rotation, scale)`

**FUNCTION-ID:** `TRN-001`  
**Precondiciones:** posición válida; rotación finita; escala válida.  
**Valores por defecto contractuales si se omiten argumentos:** posición `(0,0)`, rotación `0`, escala `(1,1)`.  
**Postcondición:** transform representa exactamente esos valores.

### 9.2 `getPosition()`

**FUNCTION-ID:** `TRN-002`  
**Salida:** copia de posición.  
**NO DEBE devolver referencia mutable al estado interno.

### 9.3 `setPosition(position)`

**FUNCTION-ID:** `TRN-003`  
**Precondición:** posición válida.  
**Mutación:** reemplaza posición; marca dirty si cambió.  
**NO DEBE modificar rotación ni escala.  
**Efecto:** matrices derivadas quedan inválidas.

### 9.4 `translate(delta)`

**FUNCTION-ID:** `TRN-004`  
**Operación:** `position = position + delta`.  
**Mutación:** posición y dirty.

### 9.5 `getRotation()`

**FUNCTION-ID:** `TRN-005`  
**Salida:** ángulo en radianes.

### 9.6 `setRotation(radians)`

**FUNCTION-ID:** `TRN-006`  
**Mutación:** rotación; marca dirty si cambia.  
**NO DEBE modificar posición ni escala.

### 9.7 `rotate(deltaRadians)`

**FUNCTION-ID:** `TRN-007`  
**Operación:** suma angular.  
**Mutación:** rotación + dirty.

### 9.8 `getScale()`

**FUNCTION-ID:** `TRN-008`  
**Salida:** copia de escala.

### 9.9 `setScale(scale)`

**FUNCTION-ID:** `TRN-009`  
**Mutación:** escala + dirty.  
**Debe permitir escala negativa únicamente si el renderer y bounds soportan reflexión; esa política debe mantenerse uniforme.

### 9.10 `scaleBy(factor)`

**FUNCTION-ID:** `TRN-010`  
**Operación:** multiplicación componente a componente.  
**Mutación:** escala + dirty.

### 9.11 `toMatrix()`

**FUNCTION-ID:** `TRN-011`  
**Operación exacta:** componer la matriz local contractual en el orden definido por el motor.  
**Salida:** matriz equivalente.  
**Mutación:** puede actualizar caché interna, pero NO cambiar posición/rotación/escala.  
**Postcondición:** mismo estado semántico; caché coherente.

### 9.12 `isDirty()`

**FUNCTION-ID:** `TRN-012`  
**Salida:** booleano.

### 9.13 `clearDirty()`

**FUNCTION-ID:** `TRN-013`  
**Mutación:** limpia sólo dirty interno de Transform.  
**NO DEBE limpiar flags de `SceneNode`.

---

# 10. `math/AABB.js`

## Estado

```text
minX
minY
maxX
maxY
empty
```

### 10.1 `constructor(minX, minY, maxX, maxY)`

**FUNCTION-ID:** `AABB-001`  
**Precondición:** límites finitos y orden correcto.  
**Salida:** AABB válido.  
**Error:** `InvalidAABBError`.

### 10.2 `empty()`

**FUNCTION-ID:** `AABB-002`  
**Salida:** AABB vacío explícitamente marcado.  
**Debe ser identificable sin depender de valores `NaN`.

### 10.3 `fromXYWH(x, y, width, height)`

**FUNCTION-ID:** `AABB-003`  
**Precondición:** entradas finitas; width/height no negativos.  
**Salida:** `min=(x,y)`, `max=(x+w,y+h)`.

### 10.4 `clone()`

**FUNCTION-ID:** `AABB-004`  
**Salida:** copia independiente.

### 10.5 `contains(point)`

**FUNCTION-ID:** `AABB-005`  
**Regla:** inclusión de bordes cerrados.  
**Salida:** booleano.

### 10.6 `intersects(other)`

**FUNCTION-ID:** `AABB-006`  
**Regla:** AABBs que se tocan por borde cuentan como intersección.

### 10.7 `union(other)`

**FUNCTION-ID:** `AABB-007`  
**Salida:** nuevo AABB que contiene completamente ambos.  
**NO MUTA operandos.

### 10.8 `expandByPoint(point)`

**FUNCTION-ID:** `AABB-008`  
**Mutación:** expande el AABB actual.  
**Si está vacío, el punto se convierte en su único punto.

### 10.9 `transform(matrix)`

**FUNCTION-ID:** `AABB-009`  
**Operación:** transformar todos los vértices del rectángulo y calcular mínimo/máximo de resultados.  
**Salida:** nuevo AABB en espacio destino.  
**NO ES VÁLIDO** transformar sólo dos esquinas cuando la matriz puede contener rotación.

### 10.10 `isEmpty()`

**FUNCTION-ID:** `AABB-010`  
**Salida:** booleano.

### 10.11 `width()` / `height()`

**FUNCTION-ID:** `AABB-011/012`  
**Salida:** dimensiones no negativas para estado no vacío; `0` para vacío.

---

# 11. `geometry/Path.js`

## Estado

Una `Path` contiene una secuencia ordenada e inmutable semánticamente de comandos geométricos; las mutaciones pasan por métodos del propio objeto.

Cada comando DEBE conservar su tipo y parámetros.

Tipos mínimos:

```text
MOVE_TO
LINE_TO
QUADRATIC_TO
CUBIC_TO
CLOSE
```

### 11.1 `constructor(commands)`

**FUNCTION-ID:** `PATH-001`  
**Precondición:** comandos válidos y orden geométrico legal.  
**Salida:** path independiente.  
**Error:** `InvalidPathError`.

### 11.2 `moveTo(x, y)`

**FUNCTION-ID:** `PATH-002`  
**Mutación:** agrega exactamente un `MOVE_TO`.  
**No genera otros comandos implícitos.

### 11.3 `lineTo(x, y)`

**FUNCTION-ID:** `PATH-003`  
**Precondición:** debe existir subpath activo.  
**Mutación:** agrega exactamente un `LINE_TO`.

### 11.4 `quadraticTo(cx, cy, x, y)`

**FUNCTION-ID:** `PATH-004`  
**Precondición:** subpath activo.  
**Mutación:** agrega un segmento cuadrático.

### 11.5 `cubicTo(c1x, c1y, c2x, c2y, x, y)`

**FUNCTION-ID:** `PATH-005`  
**Precondición:** subpath activo.  
**Mutación:** agrega un segmento cúbico.

### 11.6 `close()`

**FUNCTION-ID:** `PATH-006`  
**Mutación:** cierra el subpath activo.  
**No agrega segmentos geométricos equivalentes silenciosos; conserva comando explícito `CLOSE`.

### 11.7 `clone()`

**FUNCTION-ID:** `PATH-007`  
**Salida:** copia profunda de comandos.

### 11.8 `isClosed()`

**FUNCTION-ID:** `PATH-008`  
**Salida:** true sólo si el subpath relevante contiene `CLOSE` explícito.

### 11.9 `segmentCount()`

**FUNCTION-ID:** `PATH-009`  
**Salida:** número de segmentos geométricos, sin contar `MOVE_TO` ni `CLOSE`.

### 11.10 `validate()`

**FUNCTION-ID:** `PATH-010`  
**Salida:** resultado de validación estructural.  
**No repara datos.

### 11.11 `getBounds()`

**FUNCTION-ID:** `PATH-011`  
**Operación:** calcular bounds geométricos exactos o conforme a la estrategia de curvatura definida; NO puede usar únicamente puntos de control si ello omite extremos de Bézier.  
**Salida:** AABB local.

---

# 12. `geometry/BezierPath.js`

### 12.1 `constructor(path)`

**FUNCTION-ID:** `BEZ-001`  
**Precondición:** `Path` válida y compuesta de segmentos soportados.  
**Salida:** representación Bézier analizable.

### 12.2 `fromCommands(commands)`

**FUNCTION-ID:** `BEZ-002`  
**Entrada:** comandos compatibles.  
**Salida:** `BezierPath`.  
**Error:** `PathCompatibilityError` si existen comandos no soportados.

### 12.3 `getPointAt(segmentIndex, t)`

**FUNCTION-ID:** `BEZ-003`  
**Precondiciones:** segmento válido; `t ∈ [0,1]`.  
**Salida:** punto local exacto para la parametrización contractual.  
**NO DEBE mutar la geometría.

### 12.4 `getTangentAt(segmentIndex, t)`

**FUNCTION-ID:** `BEZ-004`  
**Salida:** vector tangente según derivada del segmento.

### 12.5 `split(segmentIndex, t)`

**FUNCTION-ID:** `BEZ-005`  
**Salida:** dos geometrías válidas equivalentes a subdivisión de De Casteljau.  
**NO DEBE alterar el original.

### 12.6 `normalizeSegments(targetCount)`

**FUNCTION-ID:** `BEZ-006`  
**Propósito:** producir estructura compatible para morphing.  
**Regla:** debe preservar la geometría dentro de la tolerancia declarada.  
**NO DEBE eliminar rasgos por simplificación no documentada.  
**Error:** `NormalizationError` si no puede cumplir tolerancia.

---

# 13. `geometry/Circle.js`

### 13.1 `constructor(center, radius)`

**FUNCTION-ID:** `CIR-001`  
**Precondición:** centro válido; `radius >= 0` finito.  
**Salida:** círculo válido.

### 13.2 `setCenter(center)`

**FUNCTION-ID:** `CIR-002`  
**Mutación:** centro únicamente.

### 13.3 `setRadius(radius)`

**FUNCTION-ID:** `CIR-003`  
**Precondición:** radio no negativo finito.  
**Mutación:** radio únicamente.

### 13.4 `getBounds()`

**FUNCTION-ID:** `CIR-004`  
**Salida:** AABB local exacto del círculo.

### 13.5 `contains(point)`

**FUNCTION-ID:** `CIR-005`  
**Regla:** distancia al centro `<= radius` cuenta como hit.

---

# 14. `geometry/GeometryUtils.js`

### 14.1 `computePathBounds(path)`

**FUNCTION-ID:** `GEOU-001`  
**Entrada:** Path válida.  
**Salida:** AABB local.

### 14.2 `interpolatePath(pathA, pathB, t)`

**FUNCTION-ID:** `GEOU-002`  
**Precondiciones:** estructuras compatibles; `t ∈ [0,1]`.  
**Salida:** nueva geometría interpolada.  
**Postcondiciones:** `t=0` equivale a A, `t=1` equivale a B dentro de identidad estructural/numérica.  
**NO DEBE** cambiar estructura para ocultar incompatibilidad.

### 14.3 `pointInPath(path, point, fillRule)`

**FUNCTION-ID:** `GEOU-003`  
**Entrada:** path, punto local y regla de relleno explícita.  
**Salida:** booleano.  
**No muta geometría.

### 14.4 `transformGeometry(path, matrix)`

**FUNCTION-ID:** `GEOU-004`  
**Salida:** geometría transformada nueva.  
**No muta original.

---

# 15. `scenegraph/SceneNode.js`

## Estado obligatorio

```text
id
parent
children
localTransform
worldTransform
localBounds
worldBounds
visibility
opacity
dirtyFlags
zIndex
interactive
```

## Invariantes del nodo

- un nodo tiene como máximo un parent;
- no puede contenerse a sí mismo;
- no puede existir ciclo en la jerarquía;
- `worldTransform = parentWorld × localTransform` salvo root;
- opacity permanece en `[0,1]`;
- `worldBounds` corresponde al estado actual cuando `BOUNDS_DIRTY` está limpio.

### 15.1 `constructor(options)`

**FUNCTION-ID:** `NODE-001`  
**Precondiciones:** opciones compatibles con contrato.  
**Estado inicial obligatorio:** parent `null`, children vacío, identidad local, world igual a local, visible `true`, opacity `1`, dirty inicial coherente.  
**Salida:** nodo sin parent.

### 15.2 `addChild(child)`

**FUNCTION-ID:** `NODE-002`  
**Precondiciones:** child no nulo, no es `this`, no genera ciclo.  
**Mutaciones exactas:**

1. establecer parent;
2. agregar exactamente una referencia en children;
3. invalidar transform mundial del subárbol;
4. invalidar bounds de ancestros afectados;
5. invalidar render de las regiones afectadas.

**NO DEBE:** modificar geometría, emoción o animaciones del child.

**Error:** `SceneGraphCycleError`, `InvalidParentError`.

### 15.3 `removeChild(child)`

**FUNCTION-ID:** `NODE-003`  
**Precondición:** child pertenece al nodo.  
**Mutaciones:** eliminar exactamente una referencia; limpiar parent; invalidar bounds/render.  
**NO DEBE:** destruir recursos externos automáticamente.

### 15.4 `removeAllChildren()`

**FUNCTION-ID:** `NODE-004`  
**Mutaciones:** desacoplar todos los children y limpiar parent de cada uno; invalidar una sola vez al finalizar la operación.  
**No debe modificar geometría de los hijos.

### 15.5 `setPosition(position)`

**FUNCTION-ID:** `NODE-005`  
**Delegación:** modifica exclusivamente `localTransform.position`.  
**Mutación derivada obligatoria:** TRANSFORM_DIRTY → descendientes WORLD_DIRTY → BOUNDS_DIRTY → RENDER_DIRTY.

### 15.6 `setRotation(radians)`

**FUNCTION-ID:** `NODE-006`  
**Mutación:** rotación local; misma propagación que posición.

### 15.7 `setScale(scale)`

**FUNCTION-ID:** `NODE-007`  
**Mutación:** escala local; misma propagación.

### 15.8 `getLocalTransform()`

**FUNCTION-ID:** `NODE-008`  
**Salida:** acceso controlado/copia conforme a API elegida.  
**NO DEBE permitir mutación no instrumentada del nodo.

### 15.9 `getWorldTransform()`

**FUNCTION-ID:** `NODE-009`  
**Precondición operacional:** world transform actualizada antes de entregar resultado.  
**Salida:** matriz mundial válida.

### 15.10 `updateWorldTransform(parentWorldMatrix)`

**FUNCTION-ID:** `NODE-010`  
**Precondición:** parentWorld válida o null para root.  
**Operación:** root usa local; hijo usa `parentWorld × local`.  
**Propagación:** actualiza descendientes afectados en orden padre→hijo.  
**No modifica geometría.

### 15.11 `localToWorld(point)`

**FUNCTION-ID:** `NODE-011`  
**Operación:** aplicar world transform al punto.  
**Salida:** punto mundial.  
**No muta nodo.

### 15.12 `worldToLocal(point)`

**FUNCTION-ID:** `NODE-012`  
**Precondición:** world transform invertible.  
**Operación:** aplicar inversa.  
**Error:** `NonInvertibleTransformError`.  
**Salida:** punto local.

### 15.13 `updateBounds()`

**FUNCTION-ID:** `NODE-013`  
**Responsabilidad:** calcular local/world bounds a partir de geometría y children según tipo de nodo.  
**Regla:** un nodo que no posee geometría y no tiene hijos produce bounds vacío.  
**Postcondición:** BOUNDS_DIRTY limpio si el cálculo termina correctamente.

### 15.14 `getLocalBounds()`

**FUNCTION-ID:** `NODE-014`  
**Salida:** bounds local vigente; si dirty, debe actualizar antes de devolverlo o producir error explícito de estado, pero no devolver dato obsoleto bajo una API que prometa vigencia.

### 15.15 `getWorldBounds()`

**FUNCTION-ID:** `NODE-015`  
**Regla:** nunca devolver bounds mundial obsoleto como si fuera válido.

### 15.16 `setVisible(visible)`

**FUNCTION-ID:** `NODE-016`  
**Mutación:** visibility únicamente.  
**Efecto:** STYLE/RENDER dirty según política; no cambia transform.

### 15.17 `setOpacity(opacity)`

**FUNCTION-ID:** `NODE-017`  
**Precondición:** `0 <= opacity <= 1`.  
**Mutación:** opacity y render dirty.  
**Error:** `InvalidOpacityError`.

### 15.18 `invalidate(flags)`

**FUNCTION-ID:** `NODE-018`  
**Entrada:** sólo flags reconocidos.  
**Mutación:** OR de flags; propaga sólo dependencias contractuales.  
**NO DEBE:** limpiar flags.

### 15.19 `clearDirty(flags)`

**FUNCTION-ID:** `NODE-019`  
**Regla:** sólo puede limpiar flags que el caller posee contractualmente.  
**NO DEBE:** limpiar dirty de descendientes salvo operación explícita del subsistema.

### 15.20 `visit(visitor)`

**FUNCTION-ID:** `NODE-020`  
**Orden:** depth-first padre→hijos siguiendo orden de children/z-order contractual.  
**No puede alterar estructura durante la iteración; si se requiere mutación, debe diferirse.

---

# 16. `scenegraph/GroupNode.js`

### 16.1 `constructor(options)`

**FUNCTION-ID:** `GROUP-001`  
**Salida:** nodo agrupador sin geometría propia.

### 16.2 `getLocalBounds()`

**FUNCTION-ID:** `GROUP-002`  
**Operación:** unión de bounds locales de hijos transformados al espacio del grupo.  
**Debe respetar visibilidad.

### 16.3 `buildRenderCommands(queue, context)`

**FUNCTION-ID:** `GROUP-003`  
**Orden:** children según orden de escena.  
**NO DEBE:** emitir comandos de geometría inexistente propia.

---

# 17. `scenegraph/PathNode.js`

### 17.1 `constructor(geometry, style, options)`

**FUNCTION-ID:** `PATHNODE-001`  
**Precondición:** geometry válida.  
**Estado:** geometría, fill, stroke, strokeWidth.

### 17.2 `setGeometry(path)`

**FUNCTION-ID:** `PATHNODE-002`  
**Mutación:** geometría únicamente.  
**Invalidación obligatoria:** GEOMETRY_DIRTY + BOUNDS_DIRTY + RENDER_DIRTY.

### 17.3 `getGeometry()`

**FUNCTION-ID:** `PATHNODE-003`  
**Salida:** geometría válida.  
**No puede devolver referencia mutable que permita saltarse invalidación.

### 17.4 `setFill(fill)`

**FUNCTION-ID:** `PATHNODE-004`  
**Mutación:** fill + STYLE_DIRTY + RENDER_DIRTY.

### 17.5 `setStroke(stroke)`

**FUNCTION-ID:** `PATHNODE-005`  
**Mutación:** stroke + STYLE_DIRTY + RENDER_DIRTY.

### 17.6 `setStrokeWidth(width)`

**FUNCTION-ID:** `PATHNODE-006`  
**Precondición:** width finito y no negativo.  
**Mutación:** estilo + BOUNDS_DIRTY + RENDER_DIRTY porque stroke afecta bounds.

### 17.7 `getLocalBounds()`

**FUNCTION-ID:** `PATHNODE-007`  
**Regla:** debe considerar geometría y stroke conforme a la política de bounds definida.  
**NO DEBE** ignorar stroke si éste forma parte del área renderizada.

### 17.8 `buildRenderCommands(queue, context)`

**FUNCTION-ID:** `PATHNODE-008`  
**Salida:** comandos para dibujar la geometría con transform/style vigentes.  
**NO DEBE:** ejecutar Canvas2D.

---

# 18. `scenegraph/CircleNode.js`

### 18.1 `constructor(circle, style, options)`

**FUNCTION-ID:** `CIRNODE-001`  
**Precondición:** Circle válida.

### 18.2 `setCircle(circle)`

**FUNCTION-ID:** `CIRNODE-002`  
**Mutación:** geometría circular + GEOMETRY/BOUNDS/RENDER dirty.

### 18.3 `getCircle()`

**FUNCTION-ID:** `CIRNODE-003`  
**Salida:** círculo de acceso controlado.

### 18.4 `setFill(fill)`

**FUNCTION-ID:** `CIRNODE-004`  
**Mutación:** estilo + render dirty.

### 18.5 `buildRenderCommands(queue, context)`

**FUNCTION-ID:** `CIRNODE-005`  
**Salida:** comando `DrawCircle` equivalente.

---

# 19. Dirty State y `DirtyRegionManager`

## Flags oficiales

```text
TRANSFORM_DIRTY
GEOMETRY_DIRTY
BOUNDS_DIRTY
STYLE_DIRTY
CHILDREN_DIRTY
RENDER_DIRTY
```

## Propagación obligatoria

```text
TRANSFORM_DIRTY
 → world transform stale
 → BOUNDS_DIRTY
 → RENDER_DIRTY
```

```text
GEOMETRY_DIRTY
 → BOUNDS_DIRTY
 → RENDER_DIRTY
```

```text
STYLE_DIRTY
 → RENDER_DIRTY
```

### 19.1 `DirtyRegionManager.constructor(viewport)`

**FUNCTION-ID:** `DIRTY-001`  
**Estado:** viewport válido; lista de regiones vacía.

### 19.2 `invalidate(oldBounds, newBounds)`

**FUNCTION-ID:** `DIRTY-002`  
**Operación:** registrar `union(oldBounds,newBounds)`.  
**Mutación:** añade región sucia.  
**NO DEBE:** usar sólo newBounds.

### 19.3 `merge()`

**FUNCTION-ID:** `DIRTY-003`  
**Operación:** combinar regiones según estrategia de fusión definida.  
**Requisito:** la unión final debe contener todas las regiones previamente registradas.

### 19.4 `clear()`

**FUNCTION-ID:** `DIRTY-004`  
**Mutación:** elimina únicamente regiones ya consumidas explícitamente.

### 19.5 `getRegions()`

**FUNCTION-ID:** `DIRTY-005`  
**Salida:** colección inmutable/copia de regiones actuales.

### 19.6 `isDirty()`

**FUNCTION-ID:** `DIRTY-006`  
**Salida:** true si existe al menos una región pendiente.

---

# 20. `events/HitTester.js`

### 20.1 `hitTest(pointWorld, root)`

**FUNCTION-ID:** `HIT-001`  
**Secuencia obligatoria:**

```text
world point
 ↓
visit candidates front-to-back
 ↓
worldToLocal(node)
 ↓
local bounds
 ↓
local geometry
 ↓
first valid hit
```

**Regla:** si bounds no intersecta, no se ejecuta prueba geométrica de ese nodo.  
**Regla:** AABB es filtro, no sustituto de geometría cuando la precisión geométrica está exigida.  
**Salida:** nodo objetivo o `null`.

### 20.2 `hitTestLocal(pointLocal, node)`

**FUNCTION-ID:** `HIT-002`  
**Entrada:** punto ya en espacio local.  
**Salida:** booleano.  
**No realiza transformación global.

### 20.3 `collectHits(pointWorld, root)`

**FUNCTION-ID:** `HIT-003`  
**Salida:** lista ordenada front-to-back de hits.  
**No elimina hits salvo por política explícita de `interactive`.

---

# 21. `events/Event.js`

### 21.1 `constructor(type, payload, source)`

**FUNCTION-ID:** `EVT-001`  
**Estado inicial:** phase `NONE`; propagation allowed; default not prevented.

### 21.2 `stopPropagation()`

**FUNCTION-ID:** `EVT-002`  
**Mutación:** impide continuar hacia la siguiente fase/ancestro según semántica de propagation.  
**NO DEBE** borrar target/currentTarget.

### 21.3 `stopImmediatePropagation()`

**FUNCTION-ID:** `EVT-003`  
**Mutación:** además impide listeners posteriores del mismo target.

### 21.4 `preventDefault()`

**FUNCTION-ID:** `EVT-004`  
**Mutación:** defaultPrevented=true.

---

# 22. `events/EventDispatcher.js`

### 22.1 `addEventListener(type, listener, options)`

**FUNCTION-ID:** `DISPATCH-001`  
**Precondición:** listener callable.  
**Mutación:** registra listener sin duplicarlo accidentalmente según identidad definida.  
**Opciones mínimas:** capture.

### 22.2 `removeEventListener(type, listener, options)`

**FUNCTION-ID:** `DISPATCH-002`  
**Mutación:** elimina coincidencia exacta según contrato.  
**No altera otros listeners.

### 22.3 `dispatchEvent(event, target)`

**FUNCTION-ID:** `DISPATCH-003`  
**Secuencia obligatoria:**

```text
build propagation path
root → parent(target)
CAPTURE
TARGET
BUBBLE
```

**Mutaciones:** `currentTarget`, `phase`, flags de propagation.  
**Prohibición:** cambiar el orden para simplificar.

### 22.4 `buildPropagationPath(target)`

**FUNCTION-ID:** `DISPATCH-004`  
**Salida:** cadena root→target sin ciclos.  
**Error:** `InvalidSceneGraphError` si detecta estructura cíclica.

---

# 23. `events/InteractionEngine.js`

### 23.1 `constructor(root, dispatcher, hitTester)`

**FUNCTION-ID:** `INT-001`  
**Precondición:** dependencias válidas.

### 23.2 `handlePointerMove(worldPoint, pointerId)`

**FUNCTION-ID:** `INT-002`  
**Operaciones obligatorias:**

1. validar punto;
2. ejecutar hit test;
3. actualizar target de hover;
4. generar enter/leave/move cuando corresponda;
5. actualizar runtime targets físicos como mirada si la escena los registra;
6. no enviar EmotionEvent salvo regla de dominio explícita.

**NO DEBE:** modificar estado interno de FSM directamente.

### 23.3 `handlePointerDown(worldPoint, pointerId)`

**FUNCTION-ID:** `INT-003`  
**Operaciones:** hit test → dispatch pointerdown → registrar capture/press state.  
**Puede generar intención emocional sólo mediante `EmotionEvent`.

### 23.4 `handlePointerUp(worldPoint, pointerId)`

**FUNCTION-ID:** `INT-004`  
**Operaciones:** resolver target actual → dispatch pointerup → liberar estado de pointer.  
**No genera click si las condiciones de click no están definidas/satisfechas.

### 23.5 `update(dt)`

**FUNCTION-ID:** `INT-005`  
**Responsabilidad:** evolución de targets físicos dependientes del tiempo.  
**NO DEBE:** ejecutar FSM por cuenta propia.

---

# 24. `domain/Emotion.js`

### 24.1 `constructor(id)`

**FUNCTION-ID:** `EMO-001`  
**Precondición:** id no vacío y estable.  
**Salida:** identidad de emoción.

### 24.2 `equals(other)`

**FUNCTION-ID:** `EMO-002`  
**Salida:** igualdad por identidad semántica, no por referencia solamente.

---

# 25. `domain/EmotionDefinition.js`

## Estado obligatorio

```text
id
basePose
animationTracks
transitions
effects
priorityRules
```

### 25.1 `constructor(data)`

**FUNCTION-ID:** `EMODEF-001`  
**Precondición:** estructura completa.

### 25.2 `validate()`

**FUNCTION-ID:** `EMODEF-002`  
**Salida:** resultado válido o excepción `InvalidEmotionDefinitionError`.  
**NO REPARA datos.

### 25.3 `getBasePose()`

**FUNCTION-ID:** `EMODEF-003`  
**Salida:** copia de pose base, nunca referencia mutable interna.

### 25.4 `getAnimationTracks()`

**FUNCTION-ID:** `EMODEF-004`  
**Salida:** lista ordenada e inmutable/copia.

### 25.5 `getTransition(eventType)`

**FUNCTION-ID:** `EMODEF-005`  
**Salida:** transición explícita o `null`; nunca inventar transición.

---

# 26. `domain/EmotionEvent.js`

### 26.1 `constructor(type, payload, priority, sequence, source)`

**FUNCTION-ID:** `EMEVENT-001`  
**Precondición:** type válido; priority y sequence deterministas.  
**Salida:** evento inmutable semánticamente.

### 26.2 `comparePriority(other)`

**FUNCTION-ID:** `EMEVENT-002`  
**Salida:** comparación por prioridad y después por sequence según política determinista.

---

# 27. `domain/EmotionFSM.js`

## Estado obligatorio

```text
currentState
transitionTable
eventQueue
sequenceCounter
```

### 27.1 `constructor(definitions, initialState)`

**FUNCTION-ID:** `FSM-001`  
**Precondiciones:** initialState existe; todas las definiciones válidas.  
**Mutación inicial:** estado = initialState; queue vacía.

### 27.2 `getState()`

**FUNCTION-ID:** `FSM-002`  
**Salida:** estado actual; no mutable externamente.

### 27.3 `canTransition(event)`

**FUNCTION-ID:** `FSM-003`  
**Salida:** booleano según tabla explícita.  
**NO DEBE cambiar estado ni cola.

### 27.4 `enqueue(event)`

**FUNCTION-ID:** `FSM-004`  
**Mutación:** agrega evento; asigna sequence sólo si no existe.  
**Orden:** priority DESC; desempate sequence ASC.  
**No procesa inmediatamente.

### 27.5 `processQueue()`

**FUNCTION-ID:** `FSM-005`  
**Operación:** procesa eventos en orden contractual hasta agotar cola o alcanzar límite de seguridad explícito.  
**Cada transición debe ser atómica:** estado anterior → validación → nuevo estado → resultado.  
**Evento inválido:** se rechaza sin modificar currentState.

### 27.6 `dispatch(event)`

**FUNCTION-ID:** `FSM-006`  
**Operación:** equivalente a enqueue + procesamiento conforme a la fase en la que se invoque; NO DEBE procesarse dentro de render.  
**Salida:** `TransitionResult`.

### 27.7 `transitionTo(state)`

**FUNCTION-ID:** `FSM-007`  
**Uso interno/controlado.  
**Precondición:** transición autorizada por tabla/evento.  
**NO DEBE usarse para saltarse validación de eventos desde código de aplicación.

---

# 28. `domain/Pose.js`

## Estado mínimo

```text
body
leftEye
rightEye
mouth
lookTarget
```

Cada componente visual DEBE poder representar posición/escala/rotación y los parámetros de geometría que su compositor requiera.

### 28.1 `constructor(data)`

**FUNCTION-ID:** `POSE-001`  
**Precondición:** estructura coherente.  
**Salida:** Pose válida.

### 28.2 `clone()`

**FUNCTION-ID:** `POSE-002`  
**Salida:** copia profunda de datos mutables.

### 28.3 `validate()`

**FUNCTION-ID:** `POSE-003`  
**Salida:** válida o `InvalidPoseError`.  
**No corrige silenciosamente rangos.

### 28.4 `copyFrom(other)`

**FUNCTION-ID:** `POSE-004`  
**Mutación:** reemplaza Current/Target interno según clase concreta.  
**No altera FSM ni geometría de escena directamente.

---

# 29. `domain/PoseResolver.js`

### 29.1 `constructor(definitionRegistry, constraintSet)`

**FUNCTION-ID:** `POSE-RES-001`  
**Precondiciones:** dependencias válidas.

### 29.2 `resolve(emotionState, runtimeTargets)`

**FUNCTION-ID:** `POSE-RES-002`  
**Secuencia obligatoria:** base pose → parámetros dinámicos → runtime targets → constraints → validación.  
**Salida:** `TargetPose` completo.  
**NO DEBE:** modificar SceneNode.

### 29.3 `applyRuntimeTargets(pose, runtimeTargets)`

**FUNCTION-ID:** `POSE-RES-003`  
**Operación:** integrar targets físicos autorizados, por ejemplo mirada.  
**No modifica FSM.

### 29.4 `applyConstraints(pose)`

**FUNCTION-ID:** `POSE-RES-004`  
**Operación:** aplicar límites declarados sin eliminar rasgos semánticos.  
**Si una pose no puede cumplir constraints, debe producir `PoseConstraintError`; no degradar silenciosamente.

---

# 30. `animation/SpringSolver.js`

## Modelo

Solver de sistema de segundo orden con parámetros definidos por instancia.

### 30.1 `constructor(parameters)`

**FUNCTION-ID:** `SPR-001`  
**Debe almacenar parámetros completos del solver.  
**No obtiene tiempo externo.

### 30.2 `reset(value, velocity)`

**FUNCTION-ID:** `SPR-002`  
**Mutación:** current y velocity.  
**Precondiciones:** finitos.

### 30.3 `step(current, target, velocity, dt)`

**FUNCTION-ID:** `SPR-003`  
**Entrada:** todos finitos; `dt > 0`.  
**Salida:** `{value, velocity}`.  
**Muta:** no argumentos.  
**Determinismo:** iguales entradas/params/dt → iguales salidas dentro de tolerancia.

### 30.4 `isSettled(value, target, velocity)`

**FUNCTION-ID:** `SPR-004`  
**Salida:** true sólo si error posicional y velocidad cumplen ambos umbrales configurados.

### 30.5 Invariante de reposo

Si `value == target` dentro de tolerancia y `velocity == 0`, no debe aparecer movimiento espontáneo significativo.

---

# 31. `animation/PathInterpolator.js`

### 31.1 `validateCompatibility(pathA, pathB)`

**FUNCTION-ID:** `PATHINT-001`  
**Salida:** compatible/no compatible.  
**Debe verificar estructura, cantidad/tipo de segmentos y requisitos de normalización.

### 31.2 `interpolate(pathA, pathB, t)`

**FUNCTION-ID:** `PATHINT-002`  
**Precondiciones:** paths compatibles; `t ∈ [0,1]`.  
**Salida:** nueva geometría.  
**No muta A/B.

### 31.3 `normalize(pathA, pathB)`

**FUNCTION-ID:** `PATHINT-003`  
**Salida:** pareja compatible preservando tolerancia geométrica.  
**NO DEBE eliminar segmentos por conveniencia.

---

# 32. `animation/Easing.js`

Todas las funciones de easing son puras.

### 32.1 `linear(t)`

**FUNCTION-ID:** `EASE-001`  
**Entrada:** `t ∈ [0,1]`.  
**Salida:** exactamente `t`.

### 32.2 `easeIn(t)`

**FUNCTION-ID:** `EASE-002`  
**Salida:** según fórmula fijada por implementación y documentación de versión; debe ser determinista y permanecer en rango.

### 32.3 `easeOut(t)`

**FUNCTION-ID:** `EASE-003`  
**Misma condición de determinismo y rango.

### 32.4 `easeInOut(t)`

**FUNCTION-ID:** `EASE-004`  
**Determinismo y rango `[0,1]`.

La implementación DEBE fijar las fórmulas exactas antes de generar tests dorados; no puede escogerlas arbitrariamente después.

---

# 33. `animation/Animation.js`

## Estado

```text
id
target
state
elapsed
duration
priority
interruptibility
interpolator
```

Estados:

```text
IDLE
RUNNING
COMPLETED
CANCELLED
INTERRUPTED
```

### 33.1 `constructor(config)`

**FUNCTION-ID:** `ANIM-001`  
**Precondición:** config completo.  
**Salida:** animación IDLE.

### 33.2 `start()`

**FUNCTION-ID:** `ANIM-002`  
**Precondición:** IDLE.  
**Mutación:** RUNNING, elapsed=0.  
**No reinicia una animación ya completada salvo función explícita de reset.

### 33.3 `update(dt)`

**FUNCTION-ID:** `ANIM-003`  
**Precondición:** RUNNING; `dt > 0`.  
**Operación:** avanzar elapsed; calcular progreso; producir valor de track; activar callbacks contractuales.  
**No puede ejecutar dos veces la misma transición terminal.

### 33.4 `cancel(reason)`

**FUNCTION-ID:** `ANIM-004`  
**Mutación:** RUNNING → CANCELLED.  
**Debe preservar el último Current result salvo política explícita de rollback.

### 33.5 `complete()`

**FUNCTION-ID:** `ANIM-005`  
**Mutación:** RUNNING → COMPLETED y aplicar resultado terminal exacto.

### 33.6 `isFinished()`

**FUNCTION-ID:** `ANIM-006`  
**Salida:** true para COMPLETED/CANCELLED/INTERRUPTED.

### 33.7 `getProgress()`

**FUNCTION-ID:** `ANIM-007`  
**Salida:** progreso `[0,1]` mientras exista duración válida.

---

# 34. `animation/AnimationTrack.js`

### 34.1 `constructor(config)`

**FUNCTION-ID:** `TRACK-001`  
**Precondición:** target property e interpolador compatibles.

### 34.2 `evaluate(t)`

**FUNCTION-ID:** `TRACK-002`  
**Entrada:** `t ∈ [0,1]`.  
**Salida:** valor interpolado.  
**No muta estado de target.

### 34.3 `reset()`

**FUNCTION-ID:** `TRACK-003`  
**Mutación:** estado temporal del track vuelve a inicial.

### 34.4 `getTargetPath()`

**FUNCTION-ID:** `TRACK-004`  
**Salida:** identificador estable de propiedad destino.

---

# 35. `animation/AnimationQueue.js`

### 35.1 `constructor()`

**FUNCTION-ID:** `QUEUE-001`  
**Estado inicial:** vacía.

### 35.2 `enqueue(animation)`

**FUNCTION-ID:** `QUEUE-002`  
**Orden:** priority DESC, sequence ASC.  
**Mutación:** inserción exacta una vez.

### 35.3 `dequeue()`

**FUNCTION-ID:** `QUEUE-003`  
**Salida:** siguiente elemento o null.  
**Mutación:** elimina sólo ese elemento.

### 35.4 `peek()`

**FUNCTION-ID:** `QUEUE-004`  
**Salida:** siguiente sin eliminar.

### 35.5 `clear()`

**FUNCTION-ID:** `QUEUE-005`  
**Mutación:** elimina todas las animaciones pendientes; NO cancela activas salvo contrato explícito del controller.

---

# 36. `animation/AnimationController.js`

### 36.1 `constructor(clock)`

**FUNCTION-ID:** `ANCTRL-001`  
**Dependencia:** clock inyectado; no crear reloj interno oculto.

### 36.2 `add(animation)`

**FUNCTION-ID:** `ANCTRL-002`  
**Mutación:** registrar animación según política de target/priority/interruption.

### 36.3 `remove(animationId)`

**FUNCTION-ID:** `ANCTRL-003`  
**Mutación:** elimina sólo la animación identificada y aplica estado terminal definido.

### 36.4 `update(dt)`

**FUNCTION-ID:** `ANCTRL-004`  
**Secuencia:** ordenar/activar → actualizar activas → resolver conflictos → aplicar outputs.  
**No puede solicitar directamente tiempo al sistema.

### 36.5 `cancelById(animationId, reason)`

**FUNCTION-ID:** `ANCTRL-005`  
**Mutación:** cancela la animación objetivo si está activa/pendiente según su estado.

### 36.6 `getActive()`

**FUNCTION-ID:** `ANCTRL-006`  
**Salida:** snapshot de activas, no referencia mutable interna.

---

# 37. `resources/AssetManager.js`

### 37.1 `constructor()`

**FUNCTION-ID:** `ASSET-001`  
**Estado:** registry vacío.

### 37.2 `register(id, asset)`

**FUNCTION-ID:** `ASSET-002`  
**Precondición:** id único o política explícita de reemplazo.  
**NO DEBE sobrescribir silenciosamente un recurso existente.

### 37.3 `get(id)`

**FUNCTION-ID:** `ASSET-003`  
**Salida:** asset registrado o `null`/error según política única; la política debe ser consistente.

### 37.4 `has(id)`

**FUNCTION-ID:** `ASSET-004`  
**Salida:** booleano.

### 37.5 `release(id)`

**FUNCTION-ID:** `ASSET-005`  
**Mutación:** elimina registro y libera ownership interno conforme al tipo de recurso.  
**No puede liberar un recurso que siga referenciado por ownership activo sin resolución explícita.

### 37.6 `clear()`

**FUNCTION-ID:** `ASSET-006`  
**Mutación:** liberar todos los recursos poseídos.

---

# 38. `resources/EmotionLoader.js`

### 38.1 `constructor(schemaValidator)`

**FUNCTION-ID:** `ELOAD-001`  
**Dependencia:** validador inyectado.

### 38.2 `load(source)`

**FUNCTION-ID:** `ELOAD-002`  
**Operación:** obtener datos → parsear → validar → construir `EmotionDefinition`.  
**No registra automáticamente en FSM salvo llamada explícita de registro.

### 38.3 `parse(source)`

**FUNCTION-ID:** `ELOAD-003`  
**Salida:** estructura intermedia.  
**Error:** `EmotionParseError`.

### 38.4 `validate(data)`

**FUNCTION-ID:** `ELOAD-004`  
**Salida:** válido o `InvalidEmotionDefinitionError`.  
**No corrige silenciosamente.

---

# 39. `resources/ResourceCache.js`

### 39.1 `constructor()`

**FUNCTION-ID:** `CACHE-001`  
**Estado:** vacío.

### 39.2 `get(key)`

**FUNCTION-ID:** `CACHE-002`  
**Salida:** recurso cacheado o miss explícito.

### 39.3 `set(key, value)`

**FUNCTION-ID:** `CACHE-003`  
**Mutación:** registra/reemplaza sólo según política de cache definida; no puede romper ownership.

### 39.4 `has(key)`

**FUNCTION-ID:** `CACHE-004`  
**Salida:** booleano.

### 39.5 `delete(key)`

**FUNCTION-ID:** `CACHE-005`  
**Mutación:** elimina clave únicamente.

### 39.6 `clear()`

**FUNCTION-ID:** `CACHE-006`  
**Mutación:** vacía cache.

---

# 40. `renderer/RenderCommandQueue`

`RenderCommandQueue` es parte contractual de la capa renderer aunque pueda residir físicamente junto a `Renderer.js` durante una implementación inicial.

## Estado

Secuencia ordenada de comandos válidos.

### 40.1 `constructor()`

**FUNCTION-ID:** `RCQ-001`  
**Estado:** cola vacía.

### 40.2 `push(command)`

**FUNCTION-ID:** `RCQ-002`  
**Precondición:** comando completo y válido.  
**Mutación:** añade exactamente una orden al final.  
**Error:** `InvalidRenderCommandError`.

### 40.3 `clear()`

**FUNCTION-ID:** `RCQ-003`  
**Mutación:** elimina comandos pendientes.

### 40.4 `size()`

**FUNCTION-ID:** `RCQ-004`  
**Salida:** número de comandos.

### 40.5 `toArray()`

**FUNCTION-ID:** `RCQ-005`  
**Salida:** snapshot ordenado; NO referencia mutable interna.

### 40.6 `validate()`

**FUNCTION-ID:** `RCQ-006`  
**Salida:** cola válida o error.  
**Debe verificar que no existan comandos con referencias inválidas o parámetros no finitos.

## Tipos mínimos de comando

```text
PushState
PopState
SetTransform
SetOpacity
SetStyle
SetClip
DrawPath
DrawCircle
DrawText
```

## Invariantes

- el orden del comando refleja el orden de dibujo;
- no se modifica la escena mientras se consume una cola de frame;
- cada comando conserva `sourceNode` identificable para trazabilidad.

---

# 41. `renderer/Renderer.js`

### 41.1 `beginFrame(frameInfo)`

**FUNCTION-ID:** `RENDER-001`  
**Precondición:** renderer operativo; frameInfo válido.  
**Mutación:** estado de frame actual.  
**NO DEBE:** modificar Scene Graph.

### 41.2 `submit(commandQueue)`

**FUNCTION-ID:** `RENDER-002`  
**Precondición:** queue validada.  
**Operación:** consumir comandos en orden exacto.  
**NO DEBE:** reordenar por conveniencia salvo optimización que preserve orden visual equivalente y contrato de composición.

### 41.3 `endFrame(frameInfo)`

**FUNCTION-ID:** `RENDER-003`  
**Mutación:** cerrar frame y presentar resultados conforme al backend.  
**No puede generar cambios de dominio.

### 41.4 `destroy()`

**FUNCTION-ID:** `RENDER-004`  
**Mutación:** liberar recursos propios del renderer.  
**No destruye Scene Graph.

---

# 42. `renderer/Canvas2DRenderer.js`

### 42.1 `constructor(context, viewport)`

**FUNCTION-ID:** `C2D-001`  
**Precondición:** contexto Canvas2D válido.

### 42.2 `beginFrame(frameInfo)`

**FUNCTION-ID:** `C2D-002`  
**Operación:** preparar estado de frame y limpiar/restaurar regiones conforme a dirty policy.  
**NO DEBE:** limpiar toda la superficie cuando dirty regions sean parte del modo de ejecución, salvo fallback explícito documentado.

### 42.3 `submit(queue)`

**FUNCTION-ID:** `C2D-003`  
**Operación:** traducir cada comando a API Canvas2D correspondiente.

### 42.4 `executeCommand(command)`

**FUNCTION-ID:** `C2D-004`  
**Dispatch exacto por tipo de comando.  
**No contiene lógica de dominio.

### 42.5 `endFrame(frameInfo)`

**FUNCTION-ID:** `C2D-005`  
**Operación:** finalizar frame; no muta escena.

### 42.6 `destroy()`

**FUNCTION-ID:** `C2D-006`  
**Libera referencias al contexto propias del renderer.

---

# 43. `engine/Clock.js`

## Contrato de tiempo

Todos los componentes temporales reciben `dt` del Clock/Engine.

### 43.1 `constructor()`

**FUNCTION-ID:** `CLOCK-001`  
**Estado:** inicializado sin delta previo.

### 43.2 `now()`

**FUNCTION-ID:** `CLOCK-002`  
**Salida:** tiempo monotónico del runtime en segundos o equivalente claramente convertido a segundos.  
**No muta subsistemas externos.

### 43.3 `getDeltaTime()`

**FUNCTION-ID:** `CLOCK-003`  
**Salida:** delta desde la lectura anterior, limitado por la política máxima de frame para evitar explosiones de simulación.  
**La política de clamp debe quedar fijada por configuración, no elegirse por el código de llamada.

### 43.4 `reset()`

**FUNCTION-ID:** `CLOCK-004`  
**Mutación:** reinicia referencia temporal.

---

# 44. `engine/Scheduler.js`

### 44.1 `constructor()`

**FUNCTION-ID:** `SCHED-001`  
**Estado:** lista de tareas vacía.

### 44.2 `schedule(task, phase, priority, dependencies)`

**FUNCTION-ID:** `SCHED-002`  
**Precondiciones:** task válida; phase conocida; dependencias registradas o resolubles.  
**Mutación:** registra tarea.  
**NO DEBE:** ejecutar inmediatamente si schedule es sólo registro.

### 44.3 `cancel(taskId)`

**FUNCTION-ID:** `SCHED-003`  
**Mutación:** impide futura ejecución de task pendiente.

### 44.4 `update(dt, phase)`

**FUNCTION-ID:** `SCHED-004`  
**Orden:** respetar dependencies → priority → sequence estable.  
**No puede ejecutar tarea de una fase distinta.

### 44.5 `clear()`

**FUNCTION-ID:** `SCHED-005`  
**Mutación:** elimina tareas pendientes.

---

# 45. `engine/Engine.js`

## Estado

```text
state = CREATED | RUNNING | PAUSED | STOPPED | DESTROYED
clock
scheduler
scene
renderer
dirtyRegionManager
```

### 45.1 `constructor(config)`

**FUNCTION-ID:** `ENGINE-001`  
**Precondiciones:** scene, renderer y dependencias válidas.  
**Estado inicial:** CREATED.

### 45.2 `start()`

**FUNCTION-ID:** `ENGINE-002`  
**Precondición:** CREATED o STOPPED.  
**Mutación:** RUNNING.  
**No puede iniciar un segundo loop paralelo.

### 45.3 `stop()`

**FUNCTION-ID:** `ENGINE-003`  
**Mutación:** RUNNING/PAUSED → STOPPED; cancela scheduling de frames futuros.  
**No destruye recursos.

### 45.4 `pause()`

**FUNCTION-ID:** `ENGINE-004`  
**Mutación:** RUNNING → PAUSED.  
**Las animaciones no avanzan mientras está pausado.

### 45.5 `resume()`

**FUNCTION-ID:** `ENGINE-005`  
**Mutación:** PAUSED → RUNNING.  
**El frame de reanudación no debe introducir un `dt` gigante desde la pausa; Clock debe resetear referencia o aplicar política explícita.

### 45.6 `step()`

**FUNCTION-ID:** `ENGINE-006`  
**Uso:** pruebas/determinismo.  
**Precondición:** engine detenido o en modo stepping.  
**Operación:** ejecutar exactamente un frame lógico.

### 45.7 `update(dt)`

**FUNCTION-ID:** `ENGINE-007`  
**Secuencia obligatoria:** F1..F11; NO renderiza si el contrato de Engine separa update/render.

### 45.8 `render()`

**FUNCTION-ID:** `ENGINE-008`  
**Secuencia:** generar commands → renderer begin → submit → end.  
**No modifica dominio.

### 45.9 `dispose()`

**FUNCTION-ID:** `ENGINE-009`  
**Mutación:** DESTROYED; libera recursos propios y rompe referencias internas.  
**No debe destruir assets globales que no posea.

---

# 46. `character/balon_imagen.js`

## Responsabilidad

Ensamblar el personaje concreto utilizando sólo capacidades existentes del motor.

## No-responsabilidades

No implementa matemáticas base, FSM, solver, renderer, hit tester ni scheduler.

### 46.1 `constructor(engineServices, assetManager, emotionRegistry)`

**FUNCTION-ID:** `EBS-001`  
**Precondiciones:** servicios válidos.  
**Salida:** composición inicial no necesariamente conectada al loop.

### 46.2 `build()`

**FUNCTION-ID:** `EBS-002`  
**Operaciones obligatorias:**

1. crear root/personaje;
2. crear BodyNode;
3. crear ojos izquierdo/derecho;
4. crear pupilas según composición definida;
5. crear boca;
6. crear capas de cintas, partículas y Zzz;
7. establecer parentage;
8. registrar listeners/interacción;
9. registrar capacidades visuales necesarias;
10. validar que todas las referencias existan.

**NO DEBE:** omitir una capa sólo porque el estado inicial no la use.

### 46.3 `setEmotion(emotionId)`

**FUNCTION-ID:** `EBS-003`  
**Operación:** enviar intención/evento al dominio; NO saltar la FSM.  
**Salida:** resultado de enqueue/transition según contrato.

### 46.4 `setGazeTarget(point)`

**FUNCTION-ID:** `EBS-004`  
**Operación:** actualizar target físico autorizado.  
**NO DEBE:** modificar directamente la geometría del ojo.

### 46.5 `updateFromPose(currentPose)`

**FUNCTION-ID:** `EBS-005`  
**Responsabilidad:** traducir `CurrentPose` a propiedades de nodos según mapa explícito.  
**NO DEBE:** reinterpretar emoción ni crear animaciones nuevas.

### 46.6 `getRoot()`

**FUNCTION-ID:** `EBS-006`  
**Salida:** root controlado.

### 46.7 `getPose()`

**FUNCTION-ID:** `EBS-007`  
**Salida:** snapshot de pose actual.

### 46.8 `destroy()`

**FUNCTION-ID:** `EBS-008`  
**Operación:** retirar listeners, desacoplar nodos propios y liberar recursos poseídos por la escena.  
**No debe destruir recursos compartidos.

---

# 47. Pseudo-3D y proyección visual del personaje

La proyección pseudo-3D es una capacidad explícita de la composición geométrica del personaje.

## Requisitos funcionales

Debe poder representar:

- desplazamiento aparente de rasgos sobre una superficie curva;
- compresión lateral por orientación;
- ocultación parcial/posterior mediante profundidad;
- escala aparente dependiente de orientación cuando el contrato del personaje la utilice;
- separación visual frente/detrás de overlays o cintas.

## Operación contractual

```text
surface coordinates
        ↓
orientation / yaw / tilt
        ↓
projected screen coordinates
        ↓
depth
        ↓
visibility / scale
```

Una implementación que simplemente traslade elementos en X/Y NO es equivalente.

---

# 48. Morphing vectorial

El morphing de rasgos faciales DEBE operar sobre geometría compatible.

No puede sustituirse por:

- scaling;
- rotation;
- translation;
- cambio de stroke;
- cambio de opacity;

cuando el contrato de la emoción exige cambio de forma.

## Invariantes

```text
t=0 → geometry A
t=1 → geometry B
```

Las geometrías intermedias deben mantener topología compatible y parámetros finitos.

---

# 49. Partículas

Las partículas deben poseer, según el efecto:

```text
position
velocity
acceleration
age
lifetime
rotation
angularVelocity
scale
opacity
```

## Ciclo obligatorio

```text
spawn → update(dt) → expire → remove
```

Una partícula expirada NO puede producir un command de render.

Las fórmulas físicas concretas de cada efecto DEBEN documentarse en el TDD del sistema de partículas correspondiente; no pueden sustituirse por un movimiento visual arbitrario.

---

# 50. Cintas y overlays jerárquicos

Las cintas deben ser nodos o subárboles del Scene Graph cuando dependan de la transformación del personaje.

Deben conservar:

```text
parent
transform
visibility
z-order
lifetime
geometry
```

`Zzz` también debe ser jerárquico cuando deba seguir al personaje.

No es válido dibujar una cinta directamente desde un callback global si el efecto contractual exige relación jerárquica con el personaje.

---

# 51. Compatibilidad funcional con `emotion-ball`

La implementación DEBE conservar las capacidades observables relevantes del archivo de referencia:

```text
- cuerpo vectorial
- ojos definidos por geometría
- morphing/interpolación de ojos
- transformación del cuerpo
- mirada dinámica
- proyección pseudo-3D de ojos
- ocultación por profundidad/orientación
- cintas orbitales
- separación frontal/posterior por profundidad
- gradientes de las cintas
- partículas de celebración
- partículas Zzz
- estados emocionales
- transiciones animadas
```

## Regla de equivalencia

El resultado no se considera equivalente por parecer visualmente similar en una captura.

Debe conservar:

```text
semántica de estado
semántica de transformación
semántica temporal
semántica geométrica
semántica de interacción
```

---

# 52. Trazabilidad contractual

Toda ruta funcional significativa debe poder expresarse como:

```text
TRIGGER
↓
CALLER
↓
FUNCTION-ID
↓
INPUT STATE
↓
MUTATION
↓
OUTPUT
↓
CONSUMER
↓
NEXT FUNCTION-ID
↓
OBSERVABLE EFFECT
```

## Ejemplo obligatorio

```text
PointerMove
↓
INT-002 handlePointerMove()
↓
gazeTarget
↓
POSE-RES-002 resolve()
↓
TargetPose.leftEye
↓
ANCTRL-004 update()
↓
NODE-005/006/007 o setGeometry
↓
DIRTY-002 invalidate()
↓
RCQ-002 push()
↓
C2D-004 executeCommand()
↓
ojo renderizado en nueva posición
```

Esta cadena debe poder reconstruirse mediante instrumentación o pruebas.

---

# 53. Reglas de mutación

## 53.1 Regla single-owner

Cada estado mutable relevante debe tener un propietario principal.

Ejemplos:

```text
FSM state       → EmotionFSM
TargetPose      → PoseResolver / dominio de pose
CurrentPose     → AnimationController
WorldTransform  → SceneNode
Geometry        → Geometry / Geometry owner
Dirty flags     → SceneNode
Dirty regions   → DirtyRegionManager
Render commands → RenderCommandQueue
Clock state     → Clock
```

## 53.2 Prohibición

Dos módulos no pueden modificar la misma propiedad semántica sin un protocolo explícito de coordinación.

---

# 54. Reglas de estado objetivo vs estado actual

Toda propiedad animable DEBE distinguir:

```text
TARGET
CURRENT
```

No es válido escribir directamente `CURRENT = TARGET` para eliminar la animación si la transición contractual exige dinámica temporal.

Tampoco es válido mover el TARGET para alterar visualmente el CURRENT cuando el contrato define que la entrada sólo afecta al objetivo.

---

# 55. Errores contractuales

Errores mínimos previstos:

```text
InvalidNumericInputError
InvalidVectorError
ZeroLengthVectorError
InvalidMatrixError
NonInvertibleMatrixError
InvalidAABBError
InvalidPathError
PathCompatibilityError
NormalizationError
SceneGraphCycleError
InvalidParentError
InvalidOpacityError
InvalidSceneGraphError
InvalidEventError
InvalidEmotionDefinitionError
EmotionParseError
InvalidPoseError
PoseConstraintError
AnimationError
InvalidAnimationStateError
InvalidRenderCommandError
RenderError
ResourceError
```

Cada error debe conservar contexto suficiente para identificar:

```text
FUNCTION-ID
input
estado previo
causa
```

No se permite catch-and-ignore para errores de contrato.

---

# 56. Invariantes globales

## INV-001 — Jerarquía

La escena nunca contiene ciclos.

## INV-002 — Transformación

Para todo nodo no root:

```text
world = parentWorld × local
```

## INV-003 — Inversión

Toda transformación utilizada para worldToLocal debe ser invertible.

## INV-004 — Bounds

Los bounds mundiales representan el área renderizada correspondiente al estado actual cuando están limpios.

## INV-005 — Dirty

Una mutación significativa nunca puede dejar el estado relevante marcado como limpio.

## INV-006 — Tiempo

Los subsistemas temporales usan el mismo `dt` contractual del frame.

## INV-007 — FSM

Iguales estado/evento producen igual transición.

## INV-008 — Render

Un frame de render consume un snapshot coherente de comandos.

## INV-009 — Backend

Ninguna clase de dominio o Scene Graph conoce la implementación del backend.

## INV-010 — Trazabilidad

Cada render command debe conservar un origen identificable o una relación equivalente de diagnóstico.

---

# 57. Criterios obligatorios de prueba matemática

### Vector2

- suma;
- resta;
- producto escalar;
- dot;
- longitud;
- normalización;
- cero;
- tolerancia.

### Matrix3x3

```text
M × I ≈ M
M × inverse(M) ≈ I
inverse(inverse(M)) ≈ M
```

### Transform

Verificar composición y que la traslación no afecte `transformVector`.

### AABB

Verificar union, contains, intersects y transformación con rotación.

---

# 58. Criterios obligatorios de prueba del Scene Graph

Debe probarse:

1. root;
2. hijo;
3. nieto;
4. transformaciones anidadas;
5. reparenting según política definida;
6. rechazo de ciclos;
7. actualización de world transform;
8. propagación de dirty;
9. bounds antiguos/nuevos;
10. visibilidad;
11. opacity;
12. orden de hijos.

---

# 59. Criterios obligatorios de prueba de eventos

Debe probarse:

- hit básico;
- hit tras rotación;
- hit tras escala;
- hit anidado;
- Capture;
- Target;
- Bubble;
- stopPropagation;
- stopImmediatePropagation;
- local position;
- world position;
- target correcto.

---

# 60. Criterios obligatorios de prueba de animación

Debe probarse:

- `dt` pequeño;
- `dt` máximo permitido;
- pause/resume;
- spring determinista;
- spring convergente;
- morphing `t=0/1`;
- incompatibilidad de paths;
- prioridad;
- interrupción;
- cancelación;
- completion;
- queue ordering.

---

# 61. Criterios obligatorios de prueba de FSM

Debe probarse:

- estado inicial;
- transición válida;
- evento inválido;
- prioridad;
- desempate por sequence;
- preservación del estado ante rechazo;
- determinismo;
- múltiples eventos en un mismo ciclo.

---

# 62. Criterios obligatorios de prueba de renderer

Debe probarse:

- orden de comandos;
- transform;
- opacity;
- style;
- clipping;
- path;
- circle;
- text;
- dirty regions;
- ausencia de mutación del Scene Graph durante render.

---

# 63. Criterios de rendimiento

El motor debe instrumentar:

```text
frameTime
updateTime
animationTime
sceneUpdateTime
boundsTime
dirtyRegionTime
commandGenerationTime
renderTime
nodesUpdated
nodesRendered
commandsGenerated
dirtyArea
allocationsPerFrame
GC pauses
```

Objetivo de referencia inicial:

```text
60 FPS ≈ 16.67 ms/frame
```

Esto es objetivo de benchmark, no una afirmación de rendimiento ya obtenido.

No se aceptarán límites inventados para afirmar que el motor es eficiente antes de medir.

---

# 64. Memoria y allocation churn

Debe observarse:

```text
heap usage
peak heap
objects/frame
temporary vectors/frame
temporary matrices/frame
path allocations/frame
commands/frame
particle allocations/frame
```

La implementación debe evitar asignaciones innecesarias por frame cuando exista una alternativa semánticamente equivalente y medible.

Pero una optimización de allocation NO puede eliminar una copia requerida para proteger ownership o invariantes.

---

# 65. Criterios de no-omisión

Se rechaza la implementación si:

- elimina una funcionalidad definida;
- elimina una fase del ciclo de frame;
- combina responsabilidades de módulos para reducir archivos;
- hace que un renderer conozca el dominio;
- hace que la FSM conozca nodos;
- reemplaza morphing por scale;
- reemplaza pseudo-3D por translate 2D;
- reemplaza hit testing geométrico por sólo AABB cuando el contrato exige geometría;
- elimina dirty regions sin benchmark y sin conservar contrato;
- elimina prioridad de eventos;
- elimina cola de animaciones;
- usa tiempo propio en Animation/Spring/FSM;
- reordena comandos de render sin equivalencia demostrable;
- oculta incompatibilidades geométricas;
- degrada estados inválidos silenciosamente;
- agrega fallback semántico no especificado;
- modifica el contrato para hacer pasar una prueba en vez de corregir la implementación;
- implementa sólo el camino feliz.

---

# 66. Criterios de no-desviación

No se permite justificar una desviación con:

- "visualmente se ve igual";
- "es suficiente para el demo";
- "reduce código";
- "es más simple";
- "es más rápido de escribir";
- "el usuario nunca lo notará";
- "Canvas lo hace automáticamente";
- "el renderer puede resolverlo".

La equivalencia debe demostrarse mediante contrato y pruebas.

---

# 67. Proceso obligatorio para agregar o cambiar una función

Antes de modificar una función existente o agregar una nueva:

1. identificar el módulo propietario;
2. justificar la responsabilidad;
3. definir firma;
4. definir entradas/salidas;
5. definir pre/postcondiciones;
6. definir mutaciones;
7. definir invariantes afectadas;
8. definir caller y consumidor;
9. definir pruebas;
10. actualizar este TDD antes del código.

NO se permite implementar primero y documentar después.

---

# 68. Proceso obligatorio para modificar arquitectura

Toda modificación debe registrar:

```text
CHANGE-ID
motivo
contrato anterior
contrato nuevo
módulos afectados
funciones afectadas
invariantes afectadas
tests afectados
compatibilidad
```

Una modificación de comportamiento no puede ocultarse como refactor interno.

---

# 69. Orden contractual de implementación

```text
Vector2
 ↓
Matrix3x3
 ↓
Transform
 ↓
AABB
 ↓
Path / BezierPath / Circle / GeometryUtils
 ↓
SceneNode
 ↓
GroupNode / PathNode / CircleNode
 ↓
HitTester / Event / EventDispatcher / InteractionEngine
 ↓
Clock
 ↓
SpringSolver / PathInterpolator / Easing
 ↓
Animation / Track / Queue / Controller
 ↓
Emotion / EmotionDefinition / EmotionEvent / FSM / Pose / PoseResolver
 ↓
AssetManager / EmotionLoader / ResourceCache
 ↓
RenderCommandQueue / Renderer / Canvas2DRenderer
 ↓
Scheduler / Engine
 ↓
balon_imagen
```

Cada etapa debe pasar pruebas antes de convertirse en dependencia de la siguiente.

---

# 70. Criterios de aceptación del motor completo

El motor se acepta únicamente cuando se demuestre simultáneamente:

```text
[ ] contratos implementados
[ ] funciones concretas implementadas
[ ] invariantes verificadas
[ ] matemáticas verificadas
[ ] coordenadas verificadas
[ ] bounds verificados
[ ] dirty propagation verificada
[ ] dirty regions verificadas
[ ] hit testing verificado
[ ] eventos verificados
[ ] FSM verificada
[ ] prioridad verificada
[ ] pose verificada
[ ] animaciones verificadas
[ ] morphing verificado
[ ] pseudo-3D verificado
[ ] partículas verificadas
[ ] overlays verificados
[ ] comandos de render verificados
[ ] Canvas2D verificado
[ ] desacoplamiento backend verificado
[ ] trazabilidad verificada
[ ] compatibilidad funcional con emotion-ball verificada
[ ] pruebas negativas verificadas
[ ] pruebas de límites verificadas
[ ] benchmark ejecutado
```

La apariencia correcta por sí sola NO cumple el criterio de aceptación.

---

# 71. Regla final de cierre

Una implementación sólo puede marcarse como **DONE** cuando exista la cadena:

```text
CONTRATO
  ↓
IMPLEMENTACIÓN
  ↓
PRUEBAS
  ↓
INVARIANTES
  ↓
TRAZABILIDAD
  ↓
BENCHMARK
  ↓
ACEPTACIÓN
```

Un módulo con funciones sin contrato, estados sin owner, mutaciones sin trazabilidad o fallback no especificado NO está terminado.

---

# 72. Checklist de revisión de código

Antes de aceptar cualquier archivo:

```text
[ ] ¿Cada función tiene FUNCTION-ID?
[ ] ¿Tiene caller autorizado?
[ ] ¿Tiene precondiciones?
[ ] ¿Tiene postcondiciones?
[ ] ¿Tiene entrada y salida definidas?
[ ] ¿Tiene mutaciones definidas?
[ ] ¿Tiene estados prohibidos para modificar?
[ ] ¿Tiene errores explícitos?
[ ] ¿Tiene invariantes verificables?
[ ] ¿Tiene consumidor identificado?
[ ] ¿Tiene efecto observable?
[ ] ¿Tiene pruebas de camino feliz?
[ ] ¿Tiene pruebas negativas?
[ ] ¿Tiene casos límite?
[ ] ¿Mantiene la responsabilidad del módulo?
[ ] ¿Respeta el orden de ejecución?
[ ] ¿No introduce comportamiento implícito?
[ ] ¿No simplifica una capacidad contractual?
```

Cualquier respuesta negativa en una condición obligatoria impide la aceptación del archivo.

---

# 73. Estado del documento

Este `tdd.md` es el **contrato maestro cerrado** del motor.

Los TDD posteriores de archivo/función NO pueden reducir requisitos definidos aquí.

Un TDD inferior sólo puede:

- concretar tipos;
- fijar fórmulas;
- fijar estructuras de datos;
- fijar valores de configuración;
- especificar casos particulares del módulo;
- agregar restricciones compatibles;
- agregar pruebas más estrictas.

Un TDD inferior NO puede eliminar una obligación del presente documento.

