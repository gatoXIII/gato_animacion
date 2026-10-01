# Circle — Bloques contractuales (CIR-001 a CIR-008)

Módulo: `src/geometry/Circle.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/math/AABB.js`,
                         `src/math/Epsilon.js`,
                         `src/errors/InvalidGeometryError.js`
Prohibiciones absolutas:
- Ningún `NaN`/`Infinity`/`undefined` como estado válido.
- Comparación exacta de floats prohibida en `contains`; usar
  `EPSILON_MATH` (ADR-003-D1).
- NO aceptar epsilon por parámetro en `contains` (ADR-003-D1).
- NO definir epsilon local.
- PROHIBIDO reutilizar errores de `math/` en `geometry/` (ADR-004-D6).
- PROHIBIDO inventar errores no listados (ADR-004-D6).
- PROHIBIDO devolver referencia mutable interna desde `getCenter()`.
- Cero import de `geometry/Path.js`, `geometry/BezierPath.js`,
  `geometry/CommandType.js`.
- Cero import de `scenegraph/`, `animation/`, `domain/`, `renderer/`,
  `engine/`, DOM.
- Cero uso de `Date.now()`, `performance.now()`, `new Date()`.
- Cero uso de typed arrays.

Estado obligatorio (§13):
    center: Vector2 (interno, copiado)
    radius: number (primitivo, finito, >= 0)

Invariantes aplicables:
- GEO-01 (§8): modificar geometría invalida bounds. Circle es
  inmutable semánticamente por contrato; los setters mutan y el
  consumidor notifica.
- GEO-02 (§8): la geometría no conoce SceneNode, Renderer, Canvas,
  WebGL, FSM.
- INV-004 (§56): bounds representan el área correspondiente al
  estado actual.

Referencias ADR-004:
- D6: error cerrado `InvalidGeometryError`.

Referencias ADR-003:
- D1: `EPSILON_MATH = 1e-9` para comparaciones en `contains`.

Extensiones fuera de §13 (registradas en ADR-005):
- CIR-006 `getCenter()`, CIR-007 `getRadius()`, CIR-008 `clone()`.

---

## CIR-001 · constructor(center, radius)

- **Propósito**: Construir un Circle con centro y radio válidos.
- **Entradas**: `center: Vector2`, `radius: number`.
- **Salidas**: instancia `Circle` con estado inicial válido.
- **Precondiciones**:
    - `center instanceof Vector2`.
    - `Number.isFinite(radius) && radius >= 0`.
- **Postcondiciones**:
    - `this.center` es COPIA del argumento (no referencia).
    - `this.radius` es el valor provisto.
    - `this.isFinite() === true` (centro finito, radio finito).
- **Invariantes**: centro finito, radio finito y no negativo en todo
  instante.
- **Errores**:
    - `InvalidGeometryError` si `center` no es `Vector2`.
    - `InvalidGeometryError` si `radius` no es finito.
    - `InvalidGeometryError` si `radius < 0`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno (crea objeto nuevo).
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: radio 0 (círculo puntual); radio muy grande;
  centro en coordenadas extremas finitas; centro negativo.
- **Dependencias**: `Vector2`, `InvalidGeometryError`.
- **Tests obligatorios**:
    - Constructor válido → estado correcto.
    - Radio 0 → válido.
    - Copia del centro: mutar Vector2 original no afecta.
    - Radio negativo → InvalidGeometryError.
    - Radio NaN → InvalidGeometryError.
    - Radio Infinity → InvalidGeometryError.
    - Centro no-Vector2 → InvalidGeometryError.
    - Centro null → InvalidGeometryError.
- **Ejemplo**: `new Circle(new Vector2(10, 20), 5)`.
- **Notas**: guarda COPIA del centro.
- **Historial**: v3.0.

---

## CIR-002 · setCenter(center)

- **Propósito**: Reemplazar el centro del Circle.
- **Entradas**: `center: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `center instanceof Vector2`.
- **Postcondiciones**:
    - `this.center` es COPIA del argumento.
    - `this.radius` NO cambia.
- **Invariantes**: preservados.
- **Errores**: `InvalidGeometryError` si `center` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.center`.
- **Idempotencia**: sí.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: centro cero; centro extremo; centro negativo.
- **Dependencias**: `Vector2`, `InvalidGeometryError`.
- **Tests obligatorios**:
    - setCenter actualiza centro.
    - Copia: mutar Vector2 original no afecta.
    - No altera radio.
    - Centro inválido → InvalidGeometryError.
- **Ejemplo**: `circle.setCenter(new Vector2(50, 60))`.
- **Notas**: guarda COPIA, no referencia.
- **Historial**: v3.0.

---

## CIR-003 · setRadius(radius)

- **Propósito**: Reemplazar el radio del Circle.
- **Entradas**: `radius: number`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `Number.isFinite(radius) && radius >= 0`.
- **Postcondiciones**:
    - `this.radius` es el valor provisto.
    - `this.center` NO cambia.
