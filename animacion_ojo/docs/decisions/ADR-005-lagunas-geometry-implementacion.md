ADR-005 — Lagunas y extensiones de la capa geometry/
Archivo: docs/decisions/ADR-005-lagunas-geometry-implementacion.md
Estado: Aceptado — decisiones cerradas durante la implementación de Etapa 5
Autoridad: Subordinado a tdd.md v3.0. No puede contradecirlo (§73).
Alcance: Etapas 5a, 5b, 5c, 5d (geometry/) y por transitividad todo módulo que consuma Path, BezierPath, Circle, GeometryUtils y CommandType.
Complementa: ADR-004 (que fijó las decisiones estructurales previas a la implementación).
Registra: decisiones tomadas durante la implementación de Etapa 5 y extensiones a §11–§14.

0. Propósito
ADR-004 fijó las decisiones estructurales de geometry/ antes de implementar. Durante la implementación de Etapa 5 (sub-etapas 5a–5d), surgieron decisiones adicionales:

Bloqueos por especificación (§0.2) que el TDD no cubría y que el agente codificador reportó correctamente.

Extensiones a §11–§14 aprobadas por el owner.

Políticas específicas de implementación que no estaban en ADR-004.

Este ADR cierra esas decisiones. Es complementario a ADR-004, no lo reemplaza. Todas las decisiones aquí son compatibles con el TDD y con ADR-003 y ADR-004.

Cualquier implementación posterior DEBE respetar estas decisiones. Reabrirlas requiere un ADR posterior con CHANGE-ID.

1. Material acumulado
Origen	Tipo	Cantidad
Etapa 5a — bloqueos	Decisiones semánticas	6 (a)–(f)
Etapa 5b — L-BEZ	Decisiones de owner	2 (L-BEZ-01, L-BEZ-02)
Etapa 5b — bloqueos	Decisiones semánticas	12 (a)–(l)
Etapa 5b — extensión	Extensión a §11	1 (PATH-012)
Etapa 5c — extensión	Extensión a §13	3 (CIR-006, CIR-007, CIR-008)
Etapa 5d — L-GEOU	Decisiones de owner	3 (L-GEOU-01, L-GEOU-02, L-GEOU-03)
Etapa 5d — bloqueos	Decisiones semánticas	6 (b)–(h)
2. Decisiones de Etapa 5a — Path
ADR-005-D5a-a · close() sin subpath activo
Resuelve: laguna de §PATH-006.

Decisión: close() exige subpath activo (el último comando no es CLOSE ni el array está vacío). Si no hay subpath activo → InvalidPathError.

Fundamento: coherencia con §PATH-003/004/005 que exigen subpath activo. Un CLOSE huérfano no tiene semántica geométrica.

ADR-005-D5a-b · isClosed() con múltiples subpaths
Resuelve: ambigüedad de §PATH-008 ("subpath relevante").

Decisión: isClosed() devuelve true sólo si todos los subpaths están cerrados. Path vacío → false. Path con un subpath abierto → false.

Fundamento: lectura conservadora de "subpath relevante". Un path con geometría abierta no es un path cerrado.

ADR-005-D5a-c · dirty/versioning en Path
Resuelve: §PATH no especifica flags de dirty. GEO-01 dice "modificar geometría debe invalidar bounds".

Decisión: Path no expone dirty ni versioning. El consumidor que muta es responsable de notificar aguas arriba (SceneNode.setGeometry en Etapa 6 materializará GEO-01).

Fundamento: §19 define flags oficiales como pertenecientes a SceneNode. Añadir estado de dirty a Path sería capacidad no especificada.

ADR-005-D5a-d · getBounds() con sólo MOVE_TO
Resuelve: §PATH-011 no cubre el caso.

Decisión:

Path con cero comandos → AABB.empty().

Path con sólo MOVE_TO → AABB puntual en ese MOVE_TO.

Path con MOVE_TO + CLOSE sin segmentos → AABB puntual en el MOVE_TO.

Fundamento: un MOVE_TO es un punto geométrico. Coherente con AABB-008 (expandByPoint sobre vacío).

ADR-005-D5a-e · CLOSE consecutivos
Resuelve: §PATH no especifica.

