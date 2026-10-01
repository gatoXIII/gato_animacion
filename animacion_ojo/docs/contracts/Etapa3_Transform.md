# Transform — Bloques contractuales (TRN-001 a TRN-013)

Módulo: `src/math/Transform.js`
Dependencias permitidas: `src/math/Vector2.js`, `src/math/Matrix3x3.js`, `src/errors/*`
Prohibiciones: ninguna mutación no autorizada; ningún `NaN`/`Infinity`/`undefined` como estado válido; comparación exacta de floats prohibida; **NO** conocer SceneNode; **NO** propagar dirty hacia afuera; **NO** ser observable/event emitter.

Estado obligatorio (§9):
    position: Vector2
    rotation: number (radianes, finito)
    scale: Vector2
    matrixCache: Matrix3x3 | null
    dirty: boolean

Invariantes aplicables:
- **TRANS-01**: WorldMatrix = ParentWorldMatrix × LocalMatrix
- **TRANS-02**: worldToLocal(localToWorld(P)) ≈ P
- **TRANS-03**: matriz no invertible no se usa para hit-testing inverso
- **INV-002**: world = parentWorld × local
- **INV-005**: una mutación significativa nunca deja el estado relevante marcado como limpio

Conceptos DISJUNTOS (advertencia crítica §9.13):
- `Transform.dirty`: booleano interno privado. Significa "la caché puede estar desactualizada respecto a position/rotation/scale". No se propaga. No conoce SceneNode.
- `SceneNode.dirtyFlags`: enum público con múltiples flags. NO existe en esta etapa. Pertenece a la Etapa 6.

---

## TRN-001 · constructor(position?, rotation?, scale?)

- **Propósito**: Construir un Transform con estado afín válido.
- **Entradas**: 
  - `position: Vector2` opcional (default `(0, 0)`).
  - `rotation: number` opcional (default `0`).
  - `scale: Vector2` opcional (default `(1, 1)`).
- **Salidas**: instancia `Transform` con estado inicial y `dirty === true`.
- **Precondiciones**: si se proveen, `position` y `scale` son `Vector2` válidos; `rotation` es número finito.
- **Postcondiciones**: 
  - `this.position` es COPIA del argumento o default.
  - `this.rotation` es el valor provisto o default.
  - `this.scale` es COPIA del argumento o default.
  - `this.matrixCache === null`.
  - `this.dirty === true`.
- **Invariantes**: posición finita, rotación finita, escala finita en todo instante.
- **Errores**: `InvalidVectorError` si `position` o `scale` no son `Vector2`; `InvalidNumericInputError` si `rotation` no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura (crea objeto nuevo).
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: sin argumentos; valores extremos finitos; escala (0,0); escala negativa.
- **Dependencias**: `Vector2`, `InvalidVectorError`, `InvalidNumericInputError`.
- **Tests obligatorios**: constructor sin argumentos → defaults correctos + dirty=true; constructor con argumentos → estado exacto; defensa contra aliasing (mutar Vector2 pasado al constructor no afecta al Transform); rechazo de NaN/Infinity/null/string.
- **Ejemplo**: `new Transform()`, `new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 2))`.
- **Notas**: guarda COPIA de position y scale, no la referencia recibida.
- **Historial**: v3.0.

---

## TRN-002 · getPosition()

