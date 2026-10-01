# Path — Bloques contractuales (PATH-001 a PATH-011)

Módulo: `src/geometry/Path.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/math/AABB.js`, `src/math/Epsilon.js`, `src/errors/*`, `./CommandType.js`
Prohibiciones absolutas:
- Ningún `NaN`/`Infinity`/`undefined` como estado válido.
- Comparación exacta de floats prohibida; usar `EPSILON_MATH`.
- Comandos NO son instancias de clase. Son objetos planos congelados (ADR-004-D1).
- PROHIBIDO mutar comandos después de creados (ADR-004-D1).
- PROHIBIDO reutilizar errores de `math/` en `geometry/` (ADR-004-D6).
- PROHIBIDO transformar sólo puntos de control crudos en `getBounds()` (ADR-004-D4).
- PROHIBIDO muestreo uniforme fijo en `getBounds()` (ADR-004-D4).
- Cero import de `scenegraph/`, `animation/`, `domain/`, `renderer/`, `engine/`, DOM.
- Cero uso de `Date.now()`, `performance.now()`, `new Date()`.
- Cero uso de typed arrays (`Float32Array`, etc.).

Decisiones vinculantes aplicadas (resolución de bloqueos):
- (a) `close()` sin subpath activo → `InvalidPathError`.
- (b) `isClosed()` con múltiples subpaths → `true` sólo si TODOS los subpaths están cerrados. Path vacío → `false`.
- (c) Path no expone dirty/versioning. Responsabilidad del consumidor que muta.
- (d) `getBounds()` con sólo MOVE_TO → AABB puntual. Path con cero comandos → `AABB.empty()`.
- (e) CLOSE consecutivos → el segundo `close()` lanza `InvalidPathError` (consecuencia de (a)).
- (f) Comando no-congelado en constructor → `InvalidPathError`.

Invariantes aplicables:
- GEO-01 (§8): modificar una geometría debe invalidar sus bounds. Path es inmutable semánticamente; el consumidor que muta es responsable de notificar aguas arriba.
- GEO-02 (§8): la geometría no conoce SceneNode, Renderer, Canvas, WebGL, FSM.
- INV-004 (§56): bounds representan el área correspondiente al estado actual.

Referencias ADR-004:
- D1: representación de comandos (objetos planos congelados, type string de enum congelado).
- D2: copia en constructor y clone.
- D4: bounds por subdivisión adaptativa De Casteljau.
- D6: errores cerrados de geometry/.

---

## CommandType — Módulo auxiliar (ADR-004-D1)

Módulo: `src/geometry/CommandType.js`
Dependencias: ninguna.
Prohibiciones: cero lógica. Sólo constantes. No es enum TypeScript, no es Symbol, no es clase.

Valores exportados:
    MOVE_TO = 'MOVE_TO'
    LINE_TO = 'LINE_TO'
    QUADRATIC_TO = 'QUADRATIC_TO'
    CUBIC_TO = 'CUBIC_TO'
    CLOSE = 'CLOSE'

Invariante: `Object.isFrozen(CommandType) === true`.

---

## PATH-001 · constructor(commands)

- **Propósito**: Construir un Path a partir de un array de comandos congelados.
- **Entradas**: `commands: Array<Object>` — cada elemento debe ser un objeto plano congelado con `type` reconocido y params correctos.
- **Salidas**: instancia `Path` independiente del array recibido.
- **Precondiciones**:
    - `Array.isArray(commands)`.
    - Cada comando es `Object.isFrozen(cmd) === true`.
    - Cada comando tiene `type` en `{MOVE_TO, LINE_TO, QUADRATIC_TO, CUBIC_TO, CLOSE}`.
    - Params correctos por tipo (ver tabla abajo).
    - Todos los números en params son finitos.
- **Postcondiciones**:
    - `this.#commands` es `[...commands]` (copia superficial del array).
    - Los elementos de `this.#commands` son las mismas referencias congeladas recibidas.
    - El Path es independiente del array externo.
- **Params por tipo**:
    - `MOVE_TO`: `{ type, x, y }`
    - `LINE_TO`: `{ type, x, y }`
    - `QUADRATIC_TO`: `{ type, cx, cy, x, y }`
    - `CUBIC_TO`: `{ type, c1x, c1y, c2x, c2y, x, y }`
    - `CLOSE`: `{ type }`
