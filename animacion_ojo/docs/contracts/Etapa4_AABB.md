# AABB — Bloques contractuales (AABB-001 a AABB-012)

Módulo: `src/math/AABB.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/math/Matrix3x3.js`, `src/math/Epsilon.js`, `src/errors/*`
Prohibiciones: ningún `NaN`/`Infinity`/`undefined` como estado válido; comparación exacta de floats prohibida (usar `EPSILON_MATH`); **NO** aceptar epsilon por parámetro; **NO** usar typed arrays; **NO** transformar sólo dos esquinas en `transform()`.

Estado obligatorio (§10):
    minX: number finito
    minY: number finito
    maxX: number finito
    maxY: number finito
    empty: boolean

Invariantes aplicables:
- **BND-01**: si cambia geometría o transformación → boundsDirty = true (AABB no conoce SceneNode, pero su API permite detectar cambios)
- **BND-02**: nodo invisible no participa en hit-testing (AABB representa bounds vacíos sin ambigüedad)
- **INV-004**: bounds mundiales representan área renderizada cuando están limpios

---

## AABB-001 · constructor(minX, minY, maxX, maxY)

- **Propósito**: Construir un AABB con límites finitos y orden correcto.
- **Entradas**: `minX, minY, maxX, maxY: number` finitos.
- **Salidas**: instancia `AABB` con `empty = false`.
- **Precondiciones**: `minX <= maxX`, `minY <= maxY`, todos finitos.
- **Postcondiciones**: estado válido, `empty === false`.
- **Invariantes**: `minX <= maxX`, `minY <= maxY`, todos finitos.
- **Errores**: `InvalidAABBError` si algún valor no es finito o si `minX > maxX` o `minY > maxY`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `minX === maxX` (línea vertical); `minY === maxY` (línea horizontal); `minX === maxX && minY === maxY` (punto); valores extremos finitos.
- **Dependencias**: `InvalidAABBError`.
- **Tests obligatorios**: constructor válido; rechazo de NaN/Infinity; rechazo de `minX > maxX`; rechazo de `minY > maxY`; aceptación de límites iguales.
- **Ejemplo**: `new AABB(0, 0, 10, 20)`.
- **Notas**: guarda copia de los valores.
- **Historial**: v3.0.

---

## AABB-002 · empty() [estática]

- **Propósito**: Factoría que devuelve un AABB vacío identificable sin NaN.
- **Entradas**: ninguna.
- **Salidas**: nuevo `AABB` con `empty = true` y valores canónicos `minX = minY = maxX = maxY = 0`.
- **Precondiciones**: ninguna.
- **Postcondiciones**: `isEmpty() === true`.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: N/A.
- **Dependencias**: `AABB`.
- **Tests obligatorios**: devuelve AABB con `empty = true`; valores canónicos son finitos (no NaN).
- **Ejemplo**: `AABB.empty()`.
- **Notas**: NO usa NaN como marcador.
- **Historial**: v3.0.

---

## AABB-003 · fromXYWH(x, y, width, height) [estática]

- **Propósito**: Factoría que construye AABB desde posición y dimensiones.
- **Entradas**: `x, y, width, height: number` finitos.
- **Salidas**: nuevo `AABB` con `min = (x, y)`, `max = (x + width, y + height)`, `empty = false`.
- **Precondiciones**: `width >= 0`, `height >= 0`, todos finitos.
- **Postcondiciones**: `minX = x`, `minY = y`, `maxX = x + width`, `maxY = y + height`.
- **Invariantes**: preservados.
- **Errores**: `InvalidAABBError` si `width < 0` o `height < 0` o algún valor no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `width = 0` (línea vertical); `height = 0` (línea horizontal); `width = 0 && height = 0` (punto).
- **Dependencias**: `AABB`, `InvalidAABBError`.
- **Tests obligatorios**: construcción válida; rechazo de width/height negativos; rechazo de NaN/Infinity; aceptación de width/height cero.
- **Ejemplo**: `AABB.fromXYWH(10, 20, 30, 40)`.
- **Notas**: width = 0 o height = 0 son válidos (AABB degenerado, no vacío).
- **Historial**: v3.0.

