Archivo: docs/decisions/ADR-003-lagunas-math.md
Estado: Propuesto — requiere decisión del owner del contrato
Autoridad: Subordinado a tdd.md v3.0. No puede contradecirlo (§73).
Alcance: Lagunas detectadas durante las Etapas 1–3 del orden contractual (§69).
Normativo para: Etapas 4 en adelante de math/, y por transitividad todo módulo que use Matrix3x3.invert(), Transform.clearDirty(), o equalsApprox.

0. Propósito
§0.2 del tdd.md declara bloqueado por especificación todo caso que el contrato no cubre. Este ADR cierra las lagunas detectadas durante las Etapas 1, 2 y 3 sin tocar tdd.md, mediante decisiones interpretativas vinculantes.

Cada decisión aquí registrada:

es compatible con tdd.md,

no reduce ningún requisito,

no introduce capacidades nuevas,

fija la semántica exacta donde el TDD era silencioso.

Cualquier implementación posterior DEBE respetar estas decisiones. Reabrirlas requiere un ADR posterior con CHANGE-ID.

1. Lagunas detectadas
ID	Etapa	Módulo	Descripción	Gravedad
L-MATH-01	2	Matrix3x3.invert()	Epsilon de invertibilidad no fijado por el TDD.	Alta
L-MATH-02	1–2	equalsApprox(other, epsilon)	Epsilon por llamada; ¿existe epsilon global por defecto?	Media
L-MATH-03	3	Transform.clearDirty()	Comportamiento cuando matrixCache === null.	Alta
L-MATH-04	3	Transform.toMatrix()	Orden de composición translate × rotate × scale no escrito literalmente.	Alta
L-MATH-05	3	Transform setters	Regla exacta de "marca dirty si cambió" no cuantificada.	Media
L-MATH-06	2	Matrix3x3.constructor(values)	¿Acepta Float32Array o sólo array de 9 números?	Baja
2. Decisiones
ADR-003-D1 — Epsilon global de la capa math/
Resuelve: L-MATH-01, L-MATH-02.

Decisión:

Existe un único módulo math/Epsilon.js que exporta:

text
EPSILON_MATH = 1e-9   // tolerancia por defecto para comparaciones
                      // y para invertibilidad en la capa math/
Reglas:

Matrix3x3.invert() usa EPSILON_MATH como umbral de invertibilidad: si |determinant| <= EPSILON_MATH, lanza NonInvertibleMatrixError.

equalsApprox(other, epsilon) en Vector2 y Matrix3x3 exige epsilon explícito. NO usa EPSILON_MATH por defecto. El caller decide.

Los tests pueden importar EPSILON_MATH para verificar tolerancias, pero no pueden modificarlo.

EPSILON_MATH es constante. No es configurable en runtime.

Justificación:

§5.3 exige tolerancia explícita pero no fija valor.

§MAT-008 exige |det| > epsilon sin definir epsilon.

Un único punto de verdad evita que cada módulo invente su epsilon.

No configurable en runtime preserva determinismo (§INV-006, §ANIM-02).

Impacto:

Etapa 2: Matrix3x3.invert() debe importar EPSILON_MATH.

Etapa 3: Transform no lo usa directamente (delega en Matrix3x3).

Etapas posteriores: AABB, Geometry, HitTester usan EPSILON_MATH para comparaciones geométricas.

ADR-003-D2 — Transform.clearDirty() con caché vacía
Resuelve: L-MATH-03.

Decisión:

Transform.clearDirty() (§9.13):

Limpia dirty = false.

NO toca matrixCache.

Si matrixCache === null y dirty pasa a false, el estado resultante es válido siempre que position/rotation/scale sean finitos.

La coherencia semántica se garantiza así:

isDirty() devuelve false tras clearDirty().

toMatrix() siempre verifica matrixCache === null antes de devolver caché. Si es null, recomputa aunque dirty === false.

Es decir: dirty === false significa "el estado primitivo no cambió desde la última composición", pero no garantiza que matrixCache exista.

Justificación:

§9.13 sólo dice "limpia sólo dirty interno de Transform".

§9.11 dice que toMatrix() "puede actualizar caché interna".

Interpretar clearDirty() como "invalidar caché" o "forzar recomposición" sería inventar política.

Interpretar dirty === false && matrixCache === null como estado inválido obligaría a clearDirty() a recomponer, lo cual excede su responsabilidad.

Impacto:

toMatrix() debe implementarse con doble condición: if (!dirty && matrixCache) return copy(matrixCache); else recompute();

Tests deben cubrir el caso clearDirty() → toMatrix() sin recomposición previa.

ADR-003-D3 — Orden de composición en Transform.toMatrix()
Resuelve: L-MATH-04.

Decisión:

El orden contractual es:

text
localMatrix = translation(position) × rotation(rotation) × scale(scale)
es decir, primero escala, luego rota, luego traslada al aplicar a un punto:

text
p_world = T × R × S × p_local
Justificación:

§6 fija World = Parent × Local para la jerarquía, pero no fija el orden interno del local.

El orden T × R × S es el estándar en motores 2D jerárquicos y es coherente con §TRANS-01 y §INV-002.

