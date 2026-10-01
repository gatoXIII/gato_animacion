# BezierPath — Bloques contractuales (BEZ-001 a BEZ-006)

Módulo: `src/geometry/BezierPath.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/math/Epsilon.js`,
                         `src/errors/*`, `src/geometry/Path.js`,
                         `src/geometry/CommandType.js`
Prohibiciones absolutas:
- BezierPath NO extiende Path (ADR-004-D3).
- BezierPath NO tiene moveTo/lineTo/quadraticTo/cubicTo/close (ADR-004-D3).
- BezierPath NO acepta comandos directamente (ADR-004-D3).
- Ningún método muta el BezierPath original ni el Path origen.
- PROHIBIDO reutilizar errores de `math/` en `geometry/` (ADR-004-D6).
- PROHIBIDO inventar errores no listados (ADR-004-D6).
- Cero import de `scenegraph/`, `animation/`, `domain/`, `renderer/`, `engine/`, DOM.
- Cero uso de `Date.now()`, `performance.now()`, `new Date()`.
- Cero uso de typed arrays.

Decisiones vinculantes aplicadas (resolución de bloqueos):
- (a) segmentIndex fuera de rango → `InvalidPathError`.
- (b) t fuera de [0,1] → `InvalidPathError`.
- (c) tangente cero → `Vector2(0, 0)`. Consumidor responsable.
- (d) subdivisión: mayor longitud euclidiana P0→P3, desempate índice ascendente.
- (e) fusión: menor longitud combinada, promedio de puntos de control internos.
- (g) fromCommands nunca lanza PathCompatibilityError; Path ya valida.
- (h) split: bp1 = 0..i-1 + mitad1 del i; bp2 = mitad2 + i+1..N-1.
- (i) CLOSE se almacena como metadato de subpath (booleano closed).
- (j) BezierPath vacío es válido; segmentCount() === 0.
- (k) getPointAt sobre vacío → InvalidPathError.
- (l) subdividir 1 segmento: De Casteljau recursivo t=0.5 + regla (d).

Invariantes aplicables:
- GEO-01 (§8): modificar geometría invalida bounds.
- GEO-02 (§8): geometría no conoce SceneNode, Renderer, etc.
- ANIM-03 (§15): paths interpolables deben tener estructura compatible.

Referencias ADR-004:
- D3: representación independiente (NO extiende Path).
- D4: MAX_RECURSION_DEPTH = 24 (vía L-BEZ-01).
- D6: errores cerrados.

Referencias L-BEZ:
- L-BEZ-01: MAX_RECURSION_DEPTH = 24.
- L-BEZ-02: targetCount exacto en normalizeSegments.

Representación interna:
- `#segments`: Array de segmentos cúbicos congelados `{ p0, p1, p2, p3 }` (Vector2).
- `#subpaths`: Array de subpaths `{ closed, startSegmentIndex, segmentCount }`.
- Todos los segmentos están congelados.

Conversión de comandos (interna, no expuesta):
- MOVE_TO: inicia nuevo subpath. No es segmento.
- LINE_TO: se eleva a CUBIC_TO degenerado (P1 y P2 colineales).
  - P1 = P0 + (P3 - P0) / 3
  - P2 = P0 + 2·(P3 - P0) / 3
- QUADRATIC_TO: se eleva a CUBIC_TO.
  - P1 = P0 + 2/3·(Q - P0)
  - P2 = P3 + 2/3·(Q - P3)
- CUBIC_TO: directo.
- CLOSE: marca subpath como cerrado. No es segmento.

---

## BEZ-001 · constructor(path)

- **Propósito**: Construir un BezierPath desde un Path válido.
- **Entradas**: `path: Path`.
- **Salidas**: instancia `BezierPath` independiente.
- **Precondiciones**: `path instanceof Path`.
- **Postcondiciones**:
    - `path` no se modifica.
    - `this.#segments` contiene segmentos cúbicos normalizados.
    - `this.#subpaths` contiene metadatos de subpaths.
    - `this instanceof Path === false` (ADR-004-D3).
    - `this.moveTo === undefined` (ADR-004-D3).
- **Invariantes**: segmentos congelados; subpaths coherentes.
- **Errores**: `InvalidPathError` si `path` no es `Path`.
- **Complejidad**: O(n) tiempo, O(n) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: Path vacío → BezierPath vacío (decisión j); Path con sólo MOVE_TO → sin segmentos; Path con CLOSE → subpath cerrado (decisión i).
- **Dependencias**: `Path`, `Vector2`, `CommandType`, `InvalidPathError`.
- **Tests obligatorios**:
    - Path vacío → BezierPath vacío.
    - Path con MOVE_TO → sin segmentos.
    - Path con LINE_TO → 1 segmento cúbico degenerado.
    - Path con QUADRATIC_TO → 1 segmento cúbico elevado.
    - Path con CUBIC_TO → 1 segmento cúbico.
    - Path con múltiples segmentos → N segmentos.
    - Path origen no se modifica.
    - BezierPath NO es instancia de Path.
    - BezierPath NO tiene moveTo/lineTo/quadraticTo/cubicTo/close.