Decisión: el segundo CLOSE consecutivo lanza InvalidPathError. Consecuencia directa de la decisión (a): tras un CLOSE no hay subpath activo.

Fundamento: consistencia interna. Evitar estado degenerado.

ADR-005-D5a-f · Comando no-congelado en constructor
Resuelve: §PATH-001 no especifica.

Decisión: constructor(commands) rechaza con InvalidPathError si algún comando no está congelado.

Fundamento: ADR-004-D1 exige comandos inmutables. Congelar internamente un comando no-congelado rompería ownership (el caller conservaría referencia mutable). Rechazar es explícito.

Sub-decisión: el motor no proporciona factoría pública de comandos en 5a. Los métodos del Path construyen y congelan internamente.

3. Etapa 5b — BezierPath
3.1 Decisiones del owner
ADR-005-L-BEZ-01 · MAX_RECURSION_DEPTH en BezierPath
Decisión: 24, misma constante que ADR-004-D4. "Por ahora". Si en Etapa 10 o 16 se detecta insuficiencia o exceso, se reabre con CHANGE-ID.

Nota: durante la implementación de 5b se determinó que normalizeSegments no usa recursión profunda (subdivide un segmento a la vez). La constante fue declarada y luego eliminada por no tener uso. Si en el futuro se necesita recursión en BezierPath, se reintroduce con CHANGE-ID.

Estado actual: la constante NO existe en BezierPath.js. El código no tiene código muerto.

ADR-005-L-BEZ-02 · Semántica de normalizeSegments(targetCount)
Decisión: targetCount es un número exacto. Ambos paths terminan con exactamente targetCount segmentos.

Algoritmo:

Si segmentos < targetCount: subdividir los más largos (mayor longitud euclidiana P0 → P3) en t=0.5 hasta alcanzar targetCount.

Si segmentos > targetCount: fusionar los más pequeños (menor longitud euclidiana combinada) aproximando por promedio de puntos de control hasta alcanzar targetCount.

Si segmentos === targetCount: sin cambios.

Desempate por índice ascendente (determinismo).

Postcondición: devuelve nuevo BezierPath. No muta original.

Errores:

targetCount no entero, <= 0, NaN → NormalizationError.

segmentCount() === 0 en el origen → NormalizationError.

3.2 Decisiones de bloqueo
ADR-005-D5b-a · Error para segmentIndex fuera de rango
Decisión: InvalidPathError.

Fundamento: coherencia con la validación estructural de Path. ADR-004-D6 prohíbe inventar errores. PathCompatibilityError y NormalizationError son específicos de morphing/normalización.

ADR-005-D5b-b · Error para t fuera de [0,1]
Decisión: InvalidPathError.

Fundamento: mismo razonamiento que (a).

ADR-005-D5b-c · Tangente cero en getTangentAt
Decisión: devolver Vector2(0, 0).

Fundamento: tangente cero es resultado matemático válido (punto estacionario). No es error. El consumidor decide cómo manejarlo. Documentado en docs/contracts/BezierPath.md.

ADR-005-D5b-d · Subdivisión en normalizeSegments
Decisión: subdividir el segmento con mayor longitud euclidiana P0 → P3 (aproximación por cuerda). Desempate por índice ascendente.

Fundamento: determinista, barato, suficiente. Coherente con L-BEZ-02.

ADR-005-D5b-e · Fusión en normalizeSegments
Decisión: fusionar los dos segmentos adyacentes con menor longitud combinada, aproximando con un segmento cúbico por promedio de puntos de control. Desempate por índice ascendente.

Fundamento: determinista, coherente con (d). Aproximación por promedio documentada en docs/contracts/BezierPath.md.

ADR-005-D5b-g · fromCommands con comandos no soportados
Decisión: BezierPath nunca lanza PathCompatibilityError en fromCommands. Si los comandos son inválidos, Path los rechaza primero con InvalidPathError. PathCompatibilityError queda reservado para morphing (Etapa 10).

Fundamento: §BEZ-002 menciona conceptualmente el caso, pero en la práctica Path ya valida. Documentado en docs/contracts/BezierPath.md.

ADR-005-D5b-h · Estructura de split
Decisión: split(segmentIndex, t) devuelve [bp1, bp2]:

bp1: segmentos 0..i-1 + primera mitad del segmento i.

