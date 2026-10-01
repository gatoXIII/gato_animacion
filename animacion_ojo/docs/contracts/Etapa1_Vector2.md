# Vector2 — Bloques contractuales (VEC-001 a VEC-011)

Módulo: `src/math/Vector2.js`
Dependencias permitidas: `src/errors/*`, `Math`, `Number`
Prohibiciones: ninguna mutación de `this` ni de argumentos; ningún `NaN`/`Infinity`/`undefined` como estado válido; comparación exacta de floats prohibida (usar `equalsApprox`).

---

## VEC-001 · constructor(x, y)

- **Propósito**: Construir un Vector2 con componentes finitos.
- **Entradas**: `x: number` finito, `y: number` finito.
- **Salidas**: instancia `Vector2` con `this.x === x` y `this.y === y`.
- **Precondiciones**: `Number.isFinite(x) && Number.isFinite(y)`.
- **Postcondiciones**: `this.x` y `this.y` son los valores provistos; `this.isFinite() === true`.
- **Invariantes**: `x`, `y` finitos en todo instante de vida del objeto.
- **Errores**: `InvalidNumericInputError` si `x` o `y` no son números finitos.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno (crea objeto nuevo).
- **Idempotencia**: sí (mismas entradas → mismo estado).
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `(0, 0)`, `(-0, -0)`, `Number.MAX_SAFE_INTEGER`, valores negativos.
- **Dependencias**: `InvalidNumericInputError`.
- **Tests obligatorios**: constructor válido; rechazo de `NaN`, `Infinity`, `-Infinity`, `undefined`, `null`, string, objeto.
- **Ejemplo**: `new Vector2(3, 4)`.
- **Notas**: `-0` se acepta (es finito).
- **Historial**: v3.0.

---

## VEC-002 · clone()

- **Propósito**: Devolver copia independiente del vector.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Vector2` con `x === this.x`, `y === this.y`, `!== this`.
- **Precondiciones**: `this` es `Vector2` válido.
- **Postcondiciones**: mutar la copia no afecta a `this`.
- **Invariantes**: preservados en ambos objetos.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: vector cero, valores muy grandes, valores muy pequeños.
- **Dependencias**: `Vector2`.
- **Tests obligatorios**: igualdad de valores; independencia (mutar clon no afecta original).
- **Ejemplo**: `v.clone()`.
- **Notas**: los componentes son números (primitivos), por lo que la copia es profunda en la práctica.
- **Historial**: v3.0.

---

## VEC-003 · add(other)

- **Propósito**: Suma vectorial inmutable.
- **Entradas**: `other: Vector2`.
- **Salidas**: nuevo `Vector2` con `(this.x + other.x, this.y + other.y)`.
- **Precondiciones**: `other instanceof Vector2`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `other` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A (suma exacta de floats).
- **Casos límite**: suma con vector cero; suma con opuestos; valores grandes.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: suma válida; argumento no-Vector2; `this` no muta; `other` no muta.
- **Ejemplo**: `v1.add(v2)`.
- **Notas**: no mutar `this` ni `other`.
- **Historial**: v3.0.

---

## VEC-004 · subtract(other)

- **Propósito**: Resta vectorial inmutable.
- **Entradas**: `other: Vector2`.
- **Salidas**: nuevo `Vector2` con `(this.x - other.x, this.y - other.y)`.
- **Precondiciones**: `other instanceof Vector2`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `other` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: resta consigo mismo → vector cero; resta con vector cero.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: resta válida; argumento no-Vector2; `this` no muta; `other` no muta.
- **Ejemplo**: `v1.subtract(v2)`.
- **Notas**: no mutar `this` ni `other`.
- **Historial**: v3.0.

---

## VEC-005 · multiplyScalar(s)

- **Propósito**: Escalado inmutable.
- **Entradas**: `s: number` finito.
- **Salidas**: nuevo `Vector2` con `(this.x * s, this.y * s)`.
- **Precondiciones**: `Number.isFinite(s)`.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `s` no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `s = 0`, `s = 1`, `s = -1`, `s` muy grande.
- **Dependencias**: `Vector2`, `InvalidNumericInputError`.
- **Tests obligatorios**: escalado válido; `NaN`/`Infinity` lanzan; `this` no muta.
- **Ejemplo**: `v.multiplyScalar(2)`.
- **Notas**: no mutar `this`.
- **Historial**: v3.0.

---

## VEC-006 · dot(other)

- **Propósito**: Producto escalar.
- **Entradas**: `other: Vector2`.
- **Salidas**: `number = this.x * other.x + this.y * other.y`.
- **Precondiciones**: `other instanceof Vector2`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `other` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: dot con vector cero; dot consigo mismo (equivale a `lengthSquared()`); vectores ortogonales → 0.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: dot válido; argumento no-Vector2.
- **Ejemplo**: `v1.dot(v2)`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## VEC-007 · length()

- **Propósito**: Magnitud euclidiana.
- **Entradas**: ninguna.
- **Salidas**: `number >= 0` igual a `sqrt(x² + y²)`.
- **Precondiciones**: `this` es `Vector2` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de `Math.hypot`.
- **Casos límite**: vector cero → 0; vector unitario → 1; valores muy grandes.
- **Dependencias**: `Math`.
- **Tests obligatorios**: `length()` de `(3, 4)` ≈ 5; `(0, 0)` → 0.
- **Ejemplo**: `v.length()`.
- **Notas**: usar `Math.hypot` para evitar overflow intermedio.
- **Historial**: v3.0.

---

## VEC-008 · lengthSquared()

- **Propósito**: Magnitud al cuadrado (evita `sqrt`).
- **Entradas**: ninguna.
- **Salidas**: `number >= 0` igual a `x² + y²`.
- **Precondiciones**: `this` es `Vector2` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: vector cero → 0; vector unitario → 1.
- **Dependencias**: ninguna.
- **Tests obligatorios**: `(3, 4)` → 25; `(0, 0)` → 0.
- **Ejemplo**: `v.lengthSquared()`.
- **Notas**: útil para comparar longitudes sin `sqrt`.
- **Historial**: v3.0.

---

## VEC-009 · normalize()

- **Propósito**: Vector unitario en la misma dirección.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Vector2` con `length() ≈ 1`.
- **Precondiciones**: `this.length() > 0`.
- **Postcondiciones**: `this` no muta; resultado apunta en la misma dirección.
- **Invariantes**: preservados en `this`.
- **Errores**: `ZeroLengthVectorError` si `length() === 0`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí (si ya es unitario, devuelve nuevo vector con mismos valores).
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de `Math.hypot` y división.
- **Casos límite**: vector unitario; vector muy pequeño pero no cero; vector muy grande.
- **Dependencias**: `Vector2`, `ZeroLengthVectorError`.
- **Tests obligatorios**: `(3, 4)` → `(0.6, 0.8)`; `(0, 0)` lanza `ZeroLengthVectorError`; `this` no muta.
- **Ejemplo**: `v.normalize()`.
- **Notas**: NO devolver `NaN`. Si longitud es 0, lanza error.
- **Historial**: v3.0.