- **Invariantes**: todos los comandos internos están congelados; todos los números son finitos.
- **Errores**:
    - `InvalidPathError` si `commands` no es array.
    - `InvalidPathError` si algún comando no está congelado (decisión (f)).
    - `InvalidPathError` si algún comando tiene `type` no reconocido.
    - `InvalidPathError` si algún comando tiene params faltantes o incorrectos.
    - `InvalidPathError` si algún número en params no es finito.
- **Complejidad**: O(n) tiempo, O(n) espacio (copia de array).
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A en construcción.
- **Casos límite**: array vacío; array con 1 comando; array con 1000 comandos; coordenadas extremas finitas.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - Constructor con array vacío → Path válido.
    - Constructor con comandos válidos → Path correcto.
    - Mutar array externo después del constructor no afecta al Path.
    - Comandos compartidos (mismas referencias congeladas).
    - Rechazo de comando no-congelado.
    - Rechazo de type no reconocido.
    - Rechazo de params NaN/Infinity.
    - Rechazo de null como argumento.
- **Ejemplo**: `new Path([Object.freeze({ type: CommandType.MOVE_TO, x: 0, y: 0 })])`.
- **Notas**: ADR-004-D2. El motor no proporciona factoría pública de comandos en 5a; los métodos del Path congelan internamente.
- **Historial**: v3.0 + ADR-004-D1/D2 + resolución bloqueo (f).

---

## PATH-002 · moveTo(x, y)

- **Propósito**: Agregar un comando MOVE_TO al Path.
- **Entradas**: `x: number` finito, `y: number` finito.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `Number.isFinite(x) && Number.isFinite(y)`.
- **Postcondiciones**:
    - Se agrega exactamente un comando `Object.freeze({ type: MOVE_TO, x, y })` al final de `this.#commands`.
    - No hay precondición de subpath previo (MOVE_TO inicia un nuevo subpath).
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si `x` o `y` no son finitos.
- **Complejidad**: O(1) amortizado.
- **Efectos colaterales**: mutación de `this.#commands`.
- **Idempotencia**: no (acumulativo).
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: coordenadas cero; coordenadas negativas; coordenadas extremas finitas.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - moveTo válido agrega 1 comando.
    - moveTo(NaN, 0) lanza error.
    - moveTo(0, Infinity) lanza error.
    - Múltiples moveTo generan múltiples subpaths.
- **Ejemplo**: `path.moveTo(10, 20)`.
- **Notas**: Sin condiciones previas. Siempre válido.
- **Historial**: v3.0.

---

## PATH-003 · lineTo(x, y)

- **Propósito**: Agregar un comando LINE_TO al Path.
- **Entradas**: `x: number` finito, `y: number` finito.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**:
    - `Number.isFinite(x) && Number.isFinite(y)`.
    - Debe existir subpath activo (último comando geométrico antes de este punto debe ser MOVE_TO, LINE_TO, QUADRATIC_TO o CUBIC_TO; no puede ser CLOSE ni vacío).
- **Postcondiciones**: se agrega exactamente un comando `Object.freeze({ type: LINE_TO, x, y })`.
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidPathError` si `x` o `y` no son finitos.
    - `InvalidPathError` si no hay subpath activo.
- **Complejidad**: O(1) amortizado.
- **Efectos colaterales**: mutación de `this.#commands`.
- **Idempotencia**: no.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: coordenadas cero; negativas; extremas.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - lineTo tras moveTo → agrega comando.
    - lineTo sin moveTo → InvalidPathError.
    - lineTo(NaN, 0) → error.
    - lineTo tras close() → error (sin subpath activo).
- **Ejemplo**: `path.lineTo(50, 50)`.
- **Notas**: Precondición estricta de subpath activo.
- **Historial**: v3.0.

---

## PATH-004 · quadraticTo(cx, cy, x, y)

- **Propósito**: Agregar un comando QUADRATIC_TO al Path.
- **Entradas**: `cx, cy, x, y: number` finitos.
- **Salidas**: `void`.
- **Precondiciones**:
    - Todos los números finitos.
    - Subpath activo.