- **Ejemplo**: `new BezierPath(path)`.
- **Notas**: ADR-004-D3.
- **Historial**: v3.0 + ADR-004-D3 + resolución bloqueo (i)(j).

---

## BEZ-002 · fromCommands(commands) [estática]

- **Propósito**: Factoría que construye BezierPath desde array de comandos.
- **Entradas**: `commands: Array<Object>`.
- **Salidas**: nuevo `BezierPath`.
- **Precondiciones**: `commands` es array de comandos válidos para `Path`.
- **Postcondiciones**:
    - `commands` no se modifica.
    - Construye `Path` interno, luego `BezierPath`.
    - Nunca lanza `PathCompatibilityError` (decisión g); si hay comandos inválidos, el `Path` interno lanza `InvalidPathError`.
- **Invariantes**: preservados.
- **Errores**: propagados desde `Path` (`InvalidPathError`).
- **Complejidad**: O(n) tiempo, O(n) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: array vacío → BezierPath vacío.
- **Dependencias**: `Path`, `BezierPath`.
- **Tests obligatorios**:
    - Comandos válidos → BezierPath.
    - Array vacío → BezierPath vacío.
    - NO muta el array.
    - Comandos inválidos → propagación de error desde Path.
- **Ejemplo**: `BezierPath.fromCommands([cmd1, cmd2])`.
- **Notas**: Decisión (g).
- **Historial**: v3.0 + resolución bloqueo (g).

---

## BEZ-003 · getPointAt(segmentIndex, t)

- **Propósito**: Evaluar punto en un segmento cúbico en parámetro t.
- **Entradas**: `segmentIndex: number`, `t: number`.
- **Salidas**: nuevo `Vector2`.
- **Precondiciones**:
    - `0 <= segmentIndex < this.#segments.length`.
    - `0 <= t <= 1`.
- **Postcondiciones**: `this` no muta.
- **Fórmula**: `B(t) = (1-t)³·P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³·P3`.
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidPathError` si `segmentIndex` fuera de rango (decisión a).
    - `InvalidPathError` si `t` fuera de [0,1] (decisión b).
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de aritmética de punto flotante.
- **Casos límite**: t=0 → P0; t=1 → P3; t=0.5 → De Casteljau; BezierPath vacío → error.
- **Dependencias**: `Vector2`, `InvalidPathError`.
- **Tests obligatorios**:
    - getPointAt(0, 0) === P0.
    - getPointAt(0, 1) === P3.
    - getPointAt(0, 0.5) coincide con De Casteljau.
    - segmentIndex fuera de rango → error.
    - t < 0 o t > 1 → error.
    - NO muta geometría.
- **Ejemplo**: `bp.getPointAt(0, 0.5)`.
- **Notas**: Decisiones (a)(b)(k).
- **Historial**: v3.0 + resolución bloqueos (a)(b)(k).

---

## BEZ-004 · getTangentAt(segmentIndex, t)

- **Propósito**: Evaluar tangente (derivada) en un segmento cúbico en parámetro t.
- **Entradas**: `segmentIndex: number`, `t: number`.
- **Salidas**: nuevo `Vector2`.
- **Precondiciones**: mismas que `getPointAt`.
- **Postcondiciones**: `this` no muta.
- **Fórmula**: `B'(t) = 3(1-t)²·(P1-P0) + 6(1-t)t·(P2-P1) + 3t²·(P3-P2)`.
- **Política de tangente cero**: si B'(t) = (0,0), devuelve `Vector2(0, 0)` (decisión c). Consumidor responsable de manejar el caso.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si precondiciones violadas.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de aritmética.
- **Casos límite**: t=0 → 3·(P1-P0); t=1 → 3·(P3-P2); punto estacionario → Vector2(0,0).
- **Dependencias**: `Vector2`, `InvalidPathError`.
- **Tests obligatorios**:
    - getTangentAt(0, 0) ≈ 3·(P1-P0).
    - getTangentAt(0, 1) ≈ 3·(P3-P2).
    - Tangente cero → Vector2(0,0).
    - Argumentos inválidos → error.
- **Ejemplo**: `bp.getTangentAt(0, 0.5)`.
- **Notas**: Decisión (c).
- **Historial**: v3.0 + resolución bloqueo (c).

---

## BEZ-005 · split(segmentIndex, t)