---

## AABB-004 · clone()

- **Propósito**: Devolver copia independiente del AABB.
- **Entradas**: ninguna.
- **Salidas**: nuevo `AABB` con mismos valores, `!== this`.
- **Precondiciones**: `this` es `AABB` válido.
- **Postcondiciones**: mutar la copia no afecta a `this`.
- **Invariantes**: preservados en ambos objetos.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: AABB vacío; AABB degenerado; AABB con valores extremos.
- **Dependencias**: `AABB`.
- **Tests obligatorios**: igualdad de valores; independencia (mutar clon no afecta original).
- **Ejemplo**: `aabb.clone()`.
- **Notas**: los componentes son números (primitivos), por lo que la copia es profunda en la práctica.
- **Historial**: v3.0.

---

## AABB-005 · contains(point)

- **Propósito**: Verificar si un punto está dentro del AABB (bordes cerrados).
- **Entradas**: `point: Vector2`.
- **Salidas**: `boolean` — `true` si `minX - EPSILON_MATH <= point.x <= maxX + EPSILON_MATH` Y `minY - EPSILON_MATH <= point.y <= maxY + EPSILON_MATH`.
- **Precondiciones**: `point instanceof Vector2`.
- **Postcondiciones**: `this` y `point` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `point` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: `EPSILON_MATH` para comparaciones.
- **Casos límite**: punto en borde → `true`; punto interior → `true`; punto exterior → `false`; AABB vacío → `false`; AABB degenerado (width=0 o height=0) funciona con bordes cerrados.
- **Dependencias**: `Vector2`, `InvalidVectorError`, `EPSILON_MATH`.
- **Tests obligatorios**: punto interior; punto en borde; punto exterior; AABB vacío → false; AABB degenerado; argumento no-Vector2 lanza.
- **Ejemplo**: `aabb.contains(new Vector2(5, 5))`.
- **Notas**: inclusión de bordes cerrados. NO acepta epsilon por parámetro.
- **Historial**: v3.0.

---

## AABB-006 · intersects(other)

- **Propósito**: Verificar si dos AABBs se intersecan (bordes cerrados).
- **Entradas**: `other: AABB`.
- **Salidas**: `boolean` — `true` si los AABBs se solapan o tocan por borde.
- **Precondiciones**: `other instanceof AABB`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidAABBError` si `other` no es `AABB`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: `EPSILON_MATH` para comparaciones.
- **Casos límite**: AABBs solapados → `true`; AABBs tocándose por borde → `true`; AABBs disjuntos → `false`; AABB vacío → `false`.
- **Dependencias**: `AABB`, `InvalidAABBError`, `EPSILON_MATH`.
- **Tests obligatorios**: solapamiento; tocándose por borde; disjuntos; AABB vacío → false; argumento no-AABB lanza.
- **Ejemplo**: `aabb1.intersects(aabb2)`.
- **Notas**: AABBs que se tocan por borde cuentan como intersección. NO acepta epsilon por parámetro.
- **Historial**: v3.0.

---

## AABB-007 · union(other)

- **Propósito**: Devolver nuevo AABB que contiene completamente ambos.
- **Entradas**: `other: AABB`.
- **Salidas**: nuevo `AABB`.
- **Precondiciones**: `other instanceof AABB`.
- **Postcondiciones**: `this` y `other` no mutan; resultado contiene ambos.
- **Invariantes**: preservados.
- **Errores**: `InvalidAABBError` si `other` no es `AABB`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `this` vacío → devuelve copia de `other`; `other` vacío → devuelve copia de `this`; ambos vacíos → devuelve AABB vacío; AABBs solapados; AABBs disjuntos.
- **Dependencias**: `AABB`, `InvalidAABBError`.
- **Tests obligatorios**: unión válida; `this` vacío; `other` vacío; ambos vacíos; NO muta operandos; argumento no-AABB lanza.
- **Ejemplo**: `aabb1.union(aabb2)`.
- **Notas**: NO MUTA operandos.
- **Historial**: v3.0.

---

## AABB-008 · expandByPoint(point)

- **Propósito**: Expandir el AABB para incluir un punto.
- **Entradas**: `point: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `point instanceof Vector2`.
- **Postcondiciones**: 
  - Si `this.empty === true`: `minX = minY = maxX = maxY = point`, `empty = false`.
  - Si `this.empty === false`: expande `min`/`max` según corresponda.
  - `point` no muta.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `point` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this`.
- **Idempotencia**: sí (mismo punto → mismo resultado).
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: punto interior (no cambia); punto exterior (expande); punto en borde (no cambia); AABB vacío → punto se convierte en único punto.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: expande correctamente; AABB vacío → punto único; NO muta point; argumento no-Vector2 lanza; test explícito de que `this` cambió.
- **Ejemplo**: `aabb.expandByPoint(new Vector2(15, 25))`.
- **Notas**: SÍ MUTA `this`.
- **Historial**: v3.0.

---

## AABB-009 · transform(matrix)

- **Propósito**: Transformar todos los vértices del AABB y calcular nuevo AABB.
- **Entradas**: `matrix: Matrix3x3`.
- **Salidas**: nuevo `AABB`.
- **Precondiciones**: `matrix instanceof Matrix3x3`.
- **Postcondiciones**: 
  - Si `this.empty === true`: devuelve AABB vacío.
  - Si `this.empty === false`: transforma los 4 vértices `(minX,minY)`, `(maxX,minY)`, `(minX,maxY)`, `(maxX,maxY)` y calcula `min`/`max` de los resultados.
  - `this` y `matrix` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidMatrixError` si `matrix` no es `Matrix3x3`.
