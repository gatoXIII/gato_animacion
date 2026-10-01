import { Vector2 } from '../math/Vector2.js';
import { EPSILON_MATH } from '../math/Epsilon.js';
import { Path } from './Path.js';
import { CommandType } from './CommandType.js';
import { InvalidPathError } from '../errors/InvalidPathError.js';
import { NormalizationError } from '../errors/NormalizationError.js';

//const MAX_RECURSION_DEPTH = 24; // L-BEZ-01

// Helpers internos

function validateSegmentIndex(segments, segmentIndex, functionId) {
  if (!Number.isInteger(segmentIndex) ||
      segmentIndex < 0 ||
      segmentIndex >= segments.length) {
    throw new InvalidPathError({
      functionId,
      input: { segmentIndex, segmentCount: segments.length },
      prevState: null,
      cause: `segmentIndex ${segmentIndex} out of range [0, ${segments.length})`
    });
  }
}

function validateT(t, functionId) {
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new InvalidPathError({
      functionId,
      input: { t },
      prevState: null,
      cause: `t must be in [0, 1], got ${t}`
    });
  }
}

function freezeSegment(seg) {
  return Object.freeze({
    p0: Object.freeze(new Vector2(seg.p0.x, seg.p0.y)),
    p1: Object.freeze(new Vector2(seg.p1.x, seg.p1.y)),
    p2: Object.freeze(new Vector2(seg.p2.x, seg.p2.y)),
    p3: Object.freeze(new Vector2(seg.p3.x, seg.p3.y))
  });
}

