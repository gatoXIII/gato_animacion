# Matrix3x3 — Bloques contractuales (MAT-001 a MAT-013)

Módulo: `src/math/Matrix3x3.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/errors/*`, `Math`, `Number`
Prohibiciones: ninguna mutación de operandos; ningún `NaN`/`Infinity`/`undefined` como estado válido; comparación exacta de floats prohibida (usar `equalsApprox`); orden de composición estricto `World = Parent × Local`.

Invariantes aplicables:
- **INV-002**: `worldTransform = parentWorldTransform × localTransform`
- **INV-003**: toda transformación usada para `worldToLocal` debe ser invertible

---

## MAT-001 · constructor(values?)

- **Propósito**: Construir una matriz 3×3 homogénea para transformaciones afines 2D.
- **Entradas**: `values: number[9]` (opcional). Si se omite, construye identidad.
- **Salidas**: instancia `Matrix3x3` con 9 componentes finitos.
- **Precondiciones**: si `values` se provee, debe ser array de exactamente 9 números finitos.
- **Postcondiciones**: `this.values` contiene 9 números finitos; `this.isFinite() === true`.
- **Invariantes**: todos los componentes finitos en todo instante.
- **Errores**: `InvalidMatrixError` si `values` no es array, tiene longitud ≠ 9, o contiene no-finitos.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno (crea objeto nuevo).
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: sin argumentos (identidad); 9 ceros; 9 valores negativos; 9 valores muy grandes.
- **Dependencias**: `InvalidMatrixError`.
- **Tests obligatorios**: constructor sin argumentos; constructor con 9 valores válidos; rechazo de 8 valores; rechazo de 10 valores; rechazo de NaN; rechazo de Infinity; rechazo de string; rechazo de null.
- **Ejemplo**: `new Matrix3x3([1,0,0, 0,1,0, 0,0,1])` o `new Matrix3x3()`.
- **Notas**: `scale(0, 0)` es válido en construcción. La no-invertibilidad se decide en `invert()`.
- **Historial**: v3.0.

---

## MAT-002 · identity() [estática]