- **Propósito**: Subdividir un segmento en dos usando De Casteljau.
- **Entradas**: `segmentIndex: number`, `t: number`.
- **Salidas**: `[BezierPath, BezierPath]` — dos nuevos BezierPath.
- **Precondiciones**: mismas que `getPointAt`.
- **Postcondiciones**:
    - `this` no muta.
    - `bp1` tiene segmentos `0..segmentIndex-1` más la primera mitad del segmento `segmentIndex`.
    - `bp2` tiene la segunda mitad del segmento `segmentIndex` más segmentos `segmentIndex+1..N-1`.
    - `bp1.segmentCount() + bp2.segmentCount() === this.segmentCount() + 1`.
    - La unión geométrica de `bp1` y `bp2` es equivalente al original dentro de tolerancia.
    - Si el subpath original estaba cerrado y se divide en medio, el cierre se pierde en ambos resultantes.
- **Invariantes**: preservados.
- **Errores**: `InvalidPathError` si precondiciones violadas.
- **Complejidad**: O(n) tiempo, O(n) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de De Casteljau.
- **Casos límite**: t=0 → bp1 vacío en ese segmento, bp2 = original; t=1 → bp1 = original, bp2 vacío en ese segmento.
- **Dependencias**: `BezierPath`, `Vector2`, `InvalidPathError`.
- **Tests obligatorios**:
    - split(0, 0.5) devuelve dos BezierPath.
    - Los dos nuevos NO son el original.
    - El original NO se modifica.
    - La unión es geométricamente equivalente.
    - Argumentos inválidos → error.
- **Ejemplo**: `bp.split(0, 0.5)`.
- **Notas**: Decisión (h).
- **Historial**: v3.0 + resolución bloqueo (h).

---

## BEZ-006 · normalizeSegments(targetCount)

- **Propósito**: Devolver nuevo BezierPath con exactamente `targetCount` segmentos.
- **Entradas**: `targetCount: number`.
- **Salidas**: nuevo `BezierPath`.
- **Precondiciones**:
    - `Number.isInteger(targetCount) && targetCount > 0`.
    - `this.segmentCount() > 0`.
- **Postcondiciones**:
    - `this` no muta.
    - Resultado tiene exactamente `targetCount` segmentos.
    - Si `targetCount === this.segmentCount()`: nuevo objeto idéntico.
    - Si `targetCount > this.segmentCount()`: subdividir los más largos (regla d).
    - Si `targetCount < this.segmentCount()`: fusionar los más pequeños (regla e).
    - Preserva geometría dentro de tolerancia.
    - No elimina rasgos por simplificación no documentada.
- **Regla de subdivisión (d)**: elegir segmento con mayor longitud euclidiana P0→P3; desempate por índice ascendente; subdividir en t=0.5.
- **Regla de fusión (e)**: elegir par adyacente en el mismo subpath con menor longitud combinada; desempate por índice ascendente; aproximar con promedio de puntos de control internos.
  - Fórmula de fusión: dados (A0, A1, A2, A3) y (B0, B1, B2, B3) con A3 = B0:
    - Nuevo P0 = A0
    - Nuevo P3 = B3
    - Nuevo P1 = (A1 + A2 + B1) / 3
    - Nuevo P2 = (A2 + B1 + B2) / 3
- **Invariantes**: preservados.
- **Errores**:
    - `NormalizationError` si `targetCount` no es entero positivo.
    - `NormalizationError` si `this.segmentCount() === 0`.
    - `NormalizationError` si no se puede alcanzar `targetCount` (todos los subpaths tienen 1 segmento y targetCount < segmentCount).
- **Complejidad**: O(n·k) donde k = |targetCount - segmentCount|.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de De Casteljau y aproximación de fusión.
- **Casos límite**:
    - targetCount === segmentCount → nuevo objeto idéntico.
    - segmentCount === 1 y targetCount > 1 → subdividir recursivamente (regla l).
    - targetCount inválido → NormalizationError.
    - segmentCount === 0 → NormalizationError.
- **Dependencias**: `BezierPath`, `Vector2`, `NormalizationError`.
- **Tests obligatorios**:
    - 8 segmentos → 10: resultado tiene 10 segmentos.
    - 12 segmentos → 10: resultado tiene 10 segmentos.
    - Ambos NO son los originales.
    - Los originales NO se modifican.
    - targetCount === segmentCount → nuevo objeto idéntico.
    - targetCount inválido → NormalizationError.
    - segmentCount === 0 → NormalizationError.
    - Determinismo: dos llamadas → mismo resultado.
- **Ejemplo**: `bp.normalizeSegments(10)`.
- **Notas**: L-BEZ-02, decisiones (d)(e)(l).
- **Historial**: v3.0 + L-BEZ-01 + L-BEZ-02 + resolución bloqueos (d)(e)(l).