- **Postcondiciones**: agrega `Object.freeze({ type: QUADRATIC_TO, cx, cy, x, y })`.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si algún número no es finito o no hay subpath activo.
- **Complejidad**: O(1) amortizado.
- **Efectos colaterales**: mutación de `this.#commands`.
- **Idempotencia**: no.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: punto de control coincidente con inicio; valores extremos.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - quadraticTo tras moveTo → agrega comando.
    - quadraticTo sin moveTo → error.
    - quadraticTo con NaN → error.
- **Ejemplo**: `path.quadraticTo(25, 50, 50, 50)`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## PATH-005 · cubicTo(c1x, c1y, c2x, c2y, x, y)

- **Propósito**: Agregar un comando CUBIC_TO al Path.
- **Entradas**: `c1x, c1y, c2x, c2y, x, y: number` finitos.
- **Salidas**: `void`.
- **Precondiciones**:
    - Todos los números finitos.
    - Subpath activo.
- **Postcondiciones**: agrega `Object.freeze({ type: CUBIC_TO, c1x, c1y, c2x, c2y, x, y })`.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si algún número no es finito o no hay subpath activo.
- **Complejidad**: O(1) amortizado.
- **Efectos colaterales**: mutación de `this.#commands`.
- **Idempotencia**: no.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: P1/P2 fuera del rango de P0..P3 (crítico para getBounds); valores extremos.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - cubicTo tras moveTo → agrega comando.
    - cubicTo sin moveTo → error.
    - cubicTo con NaN → error.
    - cubicTo con P1 extremo → getBounds lo captura (test cruzado PATH-011).
- **Ejemplo**: `path.cubicTo(10, 20, 30, 40, 50, 60)`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## PATH-006 · close()

- **Propósito**: Agregar un comando CLOSE al Path.
- **Entradas**: ninguna.
- **Salidas**: `void`.
- **Precondiciones**:
    - Debe existir subpath activo (último comando no puede ser CLOSE ni vacío).
    - NO debe haber un CLOSE inmediatamente previo (CLOSE consecutivo prohibido por decisión (e), consecuencia de (a)).
- **Postcondiciones**:
    - Agrega exactamente un comando `Object.freeze({ type: CLOSE })`.
    - NO agrega LINE_TO implícito.
    - NO agrega geometría silenciosa.
    - Cierra el subpath activo.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si no hay subpath activo o si el último comando es CLOSE.
- **Complejidad**: O(1) amortizado.
- **Efectos colaterales**: mutación de `this.#commands`.
- **Idempotencia**: no.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: close tras moveTo válido; close tras close → error; close en path vacío → error.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - close tras moveTo+lineTo → agrega CLOSE.
    - close sin subpath activo → InvalidPathError.
    - close consecutivo → InvalidPathError.
    - close no agrega LINE_TO implícito (segmentCount no cambia).
- **Ejemplo**: `path.close()`.
- **Notas**: Decisiones (a) y (e) aplicadas.
- **Historial**: v3.0 + resolución bloqueos (a)(e).

---

## PATH-007 · clone()

- **Propósito**: Devolver copia independiente del Path.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Path`.
- **Precondiciones**: `this` es `Path` válido.
- **Postcondiciones**:
    - Nuevo Path con `this.#commands` copiado como array (`[...this.#commands]`).
    - Los comandos del clon son las mismas referencias congeladas que los del original (NO se clonan individualmente).
    - Mutar el array interno del clon (agregar/quitar comandos) no afecta al original.
    - Mutar el original no afecta al clon.
- **Invariantes**: preservados en ambos.
- **Errores**: ninguno.
- **Complejidad**: O(n) tiempo, O(n) espacio (copia de array, no de comandos).
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: Path vacío; Path con 1 comando; Path con muchos comandos.
- **Dependencias**: `Path`.
- **Tests obligatorios**:
    - clone() !== original.
    - Arrays distintos.
    - Comandos compartidos (mismas referencias).
    - Mutar clone no afecta original.
    - Mutar original no afecta clone.
    - clone() de Path vacío no lanza.
