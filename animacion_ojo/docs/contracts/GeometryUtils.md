# GeometryUtils — Bloques contractuales (GEOU-001 a GEOU-004)

Módulo: `src/geometry/GeometryUtils.js`
Dependencias permitidas:
  - `src/math/Vector2.js`
  - `src/math/Matrix3x3.js`
  - `src/math/AABB.js`
  - `src/math/Epsilon.js`
  - `src/geometry/Path.js`
  - `src/geometry/BezierPath.js`
  - `src/geometry/CommandType.js`
  - `src/errors/InvalidGeometryError.js`
  - `src/errors/InvalidPathError.js`
  - `src/errors/NormalizationError.js`
  - `src/errors/InvalidFillRuleError.js`

Prohibiciones absolutas:
- Ningún `NaN`/`Infinity`/`undefined` como estado válido.
- Comparación exacta de floats prohibida; usar `EPSILON_MATH` (ADR-003-D1).
- PROHIBIDO reutilizar errores de `math/` en `geometry/` (ADR-004-D6).
- PROHIBIDO inventar errores no listados (ADR-004-D6).
- Cero import de `scenegraph/`, `animation/`, `domain/`, `renderer/`,
  `engine/`, DOM.
- Cero uso de `Date.now()`, `performance.now()`, `new Date()`.
- Cero uso de typed arrays.

Decisiones vinculantes aplicadas (resolución de bloqueos):
- (b) `interpolatePath` con pathA o pathB de 0 segmentos → `NormalizationError`.
- (c) `pointInPath` con punto en borde de donut → dentro (inclusión
    cerrada primero, luego winding/parity).
- (d) `pointInPath` con rayo por vértice → regla de lados opuestos.
- (e) `transformGeometry` con Circle → `InvalidGeometryError`.
- (f) `transformGeometry` con BezierPath → `InvalidGeometryError`.
- (h) `pointInPath` con subpath abierto de 1 segmento → cierre
    implícito cuenta para cruces.

Invariantes aplicables:
- GEO-01 (§8): modificar geometría invalida bounds.
- GEO-02 (§8): geometría no conoce SceneNode, Renderer, etc.
- ANIM-03 (§15): paths interpolables deben tener estructura
  compatible o proceso explícito de normalización.

Referencias ADR-004:
- D1: comandos congelados.
- D4: MAX_RECURSION_DEPTH = 24 para subdivisión.
- D5: reglas de relleno "nonzero" y "evenodd".
- D6: errores cerrados.

Referencias ADR-003:
- D1: EPSILON_MATH = 1e-9.

Referencias L-GEOU:
- L-GEOU-01: `interpolatePath` acepta Path o BezierPath; devuelve
  mismo tipo que pathA.
- L-GEOU-02: normalización automática al máximo de ambos; sólo
  `NormalizationError` si falla.
- L-GEOU-03: caché de orientación en `WeakMap<Path, OrientationCache>`.

---

## GEOU-001 · computePathBounds(path)

- **Propósito**: Calcular AABB envolvente de un Path.
- **Entradas**: `path: Path`.
- **Salidas**: nuevo `AABB`.
- **Precondiciones**: `path instanceof Path`.
- **Postcondiciones**:
    - `path` no muta.
    - Resultado es idéntico a `path.getBounds()`.
- **Implementación**: delega en `path.getBounds()`. No reimplementa
  subdivisión.
- **Invariantes**: preservados.
- **Errores**: `InvalidGeometryError` si `path` no es `Path`.
- **Complejidad**: O(k) donde k es el costo de `path.getBounds()`.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: mismas que `Path.getBounds()`.
- **Casos límite**: Path vacío → AABB.empty().
- **Dependencias**: `Path`, `AABB`, `InvalidGeometryError`.
- **Tests obligatorios**:
    - Delegación en path.getBounds().
    - Path vacío → AABB.empty().
    - No muta el path.
    - Argumento no-Path → InvalidGeometryError.
- **Ejemplo**: `GeometryUtils.computePathBounds(path)`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## GEOU-002 · interpolatePath(pathA, pathB, t)

- **Propósito**: Interpolar entre dos geometrías en parámetro t.
- **Entradas**:
    - `pathA: Path | BezierPath`.
    - `pathB: Path | BezierPath`.
    - `t: number` en `[0, 1]`.
- **Salidas**: nueva geometría del mismo tipo que `pathA`.
- **Precondiciones**:
    - `pathA instanceof Path || pathA instanceof BezierPath`.
    - `pathB instanceof Path || pathB instanceof BezierPath`.
    - `Number.isFinite(t) && 0 <= t && t <= 1`.
    - `pathA.segmentCount() > 0` y `pathB.segmentCount() > 0`
      (decisión b).