- **Propósito**: Factoría que devuelve matriz identidad.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Matrix3x3` con valores `[1,0,0, 0,1,0, 0,0,1]`.
- **Precondiciones**: ninguna.
- **Postcondiciones**: `M × identity() === M` para toda `M`.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: N/A.
- **Dependencias**: `Matrix3x3`.
- **Tests obligatorios**: devuelve matriz con valores de identidad; `M × identity() ≈ M`.
- **Ejemplo**: `Matrix3x3.identity()`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## MAT-003 · translation(tx, ty) [estática]

- **Propósito**: Factoría que devuelve matriz de traslación pura.
- **Entradas**: `tx: number` finito, `ty: number` finito.
- **Salidas**: nuevo `Matrix3x3` con valores `[1,0,tx, 0,1,ty, 0,0,1]`.
- **Precondiciones**: `Number.isFinite(tx) && Number.isFinite(ty)`.
- **Postcondiciones**: `transformPoint(p)` desplaza `p` por `(tx, ty)`; `transformVector(v)` NO afecta a `v`.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `tx` o `ty` no son finitos.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `tx = 0, ty = 0`; valores negativos; valores muy grandes.
- **Dependencias**: `Matrix3x3`, `InvalidNumericInputError`.
- **Tests obligatorios**: traslación válida; `transformPoint` aplica traslación; `transformVector` NO aplica traslación; rechazo de NaN/Infinity.
- **Ejemplo**: `Matrix3x3.translation(10, 20)`.
- **Notas**: NO rota, NO escala.
- **Historial**: v3.0.

---

## MAT-004 · rotation(angleRad) [estática]

- **Propósito**: Factoría que devuelve matriz de rotación pura.
- **Entradas**: `angleRad: number` finito (radianes).
- **Salidas**: nuevo `Matrix3x3` con valores `[cos, -sin, 0, sin, cos, 0, 0, 0, 1]`.
- **Precondiciones**: `Number.isFinite(angleRad)`.
- **Postcondiciones**: `transformPoint(p)` rota `p` alrededor del origen; `transformVector(v)` rota `v`; determinante = 1.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `angleRad` no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de `Math.cos` y `Math.sin`.
- **Casos límite**: `angleRad = 0`; `angleRad = π/2`; `angleRad = π`; `angleRad = 2π`; ángulos negativos.
- **Dependencias**: `Matrix3x3`, `InvalidNumericInputError`, `Math`.
- **Tests obligatorios**: rotación en 0, π/2, π, 2π; ángulos negativos; `transformPoint` rota; `transformVector` rota; determinante ≈ 1; rechazo de NaN/Infinity.
- **Ejemplo**: `Matrix3x3.rotation(Math.PI / 2)`.
- **Notas**: NO traslada, NO escala.
- **Historial**: v3.0.

---

## MAT-005 · scale(sx, sy) [estática]

- **Propósito**: Factoría que devuelve matriz de escala pura.
- **Entradas**: `sx: number` finito, `sy: number` finito.
- **Salidas**: nuevo `Matrix3x3` con valores `[sx,0,0, 0,sy,0, 0,0,1]`.
- **Precondiciones**: `Number.isFinite(sx) && Number.isFinite(sy)`.
- **Postcondiciones**: `transformPoint(p)` escala `p`; `transformVector(v)` escala `v`; determinante = `sx × sy`.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `sx` o `sy` no son finitos.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: `sx = 0, sy = 0`; `sx = 1, sy = 1`; escalas negativas (reflexión); escalas muy grandes.
- **Dependencias**: `Matrix3x3`, `InvalidNumericInputError`.
- **Tests obligatorios**: escala válida; `scale(0, 0)` construye pero `invert()` lanza; escalas negativas; determinante = `sx × sy`; rechazo de NaN/Infinity.
- **Ejemplo**: `Matrix3x3.scale(2, 3)`.
- **Notas**: NO traslada, NO rota. `scale(0, 0)` es válido en construcción.
- **Historial**: v3.0.

---

## MAT-006 · multiply(other)

- **Propósito**: Composición de transformaciones: `this × other`.
- **Entradas**: `other: Matrix3x3`.
- **Salidas**: nuevo `Matrix3x3` resultado de la multiplicación matricial.
- **Precondiciones**: `other instanceof Matrix3x3`.
- **Postcondiciones**: `this` y `other` no mutan; resultado es `this × other` en ese orden.
- **Invariantes**: preservados.
- **Errores**: `InvalidMatrixError` si `other` no es `Matrix3x3`.
- **Complejidad**: O(1) tiempo (27 multiplicaciones + 18 sumas), O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: multiplicar por identidad; multiplicar por inversa; asociatividad.
- **Dependencias**: `Matrix3x3`, `InvalidMatrixError`.
- **Tests obligatorios**: `M × I ≈ M`; `M × inverse(M) ≈ I`; asociatividad `(A × B) × C ≈ A × (B × C)`; composición `(Parent × Local).transformPoint(p) ≈ Parent.transformPoint(Local.transformPoint(p))`; argumento no-Matrix3x3 lanza; `this` no muta; `other` no muta.
- **Ejemplo**: `M1.multiply(M2)`.
- **Notas**: Orden estricto: `World = Parent × Local`. NO conmutativo.
- **Historial**: v3.0.

---

## MAT-007 · determinant()

- **Propósito**: Calcular determinante de la matriz 3×3.
- **Entradas**: ninguna.
- **Salidas**: `number` = determinante.
- **Precondiciones**: `this` es `Matrix3x3` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: precisión de aritmética de punto flotante.
- **Casos límite**: identidad → 1; traslación → 1; rotación → 1; escala → `sx × sy`; escala(0, 0) → 0; escalas negativas → negativo.
- **Dependencias**: ninguna.
- **Tests obligatorios**: determinante de identidad = 1; determinante de traslación = 1; determinante de rotación ≈ 1; determinante de escala = `sx × sy`; determinante de escala(0, 0) = 0.
- **Ejemplo**: `M.determinant()`.
- **Notas**: N/A.
- **Historial**: v3.0.

---

## MAT-008 · invert()

- **Propósito**: Calcular matriz inversa.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Matrix3x3` tal que `this × inverse ≈ I`.
- **Precondiciones**: `|this.determinant()| > epsilon` (epsilon por defecto `1e-10`).
- **Postcondiciones**: `this` no muta; `this.multiply(inverse).equalsApprox(identity)`.
- **Invariantes**: preservados en `this`.
- **Errores**: `NonInvertibleMatrixError` si `|determinant| <= epsilon`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: epsilon define umbral de invertibilidad.
- **Casos límite**: `scale(0, 0)` lanza; `scale(0, 2)` lanza; `rotation(θ)` devuelve `rotation(-θ)`; `inverse(inverse(M)) ≈ M`.
- **Dependencias**: `Matrix3x3`, `NonInvertibleMatrixError`.
- **Tests obligatorios**: inversa de identidad = identidad; inversa de traslación = traslación opuesta; inversa de rotación = rotación opuesta; inversa de escala = escala recíproca; `scale(0, 0)` lanza `NonInvertibleMatrixError`; `scale(0, 2)` lanza; `M × inverse(M) ≈ I`; `inverse(inverse(M)) ≈ M`; error incluye contexto.
- **Ejemplo**: `M.invert()`.
- **Notas**: NO muta original. Lanza error si no es invertible.
- **Historial**: v3.0.