Es el orden que preserva la interpretación "position es la posición del origen local en el espacio padre", que es la lectura natural de §9.1.

Cualquier otro orden (R × T × S, S × R × T) produciría que position dependiera de rotation o scale, lo cual contradice §9.3 ("setPosition NO DEBE modificar rotación ni escala") en su interpretación semántica.

Impacto:

Transform.toMatrix() compone en orden T × R × S.

Tests deben verificar: Transform(position=(10,0), rotation=π/2).toMatrix().transformPoint((1,0)) ≈ (10, 1), no (0, 10) ni (0, 11).

Tests cruzados con SceneNode.updateWorldTransform() (§NODE-010) deben usar este mismo orden.

ADR-003-D4 — Regla exacta de "marca dirty si cambió"
Resuelve: L-MATH-05.

Decisión:

En setPosition, setRotation, setScale (§9.3, §9.6, §9.9):

Se compara el valor nuevo con el actual usando equalsApprox con EPSILON_MATH.

Si son iguales dentro de tolerancia: no se muta el estado interno y no se marca dirty.

Si son distintos: se muta (guardando copia en el caso de Vector2) y se marca dirty = true.

En translate, rotate, scaleBy (§9.4, §9.7, §9.10):

Siempre mutan y siempre marcan dirty = true.

No se compara con el valor anterior porque son operaciones relativas, no absolutas.

Excepción: si el delta es cero exacto en todos sus componentes, PUEDE no marcar dirty, pero el comportamiento DEBE ser determinista y documentado en docs/contracts/Transform.md. Recomendación: siempre marcar dirty para simplificar y evitar ramas condicionales costosas.

Justificación:

§9.3, §9.6, §9.9 dicen "marca dirty si cambió".

§9.4, §9.7, §9.10 no dicen nada.

Sin una regla explícita, cada implementación divergiría.

Impacto:

setX requiere comparación con equalsApprox y EPSILON_MATH.

translate/rotate/scaleBy marcan dirty incondicionalmente (recomendado).

Tests deben verificar: setPosition(mismaPosicion) no ensucia; translate((0,0)) sí ensucia (o no, según decisión documentada, pero consistente).

ADR-003-D5 — Formato de values en Matrix3x3.constructor
Resuelve: L-MATH-06.

Decisión:

Matrix3x3.constructor(values) acepta exactamente:

Sin argumentos → identidad.

Un Array de exactamente 9 números finitos, en orden fila-mayor:
[m00, m01, m02, m10, m11, m12, m20, m21, m22].

NO acepta:

Float32Array, Float64Array u otros typed arrays.

Objetos con propiedades m00..m22.

Matrices de otras representaciones.

Arrays de longitud distinta a 9.

Si se requiere typed array, se hará mediante una factoría explícita en una etapa posterior y con CHANGE-ID.

Justificación:

§8.1 dice "exactamente 9 números finitos o una representación de identidad definida por constructor sin argumentos".

"Exactamente 9 números" se interpreta como Array de 9 números para mantener el contrato mínimo.

Aceptar typed arrays sin contrato añade superficie no especificada.

Impacto:

Tests deben verificar que pasar Float32Array(9) lanza InvalidMatrixError.

Documentar el orden fila-mayor en docs/contracts/Matrix3x3.md.

3. Resumen de impacto por etapa
Etapa	Módulo	Cambios derivados de ADR-003
1	Vector2	equalsApprox sigue exigiendo epsilon explícito. Sin cambios.
2	Matrix3x3	invert() usa EPSILON_MATH. Constructor acepta sólo Array de 9.
3	Transform	toMatrix() orden T×R×S. clearDirty() no toca caché. Setters comparan con equalsApprox.
4	AABB	Usa EPSILON_MATH en comparaciones.
5	Geometry	Usa EPSILON_MATH en getBounds() y validaciones.
6	SceneNode	Usa EPSILON_MATH en propagación de dirty.
8	HitTester	Usa EPSILON_MATH en comparación de puntos locales.
9	Clock	Sin cambios.
10	SpringSolver	isSettled usa umbrales propios, no EPSILON_MATH.
4. Verificación
Tras aplicar ADR-003, el checklist de cierre de cada etapa afectada debe incluir:

text
[ ] ¿invert() usa EPSILON_MATH?
[ ] ¿toMatrix() compone T × R × S?
[ ] ¿clearDirty() no toca matrixCache?
[ ] ¿setX compara con equalsApprox antes de ensuciar?
[ ] ¿constructor de Matrix3x3 rechaza typed arrays?
[ ] ¿equalsApprox sigue exigiendo epsilon explícito?
5. Estado
Propuesto. Requiere aprobación explícita del owner antes de modificar Etapas 1–3 y antes de arrancar Etapa 4.

Una vez aprobado:

Se marca como Aceptado.

Se crea math/Epsilon.js con EPSILON_MATH = 1e-9.

Se actualiza docs/contracts/Vector2.md, Matrix3x3.md, Transform.md con referencias a ADR-003.

Se registra CHANGE-ID en CHANGELOG.md.

Se añaden tests obligatorios listados en §2 de este ADR.

Fin de ADR-003.