- **Ejemplo**: `path.clone()`.
- **Notas**: ADR-004-D2. NO clona objetos comando individualmente.
- **Historial**: v3.0 + ADR-004-D2.

---

## PATH-008 · isClosed()

- **Propósito**: Verificar si todos los subpaths del Path están cerrados.
- **Entradas**: ninguna.
- **Salidas**: `boolean`.
- **Precondiciones**: `this` es `Path` válido.
- **Postcondiciones**: `this` no muta.
- **Semántica (decisión (b))**:
    - Path vacío → `false`.
    - Path con cero subpaths → `false`.
    - Path con uno o más subpaths → `true` sólo si TODOS los subpaths contienen un CLOSE explícito.
    - Un subpath se identifica desde un MOVE_TO hasta el siguiente MOVE_TO o hasta el final.
    - Un subpath está cerrado si contiene un CLOSE.
    - NO retorna `true` por coincidencia de primer y último punto sin CLOSE.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(n) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: Path vacío; Path con 1 subpath cerrado; Path con 1 subpath abierto; Path con múltiples subpaths todos cerrados; Path con múltiples subpaths mixtos; Path cuyo último punto coincide con el primero sin CLOSE.
- **Dependencias**: `CommandType`.
- **Tests obligatorios**:
    - Path con CLOSE → true.
    - Path sin CLOSE → false.
    - Path vacío → false.
    - Último punto == primer punto sin CLOSE → false.
    - Múltiples subpaths, todos cerrados → true.
    - Múltiples subpaths, uno abierto → false.
- **Ejemplo**: `path.isClosed()`.
- **Notas**: Decisión (b) aplicada.
- **Historial**: v3.0 + resolución bloqueo (b).

---

## PATH-009 · segmentCount()

- **Propósito**: Contar segmentos geométricos del Path.
- **Entradas**: ninguna.
- **Salidas**: `number >= 0`.
- **Precondiciones**: `this` es `Path` válido.
- **Postcondiciones**: `this` no muta.
- **Semántica**: cuenta LINE_TO + QUADRATIC_TO + CUBIC_TO. NO cuenta MOVE_TO ni CLOSE.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(n) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: Path vacío → 0; sólo MOVE_TO → 0; 1 MOVE_TO + 3 LINE_TO + 1 CLOSE → 3; 1 MOVE_TO + 1 QUADRATIC_TO + 1 CUBIC_TO → 2.
- **Dependencias**: `CommandType`.
- **Tests obligatorios**:
    - Path con 1 MOVE_TO + 3 LINE_TO + 1 CLOSE → 3.
    - Path con 1 MOVE_TO → 0.
    - Path con 1 MOVE_TO + 1 QUADRATIC_TO + 1 CUBIC_TO → 2.
    - Path vacío → 0.
- **Ejemplo**: `path.segmentCount()`.
- **Notas**: CLOSE y MOVE_TO no cuentan como segmentos geométricos.
- **Historial**: v3.0.

---

## PATH-010 · validate()

- **Propósito**: Inspeccionar estructura del Path. NO repara datos.
- **Entradas**: ninguna.
- **Salidas**: `void` si válido; lanza `InvalidPathError` si inválido.
- **Precondiciones**: `this` es `Path`.
- **Postcondiciones**: `this` no muta.
- **Semántica**:
    - Recorre todos los comandos verificando: type reconocido, params presentes y finitos, congelamiento.
    - Si encuentra inconsistencia → `InvalidPathError`.
    - NO corrige, NO elimina, NO añade comandos.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si alguna inconsistencia.