bp2: segunda mitad del segmento i + segmentos i+1..N-1.

Postcondición: bp1.segmentCount() + bp2.segmentCount() === original.segmentCount() + 1.

Fundamento: semántica natural de split. Sin redundancia.

ADR-005-D5b-i · CLOSE en el constructor
Decisión: CLOSE se almacena como metadato de subpath (booleano closed por subpath). No genera segmento.

Representación: cada subpath en BezierPath tiene { closed: boolean, startSegmentIndex: number, segmentCount: number }.

Fundamento: §BEZ-001 dice "metadatos de subpath". Preserva información topológica sin agregar geometría silenciosa.

ADR-005-D5b-j · BezierPath vacío
Decisión: válido. segmentCount() === 0. Métodos que requieren segmentos lanzan error.

Fundamento: coherencia con Path (5a) donde Path vacío es válido.

ADR-005-D5b-k · getPointAt sobre BezierPath vacío
Decisión: InvalidPathError (cualquier segmentIndex está fuera de rango).

Fundamento: consistencia con (a). No inventar Vector2(0,0) como valor semántico.

ADR-005-D5b-l · normalizeSegments con 1 segmento y targetCount > 1
Decisión: subdividir repetidamente con De Casteljau en t=0.5. Si targetCount no es potencia de 2, se subdividen los segmentos más largos (regla d) hasta alcanzar el objetivo.

Fundamento: determinista. Estructura balanceada.

3.3 Extensión a §11
ADR-005-PATH-012 · Path.getCommands() público
Motivo: BezierPath.constructor(path) necesita leer comandos del Path. El contrato de 5a dejó getCommands() fuera por no estar en §11. En 5b se añadió como método público.

Contrato:

getCommands(): devuelve copia del array interno. Los comandos dentro son las mismas referencias congeladas.

Muta el array devuelto no afecta al Path.

No muta el Path.

Fundamento: ADR-004-D1 y D2 ya contemplan getCommands() como "si existe". Se decidió que existe. Coherente con ownership (§53.1) y con la inmutabilidad de comandos (ADR-004-D1).

Registro: extensión a §11. PATH-012 en docs/contracts/Path.md.

4. Etapa 5c — Circle
4.1 Extensión a §13
ADR-005-CIR-006 · Circle.getCenter()
Motivo: §13 no contempla getters. Los consumidores (CircleNode en Etapa 7, HitTester en Etapa 8, GeometryUtils en 5d) necesitan leer el centro.

Contrato:

getCenter(): devuelve copia del centro (Vector2). No muta el Circle.

Mutar el resultado no afecta al Circle.

Fundamento: coherencia con Transform.getPosition() (§9.2) y AABB.clone() (AABB-004). Ownership (§53.1).

ADR-005-CIR-007 · Circle.getRadius()
Motivo: mismo que CIR-006.

Contrato:

getRadius(): devuelve el radio (number >= 0). No muta el Circle.

ADR-005-CIR-008 · Circle.clone()
Motivo: §13 no contempla clone. Path, AABB y Transform lo tienen.

Contrato:

clone(): devuelve nuevo Circle con centro copiado y radio primitivo.

Mutar original no afecta clon; mutar clon no afecta original.

Fundamento: coherencia con PATH-007 y AABB-004. Ownership.

5. Etapa 5d — GeometryUtils
5.1 Decisiones del owner
ADR-005-L-GEOU-01 · interpolatePath acepta Path o BezierPath
Decisión: interpolatePath(pathA, pathB, t) acepta ambos tipos. Devuelve el mismo tipo que pathA.

Fundamento: maximiza compatibilidad. El consumidor no necesita convertir manualmente. Coherente con ADR-004-D3 (BezierPath independiente): la conversión interna Path → BezierPath ocurre dentro de interpolatePath, no en el consumidor.

ADR-005-L-GEOU-02 · interpolatePath normaliza si son incompatibles
Decisión: si pathA y pathB tienen distinto segmentCount(), se normalizan automáticamente al máximo de ambos (vía BezierPath.normalizeSegments). Sólo si la normalización falla (NormalizationError) se propaga el error. Nunca se lanza PathCompatibilityError por discrepancia de segmentCount.