// Conversión de comandos Path → segmentos cúbicos
function buildSegmentsAndSubpaths(path) {
  const segments = [];
  const subpaths = [];

  // Estado del recorrido
  let currentX = 0;
  let currentY = 0;
  let hasCurrent = false;
  let currentSubpathStart = 0;
  let currentSubpathSegmentCount = 0;
  let subpathClosed = false;

  // Accedemos a los comandos vía validate() + reconstrucción.
  // Path no expone getCommands(), así que usamos un truco:
  // reconstruimos desde la API pública de Path. Pero Path no expone
  // sus comandos. Por tanto, necesitamos una ruta alternativa.
  //
  // SOLUCIÓN: Path debe exponer una forma de iterar sus comandos.
  // Como no lo hace (ADR-004 no lo exige), usamos un método interno
  // no público pero accesible: iteramos los comandos mediante un
  // helper que reconstruye desde la estructura interna.
  //
  // En esta implementación, Path acepta un array de comandos en su
  // constructor. BezierPath lee ese array. Para ello, necesitamos
  // que Path exponga sus comandos. Añadimos un método interno
  // _getCommandsForGeometry() que NO es parte del contrato público
  // pero es accesible desde geometry/.
  //
  // Si esto viola el contrato, reportar como BLOQUEO.
//  const commands = path._getCommandsForGeometry();
    const commands = path.getCommands();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case CommandType.MOVE_TO: {
        // Cerrar subpath anterior si tenía segmentos
        if (currentSubpathSegmentCount > 0) {
          subpaths.push(Object.freeze({
            closed: subpathClosed,
            startSegmentIndex: currentSubpathStart,
            segmentCount: currentSubpathSegmentCount
          }));
        }
        currentX = cmd.x;
        currentY = cmd.y;
        hasCurrent = true;
        currentSubpathStart = segments.length;
        currentSubpathSegmentCount = 0;
        subpathClosed = false;
        break;
      }
      case CommandType.LINE_TO: {
        if (!hasCurrent) {
          throw new InvalidPathError({
            functionId: 'BEZ-001',
            input: { commandIndex: i, type: cmd.type },
            prevState: null,
            cause: 'LINE_TO without active subpath'
          });
        }
        const p0 = new Vector2(currentX, currentY);
        const p3 = new Vector2(cmd.x, cmd.y);
        const dx = p3.x - p0.x;
        const dy = p3.y - p0.y;
        const p1 = new Vector2(p0.x + dx / 3, p0.y + dy / 3);
        const p2 = new Vector2(p0.x + 2 * dx / 3, p0.y + 2 * dy / 3);
        segments.push(freezeSegment({ p0, p1, p2, p3 }));
        currentSubpathSegmentCount++;
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
      case CommandType.QUADRATIC_TO: {
        if (!hasCurrent) {
          throw new InvalidPathError({
            functionId: 'BEZ-001',
            input: { commandIndex: i, type: cmd.type },
            prevState: null,
            cause: 'QUADRATIC_TO without active subpath'
          });
        }
        const p0 = new Vector2(currentX, currentY);
        const Q = new Vector2(cmd.cx, cmd.cy);
        const p3 = new Vector2(cmd.x, cmd.y);
        const p1 = new Vector2(
          p0.x + (2 / 3) * (Q.x - p0.x),
          p0.y + (2 / 3) * (Q.y - p0.y)
        );
        const p2 = new Vector2(
          p3.x + (2 / 3) * (Q.x - p3.x),
          p3.y + (2 / 3) * (Q.y - p3.y)
        );
        segments.push(freezeSegment({ p0, p1, p2, p3 }));
        currentSubpathSegmentCount++;
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
      case CommandType.CUBIC_TO: {
        if (!hasCurrent) {
          throw new InvalidPathError({
            functionId: 'BEZ-001',
            input: { commandIndex: i, type: cmd.type },
            prevState: null,
            cause: 'CUBIC_TO without active subpath'
          });
        }
        const p0 = new Vector2(currentX, currentY);
        const p1 = new Vector2(cmd.c1x, cmd.c1y);
        const p2 = new Vector2(cmd.c2x, cmd.c2y);
        const p3 = new Vector2(cmd.x, cmd.y);
        segments.push(freezeSegment({ p0, p1, p2, p3 }));
        currentSubpathSegmentCount++;
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
      case CommandType.CLOSE: {
        if (currentSubpathSegmentCount > 0) {
          subpaths.push(Object.freeze({
            closed: true,
            startSegmentIndex: currentSubpathStart,
            segmentCount: currentSubpathSegmentCount
          }));
          currentSubpathStart = segments.length;
          currentSubpathSegmentCount = 0;
          subpathClosed = false;
        }
        // Si no hay subpath activo, CLOSE no hace nada (Path ya valida)
        break;
      }
    }
  }

  // Cerrar último subpath si queda abierto
  if (currentSubpathSegmentCount > 0) {
    subpaths.push(Object.freeze({
      closed: subpathClosed,
      startSegmentIndex: currentSubpathStart,
      segmentCount: currentSubpathSegmentCount
    }));
  }

  return { segments, subpaths };
}

// De Casteljau split de un segmento cúbico en t
function splitSegmentAt(seg, t) {
  const p0 = seg.p0, p1 = seg.p1, p2 = seg.p2, p3 = seg.p3;

  const q0 = new Vector2(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t);
  const q1 = new Vector2(p1.x + (p2.x - p1.x) * t, p1.y + (p2.y - p1.y) * t);
  const q2 = new Vector2(p2.x + (p3.x - p2.x) * t, p2.y + (p3.y - p2.y) * t);

  const r0 = new Vector2(q0.x + (q1.x - q0.x) * t, q0.y + (q1.y - q0.y) * t);
  const r1 = new Vector2(q1.x + (q2.x - q1.x) * t, q1.y + (q2.y - q1.y) * t);

  const s0 = new Vector2(r0.x + (r1.x - r0.x) * t, r0.y + (r1.y - r0.y) * t);

  const left = freezeSegment({ p0, p1: q0, p2: r0, p3: s0 });
  const right = freezeSegment({ p0: s0, p1: r1, p2: q2, p3 });
  return [left, right];
}

// Longitud euclidiana P0 → P3 de un segmento
function chordLength(seg) {
  const dx = seg.p3.x - seg.p0.x;
  const dy = seg.p3.y - seg.p0.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Reconstruir subpaths a partir de segmentos (tras split/normalize)
// Asume que los segmentos están en orden y que cada subpath original
// se preserva salvo que se divida.
function rebuildSubpaths(originalSubpaths, segments, splitInfo) {
  // splitInfo: { segmentIndex, t } o null
  // Si splitInfo es null, los subpaths son los mismos.
  // Si splitInfo no es null, el subpath que contiene segmentIndex
  // se divide en dos (ambos abiertos).
  if (!splitInfo) {
    return originalSubpaths.map(sp => Object.freeze({ ...sp }));
  }

  const { segmentIndex } = splitInfo;
  const newSubpaths = [];

  for (const sp of originalSubpaths) {
    const spEnd = sp.startSegmentIndex + sp.segmentCount;
    if (segmentIndex < sp.startSegmentIndex || segmentIndex >= spEnd) {
      // El segmento dividido no está en este subpath
      // Ajustar startSegmentIndex si es necesario (después del split)
      const offset = segmentIndex < sp.startSegmentIndex ? 1 : 0;
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex + offset,
        segmentCount: sp.segmentCount
      }));
    } else {
      // El segmento dividido está en este subpath
      // Dividir el subpath en dos (ambos abiertos)
      const leftCount = segmentIndex - sp.startSegmentIndex + 1;
      const rightCount = sp.segmentCount - leftCount + 1;

      newSubpaths.push(Object.freeze({
        closed: false, // se pierde el cierre al dividir
        startSegmentIndex: sp.startSegmentIndex,
        segmentCount: leftCount
      }));
      newSubpaths.push(Object.freeze({
        closed: false,
        startSegmentIndex: sp.startSegmentIndex + leftCount,
        segmentCount: rightCount
      }));
    }
  }

  return newSubpaths;
}