- **Postcondiciones**:
    - `pathA` y `pathB` no mutan.
    - Si `pathA` y `pathB` tienen distinto `segmentCount()`, se
      normalizan automáticamente al máximo (L-GEOU-02).
    - Si `pathA` es `Path`, devuelve `Path`; si es `BezierPath`,
      devuelve `BezierPath` (L-GEOU-01).
    - `t = 0` → resultado geométricamente equivalente a `pathA`.
    - `t = 1` → resultado geométricamente equivalente a `pathB`.
- **Algoritmo**:
    1. Convertir ambos a representación interna de segmentos
       cúbicos (p0, p1, p2, p3).
    2. Si `segmentCount` difiere, normalizar ambos al máximo
       mediante `BezierPath.normalizeSegments`.
    3. Interpolar segmento por segmento:
       `Pi_result = (1-t) * Pi_A + t * Pi_B` para cada punto de
       control.
    4. Reconstruir geometría del tipo de `pathA`.
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidGeometryError` si `pathA` o `pathB` no son
      `Path`/`BezierPath`.
    - `InvalidGeometryError` si `t` fuera de `[0, 1]`.
    - `NormalizationError` si alguno tiene `segmentCount() === 0`
      (decisión b) o si la normalización falla.
    - `PathCompatibilityError` NO se lanza por discrepancia de
      `segmentCount` (L-GEOU-02).
- **Complejidad**: O(n) donde n es el número de segmentos.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de aritmética de punto flotante.
- **Casos límite**:
    - `t = 0` → `pathA`.
    - `t = 1` → `pathB`.
    - `t = 0.5` → promedio.
    - `pathA` y `pathB` con mismo `segmentCount` → sin normalización.
    - `pathA` y `pathB` con distinto `segmentCount` → normalización.
    - `pathA` es `Path`, `pathB` es `BezierPath` → devuelve `Path`.
    - `pathA` es `BezierPath`, `pathB` es `Path` → devuelve `BezierPath`.
- **Dependencias**: `Path`, `BezierPath`, `Vector2`,
  `InvalidGeometryError`, `NormalizationError`.
- **Tests obligatorios**:
    - Mismos segmentos → interpolación directa.
    - Distintos segmentos → normalización.
    - t=0 → pathA.
    - t=1 → pathB.
    - BezierPath + BezierPath → BezierPath.
    - Path + Path → Path.
    - Path + BezierPath → Path.
    - BezierPath + Path → BezierPath.
    - No muta A ni B.
    - Determinismo.
    - t=-0.1 → error.
    - t=1.1 → error.
    - Argumento no-Path/BezierPath → error.
    - pathA con 0 segmentos → NormalizationError (decisión b).
    - pathB con 0 segmentos → NormalizationError (decisión b).
- **Ejemplo**: `GeometryUtils.interpolatePath(pathA, pathB, 0.5)`.
- **Notas**: L-GEOU-01, L-GEOU-02.
- **Historial**: v3.0 + L-GEOU-01 + L-GEOU-02 + resolución bloqueo (b).

---

## GEOU-003 · pointInPath(path, point, fillRule)

- **Propósito**: Determinar si un punto está dentro de un Path.
- **Entradas**:
    - `path: Path`.
    - `point: Vector2` en espacio local del path.
    - `fillRule: string` — `"nonzero"` o `"evenodd"`.
- **Salidas**: `boolean`.
- **Precondiciones**:
    - `path instanceof Path`.
    - `point instanceof Vector2`.
    - `fillRule ∈ {"nonzero", "evenodd"}`.
- **Postcondiciones**:
    - `path` y `point` no mutan.
    - `true` si el punto está dentro del path según la regla.
    - `false` si está fuera.
- **Algoritmo**:
    1. Si `fillRule` no es `"nonzero"` ni `"evenodd"` →
       `InvalidFillRuleError`.
    2. Si `path` está vacío → `false`.
    3. **Paso de borde (decisión c)**: verificar si el punto está
       en el borde de cualquier subpath (distancia a algún
       segmento ≤ `EPSILON_MATH`). Si sí → `true`.
    4. **Paso de relleno**:
       - Lanzar rayo horizontal hacia +x desde `point`.
       - Contar cruces con los segmentos (incluyendo cierres
         implícitos de subpaths abiertos, decisión h).
       - Para `"evenodd"`: `count % 2 === 1` → `true`.
       - Para `"nonzero"`: winding number ≠ 0 → `true`.
    5. **Regla de vértices (decisión d)**: un vértice cuenta como
       cruce sólo si sus dos segmentos adyacentes están en lados
       opuestos del rayo.
    6. **Validación de orientación para "nonzero" (ADR-004-D5)**:
       - Si `path` tiene múltiples subpaths, calcular signed area
         de cada uno.
       - Si todos tienen el mismo signo → `InvalidFillRuleError`.
       - Si tienen signos opuestos → válido.
       - Cachear resultado en `WeakMap<Path, OrientationCache>`
         (L-GEOU-03).
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidGeometryError` si `path` no es `Path` o `point` no
      es `Vector2`.
    - `InvalidFillRuleError` si `fillRule` no es `"nonzero"` ni
      `"evenodd"` (incluye `undefined`, `null`, `""`, otros
      strings).
    - `InvalidFillRuleError` si "nonzero" con múltiples subpaths
      de misma orientación.