Fundamento: §ANIM-03 acepta "normalización explícita" como vía. emotion-ball normaliza paths para morphing. Sin normalización automática, muchos casos válidos serían rechazados.

ADR-005-L-GEOU-03 · Caché de orientación en WeakMap
Decisión: la validación de orientación de subpaths para fillRule === "nonzero" con múltiples subpaths se cachea en WeakMap<Path, OrientationCache> interno de GeometryUtils. La entrada se crea en la primera llamada a pointInPath sobre ese Path. Si el Path se recolecta, la entrada se va con él.

Fundamento: Path no expone dirty/versioning (decisión ADR-005-D5a-c). Añadir caché interna a Path violaría esa decisión. WeakMap es transparente y no requiere invalidación porque los comandos son inmutables.

5.2 Decisiones de bloqueo
ADR-005-D5d-b · interpolatePath con path de 0 segmentos
Decisión: NormalizationError.

Casos:

pathA con 0 segmentos y pathB con N > 0 → NormalizationError.

pathB con 0 segmentos y pathA con N > 0 → NormalizationError.

Ambos con 0 segmentos → NormalizationError.

Fundamento: no se puede interpolar desde/hacia un path vacío. Coherente con normalizeSegments que exige segmentCount() > 0.

ADR-005-D5d-c · "Borde cerrado" con donut
Decisión: inclusión cerrada primero; winding/parity después.

Semántica exacta:

Si el punto está en el borde de cualquier subpath → true.

Si no está en ningún borde → aplicar fillRule (nonzero/evenodd) según winding/parity.

Fundamento: coherente con ADR-004-D5 ("puntos en borde: dentro") y con SVG/Canvas2D.

ADR-005-D5d-d · Rayos que pasan por vértices
Decisión: regla de lados opuestos (ray casting estándar).

Semántica exacta: un vértice cuenta como cruce sólo si sus dos segmentos adyacentes están en lados opuestos del rayo (y1 < point.y <= y2 o y2 < point.y <= y1). Si ambos segmentos están del mismo lado, no cuenta.

Fundamento: regla canónica en geometría computacional y en implementaciones de referencia (SVG, Canvas2D, Skia). Determinista. Evita doble conteo.

Documentado en docs/contracts/GeometryUtils.md.

ADR-005-D5d-e · transformGeometry con Circle
Decisión: InvalidGeometryError.

Fundamento: §14 sólo habla de Path. Un círculo transformado por escala no uniforme no es Circle (es elipse). Rechazar es honesto.

Si un consumidor lo necesita: se reabre con CHANGE-ID.

ADR-005-D5d-f · transformGeometry con BezierPath
Decisión: InvalidGeometryError.

Fundamento: §14 sólo habla de Path. Exponer puntos de control de BezierPath para transformación introduce acoplamiento. El consumidor puede convertir a Path, transformar, y reconstruir BezierPath si lo necesita.

Si un consumidor lo necesita: se reabre con CHANGE-ID.

ADR-005-D5d-h · pointInPath con subpath abierto de 1 segmento
Decisión: el cierre implícito cuenta para los cruces del rayo.

Semántica exacta:

MOVE_TO define el punto inicial.

Cualquier subpath sin CLOSE explícito se trata como si tuviera un segmento adicional del último punto al primero.

Ese segmento adicional cuenta para el conteo de cruces del rayo.

No cuenta para getBounds() ni segmentCount().

Fundamento: coherencia con SVG y Canvas2D. La asimetría con getBounds y segmentCount es intencional: son operaciones geométricas sobre el path tal como está definido, mientras que pointInPath es una operación de relleno que sigue convenciones estándar.

5.3 Extensión a BezierPath (post-5d)
ADR-005-BEZ-EXT · Método _toPath() en BezierPath
Motivo: interpolatePath necesita convertir BezierPath a comandos cúbicos para interpolar. Se decidió añadir un método interno _toPath() a BezierPath.

Estado: NO implementado. Durante la implementación de 5d, el agente reportó el bloqueo y propuso _toPath(). Se decidió no añadirlo porque:

Convertir BezierPath a Path debería ser una operación pública si otros consumidores la necesitan, no un método "interno" con prefijo _.