// Reconstruir subpaths tras fusión de dos segmentos adyacentes
function rebuildSubpathsAfterMerge(originalSubpaths, mergeIndex) {
  const newSubpaths = [];
  for (const sp of originalSubpaths) {
    const spEnd = sp.startSegmentIndex + sp.segmentCount;
    // ¿El par (mergeIndex, mergeIndex+1) está en este subpath?
    if (mergeIndex >= sp.startSegmentIndex && mergeIndex + 1 < spEnd) {
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex,
        segmentCount: sp.segmentCount - 1
      }));
    } else if (mergeIndex + 1 === sp.startSegmentIndex) {
      // El par cruza el inicio del subpath → no debería ocurrir
      // (los pares fusionados deben estar en el mismo subpath)
      newSubpaths.push(Object.freeze({ ...sp }));
    } else {
      // Ajustar start si es posterior al merge
      const offset = mergeIndex < sp.startSegmentIndex ? -1 : 0;
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex + offset,
        segmentCount: sp.segmentCount
      }));
    }
  }
  return newSubpaths;
}

// Reconstruir subpaths tras subdivisión de un segmento
function rebuildSubpathsAfterSplit(originalSubpaths, splitIndex) {
  const newSubpaths = [];
  for (const sp of originalSubpaths) {
    const spEnd = sp.startSegmentIndex + sp.segmentCount;
    if (splitIndex >= sp.startSegmentIndex && splitIndex < spEnd) {
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex,
        segmentCount: sp.segmentCount + 1
      }));
    } else {
      const offset = splitIndex < sp.startSegmentIndex ? 1 : 0;
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex + offset,
        segmentCount: sp.segmentCount
      }));
    }
  }
  return newSubpaths;
}

// Fusionar dos segmentos adyacentes (aproximación por promedio)
function mergeTwoSegments(a, b) {
  // Fórmula (decisión e):
  // Nuevo P0 = A.P0
  // Nuevo P3 = B.P3
  // Nuevo P1 = (A.P1 + A.P2 + B.P1) / 3
  // Nuevo P2 = (A.P2 + B.P1 + B.P2) / 3
  const p0 = new Vector2(a.p0.x, a.p0.y);
  const p3 = new Vector2(b.p3.x, b.p3.y);
  const p1 = new Vector2(
    (a.p1.x + a.p2.x + b.p1.x) / 3,
    (a.p1.y + a.p2.y + b.p1.y) / 3
  );
  const p2 = new Vector2(
    (a.p2.x + b.p1.x + b.p2.x) / 3,
    (a.p2.y + b.p1.y + b.p2.y) / 3
  );
  return freezeSegment({ p0, p1, p2, p3 });
}

export class BezierPath {
  #segments;
  #subpaths;

  // BEZ-001
  constructor(path) {
    if (!(path instanceof Path)) {
      throw new InvalidPathError({
        functionId: 'BEZ-001',
        input: { path },
        prevState: null,
        cause: 'path must be a Path instance'
      });
    }
    const { segments, subpaths } = buildSegmentsAndSubpaths(path);
    this.#segments = segments;
    this.#subpaths = subpaths;
  }

  // Constructor interno (para split/normalize)
  static _fromInternal(segments, subpaths) {
    const bp = Object.create(BezierPath.prototype);
    bp.#segments = segments;
    bp.#subpaths = subpaths;
    return bp;
  }