- **Complejidad**: O(1) tiempo (4 transformaciones + min/max), O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de `Matrix3x3.transformPoint`.
- **Casos límite**: traslación pura; escala pura; rotación π/6; rotación π/2; matriz identidad; composición translate × rotate × scale; AABB vacío; escala negativa (reflexión).
- **Dependencias**: `Matrix3x3`, `InvalidMatrixError`, `Vector2`.
- **Tests obligatorios**: transformación válida; 4 vértices transformados (test con rotación π/6 y comparación manual); AABB vacío → vacío; NO muta this ni matrix; argumento no-Matrix3x3 lanza; escala negativa produce AABB válido.
- **Ejemplo**: `aabb.transform(matrix)`.
- **Notas**: PROHIBIDO transformar sólo dos esquinas. Debe transformar los 4 vértices.
- **Historial**: v3.0.

---

## AABB-010 · isEmpty()

- **Propósito**: Consultar si el AABB está vacío.
- **Entradas**: ninguna.
- **Salidas**: `boolean`.
- **Precondiciones**: `this` es `AABB` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `empty = true`; `empty = false`.
- **Dependencias**: ninguna.
- **Tests obligatorios**: devuelve valor correcto; NO altera estado.
- **Ejemplo**: `aabb.isEmpty()`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## AABB-011 · width()

- **Propósito**: Calcular ancho del AABB.
- **Entradas**: ninguna.
- **Salidas**: `number >= 0`.
- **Precondiciones**: `this` es `AABB` válido.
- **Postcondiciones**: `this` no muta; si `empty === true` → devuelve 0.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: AABB normal; AABB degenerado (width=0); AABB vacío → 0.
- **Dependencias**: ninguna.
- **Tests obligatorios**: ancho correcto; AABB vacío → 0; nunca negativo; nunca NaN.
- **Ejemplo**: `aabb.width()`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## AABB-012 · height()

- **Propósito**: Calcular alto del AABB.
- **Entradas**: ninguna.
- **Salidas**: `number >= 0`.
- **Precondiciones**: `this` es `AABB` válido.
- **Postcondiciones**: `this` no muta; si `empty === true` → devuelve 0.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: AABB normal; AABB degenerado (height=0); AABB vacío → 0.
- **Dependencias**: ninguna.
- **Tests obligatorios**: alto correcto; AABB vacío → 0; nunca negativo; nunca NaN.
- **Ejemplo**: `aabb.height()`.
- **Notas**: N/A.
- **Historial**: v3.0.