La conversión BezierPath → Path es exactamente lo inverso de Path → BezierPath. Debería llamarse toPath() y ser público.

Antes de añadir capacidad, verificar si interpolatePath realmente lo necesita. El agente puede acceder a path.getCommands() y reconstruir los segmentos con la información ya disponible.

Acción pendiente: si tras la implementación de 5d se confirma que interpolatePath necesita un método de conversión, se abre un CHANGE-ID para añadir BezierPath.toPath() público (no _toPath()). No se acepta el prefijo _ como encapsulamiento.

Regla general: en este proyecto, métodos "internos" con prefijo _ no se aceptan. Si una operación la necesita más de un módulo, es pública. Si la necesita sólo uno, vive en ese módulo, no en el objeto que la expone.

6. Verificación
Tras aplicar ADR-005, el checklist de cierre de cada sub-etapa de geometry/ incluye:

text
[ ] ¿close() sin subpath activo lanza InvalidPathError?
[ ] ¿isClosed() requiere todos los subpaths cerrados?
[ ] ¿Path no expone dirty/versioning?
[ ] ¿getBounds() con sólo MOVE_TO devuelve AABB puntual?
[ ] ¿CLOSE consecutivos lanzan error?
[ ] ¿Constructor rechaza comando no-congelado?
[ ] ¿BezierPath no tiene MAX_RECURSION_DEPTH (eliminada)?
[ ] ¿normalizeSegments usa targetCount exacto?
[ ] ¿segmentIndex y t fuera de rango lanzan InvalidPathError?
[ ] ¿getTangentAt devuelve Vector2(0,0) en punto estacionario?
[ ] ¿normalizeSegments subdivide por mayor longitud euclidiana?
[ ] ¿normalizeSegments fusiona por menor longitud combinada?
[ ] ¿fromCommands nunca lanza PathCompatibilityError?
[ ] ¿split devuelve bp1 = 0..i-1 + mitad1; bp2 = mitad2 + i+1..N-1?
[ ] ¿CLOSE se almacena como metadato de subpath?
[ ] ¿getPointAt sobre vacío lanza InvalidPathError?
[ ] ¿getCommands() existe y devuelve copia?
[ ] ¿getCenter/getRadius/clone existen en Circle?
[ ] ¿interpolatePath acepta Path y BezierPath?
[ ] ¿interpolatePath normaliza si segmentCount difiere?
[ ] ¿caché de orientación en WeakMap de GeometryUtils?
[ ] ¿interpolatePath con path de 0 segmentos lanza NormalizationError?
[ ] ¿punto en borde de donut → dentro?
[ ] ¿rayo por vértice usa regla de lados opuestos?
[ ] ¿transformGeometry con Circle lanza InvalidGeometryError?
[ ] ¿transformGeometry con BezierPath lanza InvalidGeometryError?
[ ] ¿subpath abierto de 1 segmento cuenta cierre implícito en pointInPath?
[ ] ¿Ningún método "interno" con prefijo _ se ha añadido?
7. Estado
Aceptado. Decisiones cerradas por el owner.

Artefactos derivados (ya implementados en Etapa 5):

src/geometry/CommandType.js

src/geometry/Path.js (con PATH-012)

src/geometry/BezierPath.js

src/geometry/Circle.js (con CIR-006..008)

src/geometry/GeometryUtils.js

src/errors/InvalidPathError.js

src/errors/InvalidGeometryError.js

src/errors/PathCompatibilityError.js

src/errors/NormalizationError.js

src/errors/InvalidFillRuleError.js

docs/contracts/Path.md

docs/contracts/BezierPath.md

docs/contracts/Circle.md

docs/contracts/GeometryUtils.md

Artefactos pendientes:

BezierPath.toPath() público (sólo si interpolatePath lo necesita; se decide tras revisión de 5d).

Actualización de CHANGELOG.md con CHANGE-ID de este ADR.

8. Cierre
Con ADR-005, la capa geometry/ queda completamente especificada:

ADR-004 fijó la estructura (D1–D6).

ADR-005 fijó las decisiones de implementación (bloqueos + extensiones + owner decisions).

La Etapa 5 completa queda cerrada cuando el agente entregue 5d con los 6 bloqueos resueltos y sin bloqueos nuevos críticos.

Fin de ADR-005.