- **Propósito**: Devolver copia independiente de la posición actual.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Vector2` igual a `this.position`.
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: `this` no muta; mutar el resultado no afecta a `this.position`.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: posición cero; posición extrema.
- **Dependencias**: `Vector2`.
- **Tests obligatorios**: devuelve Vector2 con mismos valores; instancia distinta; mutar resultado no altera interno; NO altera dirty.
- **Ejemplo**: `t.getPosition()`.
- **Notas**: PROHIBIDO devolver referencia mutable interna.
- **Historial**: v3.0.

---

## TRN-003 · setPosition(position)

- **Propósito**: Reemplazar posición y marcar dirty SÓLO si cambió.
- **Entradas**: `position: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `position instanceof Vector2`.
- **Postcondiciones**: 
  - `this.position` es COPIA de `position`.
  - Si el nuevo valor difiere del anterior más allá de tolerancia → `dirty = true`.
  - Si es igual dentro de tolerancia → `dirty` NO cambia.
  - `rotation` y `scale` NO cambian.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `position` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.position` y condicionalmente `this.dirty`.
- **Idempotencia**: sí (mismas entradas → mismo estado).
- **Pureza**: impura (muta).
- **Determinismo**: sí.
- **Tolerancias**: comparación aproximada con epsilon por defecto `1e-6` para decidir si cambió.
- **Casos límite**: mismo valor exacto; mismo valor dentro de tolerancia; valor distinto fuera de tolerancia; valor cero; valor extremo.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: setPosition con valor distinto marca dirty; setPosition con valor igual no ensucia; setPosition no altera rotation ni scale; setPosition(null) lanza error; setPosition(NaN-vector) lanza error; mutar argumento después no afecta al Transform.
- **Ejemplo**: `t.setPosition(new Vector2(10, 20))`.
- **Notas**: guarda COPIA, no referencia.
- **Historial**: v3.0.

---

## TRN-004 · translate(delta)

- **Propósito**: Sumar delta a la posición actual.
- **Entradas**: `delta: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `delta instanceof Vector2`.
- **Postcondiciones**: 
  - `this.position = this.position + delta`.
  - `dirty = true`.
  - `rotation` y `scale` NO cambian.
  - NO crea matrices durante la operación.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `delta` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.position` y `this.dirty`.
- **Idempotencia**: no (acumulativa).
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: delta cero (marca dirty igualmente porque es operación explícita de mutación relativa); delta negativo; delta grande.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: translate suma correctamente; translate marca dirty; translate no altera rotation ni scale; translate con delta inválido lanza; translate con delta cero marca dirty (operación explícita).
- **Ejemplo**: `t.translate(new Vector2(5, 0))`.
- **Notas**: operación relativa. Siempre marca dirty porque expresa intención de cambio.
- **Historial**: v3.0.

---

## TRN-005 · getRotation()

- **Propósito**: Devolver la rotación actual.
- **Entradas**: ninguna.
- **Salidas**: `number` (primitivo).
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: rotación cero; rotación π; rotación negativa.
- **Dependencias**: ninguna.
- **Tests obligatorios**: devuelve valor correcto; NO altera dirty.
- **Ejemplo**: `t.getRotation()`.
- **Notas**: primitivo, trivialmente copia.
- **Historial**: v3.0.

---

## TRN-006 · setRotation(radians)

- **Propósito**: Reemplazar rotación y marcar dirty SÓLO si cambió.
- **Entradas**: `radians: number` finito.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `Number.isFinite(radians)`.
- **Postcondiciones**: 
  - `this.rotation = radians`.
  - Si difiere del anterior más allá de tolerancia → `dirty = true`.
  - Si es igual dentro de tolerancia → `dirty` NO cambia.
  - `position` y `scale` NO cambian.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `radians` no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.rotation` y condicionalmente `this.dirty`.
- **Idempotencia**: sí.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: comparación aproximada con epsilon por defecto `1e-6`.
- **Casos límite**: mismo valor; valor dentro de tolerancia; valor distinto; rotación cero; rotación negativa; rotación grande.
- **Dependencias**: `InvalidNumericInputError`.
- **Tests obligatorios**: setRotation con valor distinto marca dirty; setRotation con valor igual no ensucia; setRotation no altera position ni scale; setRotation(NaN) lanza; setRotation(Infinity) lanza.
- **Ejemplo**: `t.setRotation(Math.PI / 4)`.
- **Notas**: primitivo, no hay problema de aliasing.
- **Historial**: v3.0.

---

## TRN-007 · rotate(deltaRadians)