---

## VEC-010 · equalsApprox(other, epsilon = 1e-6)

- **Propósito**: Comparación aproximada componente a componente.
- **Entradas**: `other: Vector2`, `epsilon: number > 0` (default `1e-6`).
- **Salidas**: `boolean` — `true` si `|this.x - other.x| <= epsilon` Y `|this.y - other.y| <= epsilon`.
- **Precondiciones**: `other instanceof Vector2`; `Number.isFinite(epsilon) && epsilon > 0`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `other` no es `Vector2`; `InvalidNumericInputError` si `epsilon <= 0` o no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: `epsilon` define la tolerancia.
- **Casos límite**: `epsilon` muy pequeño; `epsilon` muy grande; vectores idénticos; vectores opuestos.
- **Dependencias**: `Vector2`, `InvalidVectorError`, `InvalidNumericInputError`.
- **Tests obligatorios**: comparación válida; `epsilon <= 0` lanza; `epsilon = NaN` lanza; argumento no-Vector2 lanza.
- **Ejemplo**: `v1.equalsApprox(v2, 1e-6)`.
- **Notas**: NO usar `===` para floats.
- **Historial**: v3.0.

---

## VEC-011 · isFinite()

- **Propósito**: Verificar que ambos componentes son finitos.
- **Entradas**: ninguna.
- **Salidas**: `boolean` — `true` si `Number.isFinite(this.x) && Number.isFinite(this.y)`.
- **Precondiciones**: `this` es `Vector2`.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno (NO lanza).
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: vector con `NaN`; vector con `Infinity`; vector con valores finitos.
- **Dependencias**: `Number`.
- **Tests obligatorios**: finito → `true`; `NaN` → `false`; `Infinity` → `false`.
- **Ejemplo**: `v.isFinite()`.
- **Notas**: NO lanza. Devuelve `boolean`.
- **Historial**: v3.0.