---

## MAT-009 · transformPoint(point)

- **Propósito**: Aplicar transformación afín a un punto (w=1).
- **Entradas**: `point: Vector2`.
- **Salidas**: nuevo `Vector2` con coordenadas transformadas.
- **Precondiciones**: `point instanceof Vector2`.
- **Postcondiciones**: `this` y `point` no mutan; traslación SÍ afecta al resultado.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `point` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: punto en origen; punto con valores negativos; transformación identidad; traslación pura; rotación pura; escala pura; composición.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: transformación válida; traslación aplica; rotación aplica; escala aplica; composición `(Parent × Local).transformPoint(p) ≈ Parent.transformPoint(Local.transformPoint(p))`; argumento no-Vector2 lanza; `this` no muta; `point` no muta.
- **Ejemplo**: `M.transformPoint(p)`.
- **Notas**: w=1, por lo que la traslación se aplica.
- **Historial**: v3.0.

---

## MAT-010 · transformVector(vector)

- **Propósito**: Aplicar transformación afín a un vector (w=0).
- **Entradas**: `vector: Vector2`.
- **Salidas**: nuevo `Vector2` con componentes transformados.
- **Precondiciones**: `vector instanceof Vector2`.
- **Postcondiciones**: `this` y `vector` no mutan; traslación NO afecta al resultado.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `vector` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: vector en origen; vector con valores negativos; transformación identidad; traslación pura (NO debe afectar); rotación pura; escala pura.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: transformación válida; traslación NO aplica (diferencia clave con `transformPoint`); rotación aplica; escala aplica; argumento no-Vector2 lanza; `this` no muta; `vector` no muta.
- **Ejemplo**: `M.transformVector(v)`.
- **Notas**: w=0, por lo que la traslación NO se aplica.
- **Historial**: v3.0.

---

## MAT-011 · clone()

- **Propósito**: Devolver copia independiente de la matriz.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Matrix3x3` con mismos valores, `!== this`.
- **Precondiciones**: `this` es `Matrix3x3` válido.
- **Postcondiciones**: mutar la copia no afecta a `this`.
- **Invariantes**: preservados en ambos objetos.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: matriz identidad; matriz con valores muy grandes; matriz con valores negativos.
- **Dependencias**: `Matrix3x3`.
- **Tests obligatorios**: igualdad de valores; independencia (mutar clon no afecta original).
- **Ejemplo**: `M.clone()`.
- **Notas**: los componentes son números (primitivos), por lo que la copia es profunda en la práctica.
- **Historial**: v3.0.

---

## MAT-012 · equalsApprox(other, epsilon = 1e-6)

- **Propósito**: Comparación aproximada elemento a elemento.
- **Entradas**: `other: Matrix3x3`, `epsilon: number > 0` (default `1e-6`).
- **Salidas**: `boolean` — `true` si `|this.values[i] - other.values[i]| <= epsilon` para todo `i`.
- **Precondiciones**: `other instanceof Matrix3x3`; `Number.isFinite(epsilon) && epsilon > 0`.
- **Postcondiciones**: `this` y `other` no mutan.
- **Invariantes**: preservados.
- **Errores**: `InvalidMatrixError` si `other` no es `Matrix3x3`; `InvalidNumericInputError` si `epsilon <= 0` o no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: `epsilon` define la tolerancia.
- **Casos límite**: matrices idénticas; matrices dentro de epsilon; matrices fuera de epsilon; epsilon muy pequeño; epsilon muy grande.
- **Dependencias**: `Matrix3x3`, `InvalidMatrixError`, `InvalidNumericInputError`.
- **Tests obligatorios**: comparación válida; `epsilon <= 0` lanza; `epsilon = NaN` lanza; argumento no-Matrix3x3 lanza.
- **Ejemplo**: `M1.equalsApprox(M2, 1e-6)`.
- **Notas**: NO usar `===` para floats.
- **Historial**: v3.0.

---

## MAT-013 · isFinite()

- **Propósito**: Verificar que todos los componentes son finitos.
- **Entradas**: ninguna.
- **Salidas**: `boolean` — `true` si todos los 9 componentes son finitos.
- **Precondiciones**: `this` es `Matrix3x3`.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno (NO lanza).
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: matriz con todos finitos; matriz con un NaN; matriz con un Infinity.
- **Dependencias**: `Number`.
- **Tests obligatorios**: finito → `true`; NaN → `false`; Infinity → `false`.
- **Ejemplo**: `M.isFinite()`.
- **Notas**: NO lanza. Devuelve `boolean`.
- **Historial**: v3.0.