- **Propósito**: Sumar delta a la rotación actual.
- **Entradas**: `deltaRadians: number` finito.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `Number.isFinite(deltaRadians)`.
- **Postcondiciones**: 
  - `this.rotation += deltaRadians`.
  - `dirty = true`.
  - `position` y `scale` NO cambian.
  - NO crea matrices durante la operación.
- **Invariantes**: preservados.
- **Errores**: `InvalidNumericInputError` si `deltaRadians` no es finito.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.rotation` y `this.dirty`.
- **Idempotencia**: no (acumulativa).
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: delta cero (marca dirty igualmente); delta negativo; delta grande.
- **Dependencias**: `InvalidNumericInputError`.
- **Tests obligatorios**: rotate suma correctamente; rotate marca dirty; rotate no altera position ni scale; rotate con delta inválido lanza; rotate con delta cero marca dirty.
- **Ejemplo**: `t.rotate(Math.PI / 2)`.
- **Notas**: operación relativa. Siempre marca dirty.
- **Historial**: v3.0.

---

## TRN-008 · getScale()

- **Propósito**: Devolver copia independiente de la escala actual.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Vector2` igual a `this.scale`.
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: `this` no muta; mutar el resultado no afecta a `this.scale`.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: escala unidad; escala cero; escala negativa.
- **Dependencias**: `Vector2`.
- **Tests obligatorios**: devuelve Vector2 con mismos valores; instancia distinta; mutar resultado no altera interno; NO altera dirty.
- **Ejemplo**: `t.getScale()`.
- **Notas**: PROHIBIDO devolver referencia mutable interna.
- **Historial**: v3.0.

---

## TRN-009 · setScale(scale)

- **Propósito**: Reemplazar escala y marcar dirty SÓLO si cambió.
- **Entradas**: `scale: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `scale instanceof Vector2`.
- **Postcondiciones**: 
  - `this.scale` es COPIA de `scale`.
  - Si difiere del anterior más allá de tolerancia → `dirty = true`.
  - Si es igual dentro de tolerancia → `dirty` NO cambia.
  - `position` y `rotation` NO cambian.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `scale` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.scale` y condicionalmente `this.dirty`.
- **Idempotencia**: sí.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: comparación aproximada con epsilon por defecto `1e-6`.
- **Casos límite**: misma escala; escala dentro de tolerancia; escala distinta; escala (0,0); escala negativa.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: setScale con valor distinto marca dirty; setScale con valor igual no ensucia; setScale no altera position ni rotation; setScale(null) lanza; setScale(NaN-vector) lanza; mutar argumento después no afecta al Transform.
- **Ejemplo**: `t.setScale(new Vector2(2, 2))`.
- **Notas**: guarda COPIA, no referencia.
- **Historial**: v3.0.

---

## TRN-010 · scaleBy(factor)

- **Propósito**: Multiplicar componente a componente la escala actual por factor.
- **Entradas**: `factor: Vector2`.
- **Salidas**: `void` (mutación controlada).
- **Precondiciones**: `factor instanceof Vector2`.
- **Postcondiciones**: 
  - `this.scale = this.scale * factor` componente a componente.
  - `dirty = true`.
  - `position` y `rotation` NO cambian.
  - NO crea matrices durante la operación.