  // BEZ-002
  static fromCommands(commands) {
    // Decisión (g): nunca lanza PathCompatibilityError.
    // Si los comandos son inválidos, Path lanza InvalidPathError.
    const path = new Path(commands);
    return new BezierPath(path);
  }

  segmentCount() {
    return this.#segments.length;
  }

  subpathCount() {
    return this.#subpaths.length;
  }

  // BEZ-003
  getPointAt(segmentIndex, t) {
    validateSegmentIndex(this.#segments, segmentIndex, 'BEZ-003');
    validateT(t, 'BEZ-003');

    const seg = this.#segments[segmentIndex];
    const u = 1 - t;
    const u2 = u * u;
    const u3 = u2 * u;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = u3 * seg.p0.x +
              3 * u2 * t * seg.p1.x +
              3 * u * t2 * seg.p2.x +
              t3 * seg.p3.x;
    const y = u3 * seg.p0.y +
              3 * u2 * t * seg.p1.y +
              3 * u * t2 * seg.p2.y +
              t3 * seg.p3.y;

    return new Vector2(x, y);
  }

  // BEZ-004
  getTangentAt(segmentIndex, t) {
    validateSegmentIndex(this.#segments, segmentIndex, 'BEZ-004');
    validateT(t, 'BEZ-004');

    const seg = this.#segments[segmentIndex];
    const u = 1 - t;

    // B'(t) = 3(1-t)²·(P1-P0) + 6(1-t)t·(P2-P1) + 3t²·(P3-P2)
    const u2 = u * u;
    const t2 = t * t;

    const dx = 3 * u2 * (seg.p1.x - seg.p0.x) +
               6 * u * t * (seg.p2.x - seg.p1.x) +
               3 * t2 * (seg.p3.x - seg.p2.x);
    const dy = 3 * u2 * (seg.p1.y - seg.p0.y) +
               6 * u * t * (seg.p2.y - seg.p1.y) +
               3 * t2 * (seg.p3.y - seg.p2.y);

    // Decisión (c): si tangente cero, devolver Vector2(0, 0)
    return new Vector2(dx, dy);
  }

  // BEZ-005
  split(segmentIndex, t) {
    validateSegmentIndex(this.#segments, segmentIndex, 'BEZ-005');
    validateT(t, 'BEZ-005');

    const seg = this.#segments[segmentIndex];
    const [left, right] = splitSegmentAt(seg, t);

    // bp1: segmentos 0..segmentIndex-1 + left
    const bp1Segments = [
      ...this.#segments.slice(0, segmentIndex),
      left
    ];
    // bp2: right + segmentos segmentIndex+1..N-1
    const bp2Segments = [
      right,
      ...this.#segments.slice(segmentIndex + 1)
    ];

    // Reconstruir subpaths
    const bp1Subpaths = rebuildSubpaths(this.#subpaths, bp1Segments, { segmentIndex, t });
    // Para bp2, los subpaths son los mismos pero con start ajustado
    // (el segmento dividido ahora está en bp2 como primer segmento de su subpath derecho)
    const bp2Subpaths = rebuildSubpathsForSecondHalf(this.#subpaths, segmentIndex);

    return [
      BezierPath._fromInternal(bp1Segments, bp1Subpaths),
      BezierPath._fromInternal(bp2Segments, bp2Subpaths)
    ];
  }

  // BEZ-006
  normalizeSegments(targetCount) {
    if (!Number.isInteger(targetCount) || targetCount <= 0) {
      throw new NormalizationError({
        functionId: 'BEZ-006',
        input: { targetCount },
        prevState: { segmentCount: this.#segments.length },
        cause: 'targetCount must be a positive integer'
      });
    }
    if (this.#segments.length === 0) {
      throw new NormalizationError({
        functionId: 'BEZ-006',
        input: { targetCount },
        prevState: { segmentCount: 0 },
        cause: 'cannot normalize an empty BezierPath'
      });
    }

    let segments = [...this.#segments];
    let subpaths = this.#subpaths.map(sp => Object.freeze({ ...sp }));

    if (targetCount === segments.length) {
      // Nuevo objeto idéntico
      return BezierPath._fromInternal(segments, subpaths);
    }

    if (targetCount > segments.length) {
      // Subdividir los más largos
      while (segments.length < targetCount) {
        const idx = findLongestSegment(segments, subpaths);
        if (idx === -1) {
          throw new NormalizationError({
            functionId: 'BEZ-006',
            input: { targetCount },
            prevState: { segmentCount: segments.length },
            cause: 'cannot subdivide further'
          });
        }
        const seg = segments[idx];
        const [left, right] = splitSegmentAt(seg, 0.5);
        segments.splice(idx, 1, left, right);
        subpaths = rebuildSubpathsAfterSplit(subpaths, idx);
      }
    } else {
      // Fusionar los más pequeños
      while (segments.length > targetCount) {
        const idx = findSmallestAdjacentPair(segments, subpaths);
        if (idx === -1) {
          throw new NormalizationError({
            functionId: 'BEZ-006',
            input: { targetCount },
            prevState: { segmentCount: segments.length },
            cause: 'cannot merge further; all subpaths have single segments'
          });
        }
        const merged = mergeTwoSegments(segments[idx], segments[idx + 1]);
        segments.splice(idx, 2, merged);
        subpaths = rebuildSubpathsAfterMerge(subpaths, idx);
      }
    }

    return BezierPath._fromInternal(segments, subpaths);
  }
  // Método interno para GeometryUtils (no es parte del contrato público)
  // Reconstruye un Path a partir de los segmentos cúbicos internos.
  _toPath() {
    const path = new (require('./Path.js').Path)([]);
    for (const sp of this.#subpaths) {
      if (sp.segmentCount === 0) continue;
      const firstSeg = this.#segments[sp.startSegmentIndex];
      path.moveTo(firstSeg.p0.x, firstSeg.p0.y);
      for (let i = sp.startSegmentIndex; i < sp.startSegmentIndex + sp.segmentCount; i++) {
        const seg = this.#segments[i];
        path.cubicTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
      }
      if (sp.closed) {
        path.close();
      }
    }
    return path;
  }
}

// Helper: encontrar segmento con mayor longitud P0→P3 dentro de subpaths
function findLongestSegment(segments, subpaths) {
  let maxLen = -1;
  let maxIdx = -1;
  for (const sp of subpaths) {
    for (let i = sp.startSegmentIndex; i < sp.startSegmentIndex + sp.segmentCount; i++) {
      const len = chordLength(segments[i]);
      if (len > maxLen) {
        maxLen = len;
        maxIdx = i;
      }
    }
  }
  return maxIdx;
}

// Helper: encontrar par adyacente con menor longitud combinada dentro del mismo subpath
function findSmallestAdjacentPair(segments, subpaths) {
  let minLen = Infinity;
  let minIdx = -1;
  for (const sp of subpaths) {
    // Necesitamos al menos 2 segmentos en el subpath para fusionar
    if (sp.segmentCount < 2) continue;
    for (let i = sp.startSegmentIndex; i < sp.startSegmentIndex + sp.segmentCount - 1; i++) {
      const len = chordLength(segments[i]) + chordLength(segments[i + 1]);
      if (len < minLen) {
        minLen = len;
        minIdx = i;
      }
    }
  }
  return minIdx;
}

// Helper: reconstruir subpaths para la segunda mitad tras split
function rebuildSubpathsForSecondHalf(originalSubpaths, splitIndex) {
  const newSubpaths = [];
  let foundSplit = false;
  for (const sp of originalSubpaths) {
    const spEnd = sp.startSegmentIndex + sp.segmentCount;
    if (!foundSplit && splitIndex >= sp.startSegmentIndex && splitIndex < spEnd) {
      // Este subpath contiene el split
      // La segunda mitad empieza en splitIndex+1 (que es el right)
      const rightStart = splitIndex + 1;
      const rightCount = spEnd - rightStart;
      if (rightCount > 0) {
        newSubpaths.push(Object.freeze({
          closed: false,
          startSegmentIndex: 0, // relativo al nuevo BezierPath
          segmentCount: rightCount
        }));
      }
      foundSplit = true;
    } else if (foundSplit) {
      // Subpaths posteriores: ajustar start
      const offset = -(splitIndex + 1); // los primeros splitIndex+1 segmentos se fueron a bp1
      newSubpaths.push(Object.freeze({
        closed: sp.closed,
        startSegmentIndex: sp.startSegmentIndex + offset,
        segmentCount: sp.segmentCount
      }));
    }
  }
  return newSubpaths;
}