- **Invariantes**: preservados.
- **Errores**:
    - `InvalidGeometryError` si `radius` no es finito.
    - `InvalidGeometryError` si `radius < 0`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.radius`.
- **Idempotencia**: sí.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: radio 0; radio muy grande.
- **Dependencias**: `InvalidGeometryError`.
- **Tests obligatorios**:
    - setRadius actualiza radio.
    - No altera centro.
    - Radio 0 → válido.
    - Radio negativo → InvalidGeometryError.
    - Radio NaN → InvalidGeometryError.
    - Radio Infinity → InvalidGeometryError.
- **Ejemplo**: `circle.setRadius(10)`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## CIR-004 · getBounds()

- **Propósito**: Devolver AABB exacto del círculo.
- **Entradas**: ninguna.
- **Salidas**: nuevo `AABB` con
  `min = (cx - r, cy - r)`, `max = (cx + r, cy + r)`.
- **Precondiciones**: `this` es `Circle` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A (AABB exacto).
- **Casos límite**: radio 0 → AABB puntual; radio grande; centro
  negativo.
- **Dependencias**: `AABB`.
- **Tests obligatorios**:
    - Círculo (10, 20), r=5 → AABB (5, 15) a (15, 25).
    - Círculo (0, 0), r=0 → AABB puntual en (0, 0).
    - Círculo (-10, -20), r=3 → AABB (-13, -23) a (-7, -17).
    - getBounds no muta el Circle.
- **Ejemplo**: `circle.getBounds()`.
- **Notas**: AABB exacto. No aproximado.
- **Historial**: v3.0.

---

## CIR-005 · contains(point)

- **Propósito**: Verificar si un punto está dentro del círculo
  (inclusión cerrada con tolerancia EPSILON_MATH).
- **Entradas**: `point: Vector2`.
- **Salidas**: `boolean`.
- **Precondiciones**: `point instanceof Vector2`.
- **Postcondiciones**: `this` y `point` no mutan.
- **Regla**: distancia al centro <= radius cuenta como hit.
  Con tolerancia:
    - Si `distSq <= radius * radius` → `true` (claramente dentro).
    - Si `distSq > (radius + EPSILON_MATH)^2` → `false` (claramente
      fuera).
    - Si está en la banda de tolerancia → usar `Math.sqrt(distSq)`
      y comparar con `radius + EPSILON_MATH`.
- **Invariantes**: preservados.
- **Errores**: `InvalidGeometryError` si `point` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: `EPSILON_MATH` (ADR-003-D1). NO acepta epsilon
  por parámetro.
- **Casos límite**:
    - Punto en el centro → `true`.
    - Punto en el borde exacto → `true`.
    - Punto dentro → `true`.
    - Punto fuera → `false`.
    - Punto a distancia `r + EPSILON_MATH/2` → `true` (tolerancia).
    - Punto a distancia `r + 2 * EPSILON_MATH` → `false`.
- **Dependencias**: `Vector2`, `InvalidGeometryError`, `EPSILON_MATH`.
- **Tests obligatorios**:
    - Centro → true.
    - Borde → true.
    - Dentro → true.
    - Fuera → false.
    - Dentro de tolerancia → true.
    - Fuera de tolerancia → false.
    - contains no muta el Circle.
    - point no-Vector2 → InvalidGeometryError.
- **Ejemplo**: `circle.contains(new Vector2(12, 22))`.
- **Notas**: Inclusión cerrada. Tolerancia `EPSILON_MATH`.
- **Historial**: v3.0 + ADR-003-D1.

---

## CIR-006 · getCenter() (extensión §13, ADR-005)

- **Propósito**: Devolver copia independiente del centro actual.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Vector2` igual a `this.center`.
- **Precondiciones**: `this` es `Circle` válido.
- **Postcondiciones**: `this` no muta; mutar el resultado no afecta
  a `this.center`.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: centro cero; centro extremo.
- **Dependencias**: `Vector2`.
- **Tests obligatorios**:
    - Devuelve Vector2 con mismos valores.
    - Instancia distinta.
    - Mutar resultado no altera interno.
- **Ejemplo**: `circle.getCenter()`.
- **Notas**: PROHIBIDO devolver referencia mutable interna.
- **Historial**: v3.0 + ADR-005 (extensión §13).

---

## CIR-007 · getRadius() (extensión §13, ADR-005)

- **Propósito**: Devolver el radio actual.
- **Entradas**: ninguna.
- **Salidas**: `number >= 0` (primitivo).
- **Precondiciones**: `this` es `Circle` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: radio 0; radio grande.
- **Dependencias**: ninguna.
- **Tests obligatorios**: devuelve valor correcto.
- **Ejemplo**: `circle.getRadius()`.
- **Notas**: primitivo, trivialmente copia.
- **Historial**: v3.0 + ADR-005 (extensión §13).

---

## CIR-008 · clone() (extensión §13, ADR-005)

- **Propósito**: Devolver copia independiente del Circle.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Circle` con mismo centro y radio.
- **Precondiciones**: `this` es `Circle` válido.
- **Postcondiciones**:
    - `clone !== this`.
    - `clone.getCenter()` es copia del centro de `this`.
    - `clone.getRadius() === this.getRadius()`.
    - Mutar el clon no afecta al original.
    - Mutar el original no afecta al clon.
- **Invariantes**: preservados en ambos.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: radio 0; radio grande.
- **Dependencias**: `Circle`, `Vector2`.
- **Tests obligatorios**:
    - clone() !== original.
    - Centro copiado.
    - setRadius sobre clon no afecta original.
    - setCenter sobre original no afecta clon.
- **Ejemplo**: `circle.clone()`.
- **Notas**: N/A.
- **Historial**: v3.0 + ADR-005 (extensión §13).