- **Invariantes**: preservados.
- **Errores**: `InvalidVectorError` si `factor` no es `Vector2`.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.scale` y `this.dirty`.
- **Idempotencia**: no (acumulativa).
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: factor (1,1) (marca dirty igualmente); factor (0,0); factor negativo; factor muy grande.
- **Dependencias**: `Vector2`, `InvalidVectorError`.
- **Tests obligatorios**: scaleBy multiplica correctamente; scaleBy marca dirty; scaleBy no altera position ni rotation; scaleBy con factor inválido lanza; scaleBy con factor (1,1) marca dirty.
- **Ejemplo**: `t.scaleBy(new Vector2(2, 3))`.
- **Notas**: operación relativa. Siempre marca dirty.
- **Historial**: v3.0.

---

## TRN-011 · toMatrix()

- **Propósito**: Componer la matriz local contractual. Orden: `translate × rotate × scale`.
- **Entradas**: ninguna.
- **Salidas**: nuevo `Matrix3x3` (copia o inmutable) igual a la composición.
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: 
  - Si `dirty === false` y `matrixCache !== null`: devuelve COPIA de la caché (optimización permitida).
  - Si `dirty === true`: recomputa `translate × rotate × scale`, actualiza `matrixCache`, limpia `dirty`, devuelve resultado.
  - NO modifica `position`, `rotation` ni `scale`.
  - Caché coherente con estado.
- **Invariantes**: TRANS-01 compatible; INV-005 satisfecho tras recomputación.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `matrixCache` y `dirty` cuando recomputa.
- **Idempotencia**: sí (mismo estado semántico antes y después).
- **Pureza**: impura (muta caché interna).
- **Determinismo**: sí.
- **Tolerancias**: precisión de aritmética de punto flotante.
- **Casos límite**: transform identidad; transform con escala (0,0); transform con rotación extrema; llamada consecutiva sin mutación (usa caché); llamada tras mutación (recomputa).
- **Dependencias**: `Matrix3x3`.
- **Tests obligatorios**: identidad devuelve identidad; traslación pura; rotación pura; escala pura; composición completa; dos llamadas seguidas sin mutación dan mismo resultado; mutación después de toMatrix marca dirty; toMatrix limpia dirty al recomputar; toMatrix no muta position/rotation/scale; resultado es copia/inmutable, no caché mutable interna.
- **Ejemplo**: `t.toMatrix()`.
- **Notas**: Orden contractual: `translate × rotate × scale`. NO duplica lógica de Matrix3x3; sólo compone mediante factorías MAT-003/004/005 y producto MAT-006.
- **Historial**: v3.0.

---

## TRN-012 · isDirty()

- **Propósito**: Consultar el booleano dirty INTERNO de Transform.
- **Entradas**: ninguna.
- **Salidas**: `boolean`.
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: `this` no muta.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: ninguno.
- **Idempotencia**: sí.
- **Pureza**: pura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: dirty=true; dirty=false.
- **Dependencias**: ninguna.
- **Tests obligatorios**: devuelve valor correcto; NO altera dirty; NO consulta nada externo.
- **Ejemplo**: `t.isDirty()`.
- **Notas**: NO es SceneNode. NO consulta flags externos.
- **Historial**: v3.0.

---

## TRN-013 · clearDirty()

- **Propósito**: Limpiar SÓLO el dirty interno de Transform.
- **Entradas**: ninguna.
- **Salidas**: `void`.
- **Precondiciones**: `this` es `Transform` válido.
- **Postcondiciones**: 
  - `this.dirty = false`.
  - NO altera `position`, `rotation`, `scale`.
  - NO toca `matrixCache` (queda intacto, incluso si era null).
  - NO DEBE limpiar flags de SceneNode (que aún no existen).
  - NO notifica a nadie. NO propaga.
- **Invariantes**: preservados.
- **Errores**: ninguno.
- **Complejidad**: O(1) tiempo, O(1) espacio.
- **Efectos colaterales**: mutación de `this.dirty`.
- **Idempotencia**: sí.
- **Pureza**: impura.
- **Determinismo**: sí.
- **Tolerancias**: N/A.
- **Casos límite**: dirty=true → false; dirty ya false → permanece false; matrixCache=null y dirty se limpia → estado válido pero caché vacía (ver nota).
- **Dependencias**: ninguna.
- **Tests obligatorios**: clearDirty limpia dirty; clearDirty no altera position/rotation/scale; clearDirty no altera matrixCache; clearDirty no toca objetos externos (test conceptual con objeto simulacro).
- **Ejemplo**: `t.clearDirty()`.
- **Notas**: §9.13 lo dice explícitamente: NO DEBE limpiar flags de SceneNode. Son conceptos disjuntos.
- **Historial**: v3.0.