- **Complejidad**: O(n) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura (no muta).
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: Path válido; Path construido con comandos válidos pero corrompido manualmente (imposible por congelamiento, pero verificado); Path vacío.
- **Dependencias**: `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - Path válido → no lanza.
    - validate() no muta el Path.
    - Path vacío → no lanza.
- **Ejemplo**: `path.validate()`.
- **Notas**: Trampa 11 evitada: NO repara silenciosamente.
- **Historial**: v3.0.

---

## PATH-011 · getBounds()

- **Propósito**: Calcular AABB envolvente del Path mediante subdivisión adaptativa De Casteljau.
- **Entradas**: ninguna.
- **Salidas**: nuevo `AABB`.
- **Precondiciones**: `this` es `Path` válido.
- **Postcondiciones**: `this` no muta.
- **Algoritmo (ADR-004-D4)**:
    1. Si `this.#commands.length === 0` → devolver `AABB.empty()`.
    2. Inicializar acumulador de extremos `(minX, minY, maxX, maxY)` como `null`.
    3. Para cada comando:
        - `MOVE_TO`: agregar punto `(x, y)` al acumulador.
        - `LINE_TO`: agregar puntos `(prevX, prevY)` y `(x, y)` al acumulador. Sin recursión.
        - `QUADRATIC_TO`: elevar a CUBIC_TO internamente:
            `c1 = P0 + 2/3*(Q-P0)`, `c2 = P1 + 2/3*(Q-P1)` donde Q es el punto de control cuadrático.
            Procesar como CUBIC_TO.
        - `CUBIC_TO`: procesar con subdivisión adaptativa (paso 4).
        - `CLOSE`: no aporta puntos geométricos nuevos (el cierre es topológico, no métrico).
    4. Subdivisión adaptativa de segmento cúbico (P0, P1, P2, P3):
        a. Calcular flatness = max(distancia(P1, línea P0-P3), distancia(P2, línea P0-P3)).
        b. Si flatness <= EPSILON_MATH → agregar P0 y P3 al acumulador. Parar.
        c. Si profundidad > MAX_RECURSION_DEPTH (24) → agregar los 4 puntos del segmento al acumulador. Emitir advertencia en instrumentación (consola.warn con functionId). NO lanzar error. Parar.
        d. Dividir en t=0.5 usando De Casteljau. Recurrir en ambas mitades con profundidad+1.
    5. Si acumulador sigue siendo `null` (sólo CLOSE o vacío) → devolver `AABB.empty()`.
    6. Si acumulador tiene puntos → devolver `new AABB(minX, minY, maxX, maxY)`.
    7. Si sólo hay MOVE_TO(s) → acumulador tiene esos puntos → AABB puntual o envolvente de ellos (decisión (d)).
- **MAX_RECURSION_DEPTH**: 24 (constante interna fija).
- **Invariantes**: determinismo; misma entrada → mismo AABB exacto.
- **Errores**: ninguno (advertencia en instrumento si se alcanza profundidad máxima).
- **Complejidad**: O(k) donde k es el número de subdivisiones necesarias. En el peor caso O(2^24) pero limitado por EPSILON_MATH y curvatura realista.
- **Efectos colaterales**: ninguno observable (advertencia en consola es efecto secundario aceptable para instrumentación).
- **Idempotencia**: sí.
- **Pureza**: pura (observacionalmente).
- **Determinismo**: sí.
- **Tolerancias**: EPSILON_MATH (1e-9) para flatness.
- **Casos límite**:
    - Path vacío → AABB.empty().
    - Sólo MOVE_TO → AABB puntual (decisión (d)).
    - Segmento recto (flatness inicial 0) → sin recursión.
    - Curva alta curvatura → profundidad ≤ 24.
    - P1 fuera del rango de P0..P3 → bounds incluyen extremo real.
    - Dos llamadas consecutivas → mismo AABB exacto.
- **Dependencias**: `AABB`, `Vector2`, `EPSILON_MATH`, `CommandType`.
- **Tests obligatorios**:
    - Path vacío → AABB.empty().
    - Sólo MOVE_TO → AABB puntual.
    - LINE_TO rectos → bounds exactos.
    - QUADRATIC_TO → bounds con extremo real.
    - CUBIC_TO con P1 fuera del rango → bounds incluyen extremo real.
    - Determinismo: dos llamadas → mismo AABB.
    - Profundidad ≤ 24 (test con curva sintética extrema).
    - Flatness inicial ≤ EPSILON_MATH → sin recursión (test indirecto: segmento recto produce resultado sin advertencia).
    - Test cruzado con Etapa 4: transformar AABB resultante con rotación.
- **Ejemplo**: `path.getBounds()`.
- **Notas**: ADR-004-D4. Prohibido usar puntos de control crudos. Prohibido muestreo uniforme fijo.
- **Historial**: v3.0 + ADR-004-D4 + resolución bloqueo (d).