- **Complejidad**: O(n · k) donde n es número de segmentos y k es
  el factor de subdivisión.
- **Efectos colaterales**: ninguno observable (caché interna en
  WeakMap no es observable).
- **Idempotencia**: sí.
- **Pureza**: pura (observacionalmente).
- **Determinismo**: sí.
- **Tolerancias**: `EPSILON_MATH` para detección de borde y
  subdivisión.
- **Casos límite**:
    - Punto en centro → `true`.
    - Punto fuera → `false`.
    - Punto en borde → `true` (decisión c).
    - Donut con orientaciones opuestas → `true` en anillo, `false`
      en agujero.
    - Donut con mismas orientaciones + "nonzero" → error.
    - Path vacío → `false`.
    - Subpath abierto de 1 segmento → cierre implícito cuenta
      (decisión h).
- **Dependencias**: `Path`, `Vector2`, `EPSILON_MATH`,
  `InvalidGeometryError`, `InvalidFillRuleError`.
- **Tests obligatorios**:
    - Punto dentro → true (ambas reglas).
    - Punto fuera → false (ambas reglas).
    - Punto en borde → true (ambas reglas).
    - Donut orientaciones opuestas → nonzero y evenodd coinciden.
    - Donut mismas orientaciones + nonzero → InvalidFillRuleError.
    - fillRule inválido → InvalidFillRuleError.
    - Path vacío → false.
    - Determinismo.
    - Caché de orientación (segunda llamada no revalida).
    - No muta path ni point.
    - Rayo por vértice → sin doble conteo.
- **Ejemplo**: `GeometryUtils.pointInPath(path, point, "nonzero")`.
- **Notas**: ADR-004-D5, L-GEOU-03, decisiones (c)(d)(h).
- **Historial**: v3.0 + ADR-004-D5 + L-GEOU-03 + resolución
  bloqueos (c)(d)(h).

---

## GEOU-004 · transformGeometry(geometry, matrix)

- **Propósito**: Transformar una geometría por una matriz afín.
- **Entradas**:
    - `geometry: Path`.
    - `matrix: Matrix3x3`.
- **Salidas**: nueva `Path` con comandos transformados.
- **Precondiciones**:
    - `geometry instanceof Path`.
    - `matrix instanceof Matrix3x3`.
- **Postcondiciones**:
    - `geometry` y `matrix` no mutan.
    - Resultado es nueva `Path` con comandos transformados.
    - MOVE_TO, LINE_TO: transformar punto final.
    - QUADRATIC_TO: transformar punto de control y punto final.
    - CUBIC_TO: transformar los dos puntos de control y el punto
      final.
    - CLOSE: se copia sin cambios.
- **Restricciones de tipo**:
    - Si `geometry` es `Circle` → `InvalidGeometryError` (decisión e).
    - Si `geometry` es `BezierPath` → `InvalidGeometryError`
      (decisión f).
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidGeometryError` si `geometry` no es `Path`.
    - `InvalidGeometryError` si `matrix` no es `Matrix3x3`.
- **Complejidad**: O(n) donde n es número de comandos.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de `Matrix3x3.transformPoint`.
- **Casos límite**:
    - Traslación → coordenadas trasladadas.
    - Identidad → comandos equivalentes.
    - Rotación → comandos rotados.
    - Escala (0, 0) → comandos colapsan a un punto (válido,
      Trampa 10).
- **Dependencias**: `Path`, `Matrix3x3`, `Vector2`, `CommandType`,
  `InvalidGeometryError`.
- **Tests obligatorios**:
    - Traslación → coordenadas trasladadas, CLOSE sin cambios.
    - Identidad → comandos equivalentes.
    - Rotación → comandos rotados.
    - No muta path ni matrix.
    - Argumento no-Path → InvalidGeometryError.
    - Argumento no-Matrix3x3 → InvalidGeometryError.
    - Circle → InvalidGeometryError (decisión e).
    - BezierPath → InvalidGeometryError (decisión f).
    - Escala (0, 0) → válido, colapsa a un punto.
- **Ejemplo**: `GeometryUtils.transformGeometry(path, matrix)`.
- **Notas**: Decisiones (e)(f).
- **Historial**: v3.0 + resolución bloqueos (e)(f).