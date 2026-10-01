import { Vector2 } from '../math/Vector2.js';
import { Matrix3x3 } from '../math/Matrix3x3.js';
import { AABB } from '../math/AABB.js';
import { EPSILON_MATH } from '../math/Epsilon.js';
import { Path } from './Path.js';
import { BezierPath } from './BezierPath.js';
import { CommandType } from './CommandType.js';
import { InvalidGeometryError } from '../errors/InvalidGeometryError.js';
import { NormalizationError } from '../errors/NormalizationError.js';
import { InvalidFillRuleError } from '../errors/InvalidFillRuleError.js';

const MAX_RECURSION_DEPTH = 24;

// Caché de orientación (L-GEOU-03)
// WeakMap<Path, { valid: boolean, orientations: number[] }>
const orientationCache = new WeakMap();

// ============================================================
// Helpers internos
// ============================================================

// Convierte comandos de Path a segmentos cúbicos (similar a BezierPath)
function commandsToCubicSegments(commands) {
  const segments = [];
  const subpaths = [];
  let currentX = 0;
  let currentY = 0;
  let hasCurrent = false;
  let currentSubpathStart = 0;
  let currentSubpathSegmentCount = 0;
  let subpathClosed = false;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case CommandType.MOVE_TO: {
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
        if (!hasCurrent) break;
        const p0 = { x: currentX, y: currentY };
        const p3 = { x: cmd.x, y: cmd.y };
        const dx = p3.x - p0.x;
        const dy = p3.y - p0.y;
        const p1 = { x: p0.x + dx / 3, y: p0.y + dy / 3 };
        const p2 = { x: p0.x + 2 * dx / 3, y: p0.y + 2 * dy / 3 };
        segments.push({ p0, p1, p2, p3 });
        currentSubpathSegmentCount++;
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
      case CommandType.QUADRATIC_TO: {
        if (!hasCurrent) break;
        const p0 = { x: currentX, y: currentY };
        const Q = { x: cmd.cx, y: cmd.cy };
        const p3 = { x: cmd.x, y: cmd.y };
        const p1 = {
          x: p0.x + (2 / 3) * (Q.x - p0.x),
          y: p0.y + (2 / 3) * (Q.y - p0.y)
        };
        const p2 = {
          x: p3.x + (2 / 3) * (Q.x - p3.x),
          y: p3.y + (2 / 3) * (Q.y - p3.y)
        };
        segments.push({ p0, p1, p2, p3 });
        currentSubpathSegmentCount++;
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      }
      case CommandType.CUBIC_TO: {
        if (!hasCurrent) break;
        const p0 = { x: currentX, y: currentY };
        const p1 = { x: cmd.c1x, y: cmd.c1y };
        const p2 = { x: cmd.c2x, y: cmd.c2y };
        const p3 = { x: cmd.x, y: cmd.y };
        segments.push({ p0, p1, p2, p3 });
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
        break;
      }
    }
  }

  if (currentSubpathSegmentCount > 0) {
    subpaths.push(Object.freeze({
      closed: subpathClosed,
      startSegmentIndex: currentSubpathStart,
      segmentCount: currentSubpathSegmentCount
    }));
  }

  return { segments, subpaths };
}

// Reconstruye un Path desde segmentos cúbicos y subpaths
function cubicSegmentsToPath(segments, subpaths) {
  const path = new Path([]);
  for (const sp of subpaths) {
    if (sp.segmentCount === 0) continue;
    const firstSeg = segments[sp.startSegmentIndex];
    path.moveTo(firstSeg.p0.x, firstSeg.p0.y);
    for (let i = sp.startSegmentIndex; i < sp.startSegmentIndex + sp.segmentCount; i++) {
      const seg = segments[i];
      path.cubicTo(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y);
    }
    if (sp.closed) {
      path.close();
    }
  }
  return path;
}

// Reconstruye un BezierPath desde segmentos cúbicos y subpaths
function cubicSegmentsToBezierPath(segments, subpaths) {
  // Construimos un Path intermedio y luego el BezierPath
  const path = cubicSegmentsToPath(segments, subpaths);
  return new BezierPath(path);
}

// De Casteljau split de un segmento cúbico en t
function splitSegmentAt(seg, t) {
  const p0 = seg.p0, p1 = seg.p1, p2 = seg.p2, p3 = seg.p3;

  const q0 = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
  const q1 = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  const q2 = { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t };

  const r0 = { x: q0.x + (q1.x - q0.x) * t, y: q0.y + (q1.y - q0.y) * t };
  const r1 = { x: q1.x + (q2.x - q1.x) * t, y: q1.y + (q2.y - q1.y) * t };

  const s0 = { x: r0.x + (r1.x - r0.x) * t, y: r0.y + (r1.y - r0.y) * t };

  const left = { p0, p1: q0, p2: r0, p3: s0 };
  const right = { p0: s0, p1: r1, p2: q2, p3 };
  return [left, right];
}

// Distancia de un punto a una línea definida por dos puntos
function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPSILON_MATH * EPSILON_MATH) {
    const ex = px - x1;
    const ey = py - y1;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1);
  return num / Math.sqrt(lenSq);
}

// Subdivisión adaptativa De Casteljau para segmento cúbico
function subdivideCubic(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, points, depth) {
  if (depth > MAX_RECURSION_DEPTH) {
    points.push({ x: p0x, y: p0y });
    points.push({ x: p1x, y: p1y });
    points.push({ x: p2x, y: p2y });
    points.push({ x: p3x, y: p3y });
    return;
  }

  const d1 = pointToLineDistance(p1x, p1y, p0x, p0y, p3x, p3y);
  const d2 = pointToLineDistance(p2x, p2y, p0x, p0y, p3x, p3y);
  const flatness = Math.max(d1, d2);

  if (flatness <= EPSILON_MATH) {
    points.push({ x: p0x, y: p0y });
    points.push({ x: p3x, y: p3y });
    return;
  }

  const mx01 = (p0x + p1x) / 2;
  const my01 = (p0y + p1y) / 2;
  const mx12 = (p1x + p2x) / 2;
  const my12 = (p1y + p2y) / 2;
  const mx23 = (p2x + p3x) / 2;
  const my23 = (p2y + p3y) / 2;

  const mx012 = (mx01 + mx12) / 2;
  const my012 = (my01 + my12) / 2;
  const mx123 = (mx12 + mx23) / 2;
  const my123 = (my12 + my23) / 2;

  const mxMid = (mx012 + mx123) / 2;
  const myMid = (my012 + my123) / 2;

  subdivideCubic(p0x, p0y, mx01, my01, mx012, my012, mxMid, myMid, points, depth + 1);
  subdivideCubic(mxMid, myMid, mx123, my123, mx23, my23, p3x, p3y, points, depth + 1);
}

// Distancia de un punto a un segmento de línea
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPSILON_MATH * EPSILON_MATH) {
    const ex = px - x1;
    const ey = py - y1;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

// Verifica si un punto está en el borde de un segmento cúbico
// (distancia <= EPSILON_MATH)
function isPointOnCubicSegment(px, py, seg) {
  const points = [];
  subdivideCubic(
    seg.p0.x, seg.p0.y,
    seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y,
    seg.p3.x, seg.p3.y,
    points, 0
  );
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(
      px, py,
      points[i].x, points[i].y,
      points[i + 1].x, points[i + 1].y
    );
    if (d <= EPSILON_MATH) {
      return true;
    }
  }
  return false;
}

// Signed area de un subpath (positivo = horario en coords de pantalla)
function signedAreaOfSubpath(segments, subpath) {
  let area = 0;
  const startIdx = subpath.startSegmentIndex;
  const endIdx = startIdx + subpath.segmentCount;

  for (let i = startIdx; i < endIdx; i++) {
    const seg = segments[i];
    // Aproximación: usar P0 y P3 del segmento
    area += (seg.p0.x * seg.p3.y - seg.p3.x * seg.p0.y);
  }

  // Cierre implícito si el subpath no está cerrado
  if (!subpath.closed && subpath.segmentCount > 0) {
    const firstSeg = segments[startIdx];
    const lastSeg = segments[endIdx - 1];
    area += (lastSeg.p3.x * firstSeg.p0.y - firstSeg.p0.x * lastSeg.p3.y);
  }

  return area / 2;
}

// Valida orientación de subpaths para "nonzero" (ADR-004-D5)
// Retorna { valid: boolean, orientations: number[] }
function validateOrientations(path) {
  // Verificar caché (L-GEOU-03)
  if (orientationCache.has(path)) {
    return orientationCache.get(path);
  }

  const commands = path.getCommands();
  const { segments, subpaths } = commandsToCubicSegments(commands);

  if (subpaths.length <= 1) {
    const result = { valid: true, orientations: [] };
    orientationCache.set(path, result);
    return result;
  }

  const orientations = subpaths.map(sp => signedAreaOfSubpath(segments, sp));

  // Verificar si todos tienen el mismo signo
  let hasPositive = false;
  let hasNegative = false;
  for (const o of orientations) {
    if (Math.abs(o) > EPSILON_MATH) {
      if (o > 0) hasPositive = true;
      if (o < 0) hasNegative = true;
    }
  }

  // Si todos tienen el mismo signo (exclusivamente), es inválido
  const allSameSign = (hasPositive && !hasNegative) || (!hasPositive && hasNegative);

  const result = { valid: !allSameSign, orientations };
  orientationCache.set(path, result);
  return result;
}

// Cuenta cruces del rayo horizontal hacia +x desde (px, py)
// con los segmentos del path (decisión d: regla de lados opuestos)
function countRayCrossings(px, py, segments, subpaths) {
  let crossings = 0;
  let winding = 0;

  for (const sp of subpaths) {
    const startIdx = sp.startSegmentIndex;
    const endIdx = startIdx + sp.segmentCount;

    // Subdividir cada segmento en puntos lineales
    const polyline = [];
    for (let i = startIdx; i < endIdx; i++) {
      const seg = segments[i];
      const points = [];
      subdivideCubic(
        seg.p0.x, seg.p0.y,
        seg.p1.x, seg.p1.y,
        seg.p2.x, seg.p2.y,
        seg.p3.x, seg.p3.y,
        points, 0
      );
      // Agregar puntos evitando duplicados en uniones
      if (polyline.length === 0) {
        polyline.push(...points);
      } else {
        // Saltar el primer punto (ya está en el último de la iteración anterior)
        for (let j = 1; j < points.length; j++) {
          polyline.push(points[j]);
        }
      }
    }

    // Cierre implícito (decisión h)
    if (!sp.closed && polyline.length > 0) {
      polyline.push({ x: polyline[0].x, y: polyline[0].y });
    }

    // Contar cruces con regla de lados opuestos (decisión d)
    for (let i = 0; i < polyline.length - 1; i++) {
      const y1 = polyline[i].y;
      const y2 = polyline[i + 1].y;

      // Un segmento cruza el rayo si uno está por debajo y otro por encima (o igual)
      // Regla: y1 < py <= y2 o y2 < py <= y1
      if ((y1 < py && y2 >= py) || (y2 < py && y1 >= py)) {
        // Calcular x del cruce
        const t = (py - y1) / (y2 - y1);
        const xCross = polyline[i].x + t * (polyline[i + 1].x - polyline[i].x);
        if (xCross > px) {
          crossings++;
          // Winding: +1 si sube, -1 si baja
          if (y2 > y1) winding++;
          else if (y2 < y1) winding--;
        }
      }
    }
  }

  return { crossings, winding };
}

// ============================================================
// Funciones públicas
// ============================================================

// GEOU-001
export function computePathBounds(path) {
  if (!(path instanceof Path)) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-001',
      input: { path },
      prevState: null,
      cause: 'path must be a Path instance'
    });
  }
  return path.getBounds();
}

// GEOU-002
export function interpolatePath(pathA, pathB, t) {
  // Validación de tipos
  const aIsPath = pathA instanceof Path;
  const aIsBezier = pathA instanceof BezierPath;
  const bIsPath = pathB instanceof Path;
  const bIsBezier = pathB instanceof BezierPath;

  if (!aIsPath && !aIsBezier) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-002',
      input: { pathA, pathB, t },
      prevState: null,
      cause: 'pathA must be a Path or BezierPath'
    });
  }
  if (!bIsPath && !bIsBezier) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-002',
      input: { pathA, pathB, t },
      prevState: null,
      cause: 'pathB must be a Path or BezierPath'
    });
  }
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-002',
      input: { pathA, pathB, t },
      prevState: null,
      cause: `t must be in [0, 1], got ${t}`
    });
  }

  // Convertir ambos a segmentos cúbicos
  let segmentsA, subpathsA, segmentsB, subpathsB;

  if (aIsPath) {
    const result = commandsToCubicSegments(pathA.getCommands());
    segmentsA = result.segments;
    subpathsA = result.subpaths;
  } else {
    // BezierPath: necesitamos acceder a sus segmentos.
    // Como BezierPath no expone sus segmentos públicamente,
    // usamos un truco: reconstruimos desde getPointAt.
    // Alternativa: añadir _getSegments() a BezierPath.
    // Por ahora, usamos la conversión vía Path intermedio.
    // Esto es ineficiente pero correcto.
    // NOTA: esto requiere que BezierPath tenga un método para
    // reconstruirse como Path. Añadimos _toPath() a BezierPath.
    const pathFromBezier = pathA._toPath();
    const result = commandsToCubicSegments(pathFromBezier.getCommands());
    segmentsA = result.segments;
    subpathsA = result.subpaths;
  }

  if (bIsPath) {
    const result = commandsToCubicSegments(pathB.getCommands());
    segmentsB = result.segments;
    subpathsB = result.subpaths;
  } else {
    const pathFromBezier = pathB._toPath();
    const result = commandsToCubicSegments(pathFromBezier.getCommands());
    segmentsB = result.segments;
    subpathsB = result.subpaths;
  }

  // Decisión (b): si alguno tiene 0 segmentos → NormalizationError
  if (segmentsA.length === 0 || segmentsB.length === 0) {
    throw new NormalizationError({
      functionId: 'GEOU-002',
      input: { pathA, pathB, t },
      prevState: {
        segmentCountA: segmentsA.length,
        segmentCountB: segmentsB.length
      },
      cause: 'cannot interpolate from or to an empty path'
    });
  }

  // Normalización si segmentCount difiere (L-GEOU-02)
  const targetCount = Math.max(segmentsA.length, segmentsB.length);

  if (segmentsA.length !== targetCount) {
    const bpA = cubicSegmentsToBezierPath(segmentsA, subpathsA);
    const normalized = bpA.normalizeSegments(targetCount);
    const pathNorm = normalized._toPath();
    const result = commandsToCubicSegments(pathNorm.getCommands());
    segmentsA = result.segments;
    subpathsA = result.subpaths;
  }

  if (segmentsB.length !== targetCount) {
    const bpB = cubicSegmentsToBezierPath(segmentsB, subpathsB);
    const normalized = bpB.normalizeSegments(targetCount);
    const pathNorm = normalized._toPath();
    const result = commandsToCubicSegments(pathNorm.getCommands());
    segmentsB = result.segments;
    subpathsB = result.subpaths;
  }

  // Interpolar segmento por segmento
  const interpolatedSegments = [];
  for (let i = 0; i < targetCount; i++) {
    const a = segmentsA[i];
    const b = segmentsB[i];
    const u = 1 - t;
    interpolatedSegments.push({
      p0: { x: u * a.p0.x + t * b.p0.x, y: u * a.p0.y + t * b.p0.y },
      p1: { x: u * a.p1.x + t * b.p1.x, y: u * a.p1.y + t * b.p1.y },
      p2: { x: u * a.p2.x + t * b.p2.x, y: u * a.p2.y + t * b.p2.y },
      p3: { x: u * a.p3.x + t * b.p3.x, y: u * a.p3.y + t * b.p3.y }
    });
  }

  // Reconstruir geometría del tipo de pathA (L-GEOU-01)
  if (aIsPath) {
    return cubicSegmentsToPath(interpolatedSegments, subpathsA);
  } else {
    return cubicSegmentsToBezierPath(interpolatedSegments, subpathsA);
  }
}

// GEOU-003
export function pointInPath(path, point, fillRule) {
  if (!(path instanceof Path)) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-003',
      input: { path, point, fillRule },
      prevState: null,
      cause: 'path must be a Path instance'
    });
  }
  if (!(point instanceof Vector2)) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-003',
      input: { path, point, fillRule },
      prevState: null,
      cause: 'point must be a Vector2'
    });
  }
  if (fillRule !== 'nonzero' && fillRule !== 'evenodd') {
    throw new InvalidFillRuleError({
      functionId: 'GEOU-003',
      input: { path, point, fillRule },
      prevState: null,
      cause: `fillRule must be "nonzero" or "evenodd", got ${fillRule}`
    });
  }

  const commands = path.getCommands();
  if (commands.length === 0) {
    return false;
  }

  const { segments, subpaths } = commandsToCubicSegments(commands);
  if (segments.length === 0) {
    return false;
  }

  // Validación de orientación para "nonzero" (ADR-004-D5)
  if (fillRule === 'nonzero' && subpaths.length > 1) {
    const validation = validateOrientations(path);
    if (!validation.valid) {
      throw new InvalidFillRuleError({
        functionId: 'GEOU-003',
        input: { path, point, fillRule },
        prevState: { subpathCount: subpaths.length },
        cause: 'all subpaths have the same orientation; nonzero requires mixed orientations for holes'
      });
    }
  }

  // Paso 1: verificar si el punto está en el borde (decisión c)
  for (const seg of segments) {
    if (isPointOnCubicSegment(point.x, point.y, seg)) {
      return true;
    }
  }

  // Paso 2: aplicar fillRule
  const { crossings, winding } = countRayCrossings(point.x, point.y, segments, subpaths);

  if (fillRule === 'evenodd') {
    return crossings % 2 === 1;
  } else {
    // nonzero
    return winding !== 0;
  }
}

// GEOU-004
export function transformGeometry(geometry, matrix) {
  // Decisiones (e)(f): sólo Path es soportado
  if (geometry instanceof Path === false) {
    // Verificar si es Circle o BezierPath para dar mensaje específico
    let cause = 'geometry must be a Path instance';
    if (typeof geometry === 'object' && geometry !== null) {
      if (geometry.constructor && geometry.constructor.name === 'Circle') {
        cause = 'Circle is not supported by transformGeometry; convert to Path first';
      } else if (geometry.constructor && geometry.constructor.name === 'BezierPath') {
        cause = 'BezierPath is not supported by transformGeometry; convert to Path first';
      }
    }
    throw new InvalidGeometryError({
      functionId: 'GEOU-004',
      input: { geometry, matrix },
      prevState: null,
      cause
    });
  }
  if (!(matrix instanceof Matrix3x3)) {
    throw new InvalidGeometryError({
      functionId: 'GEOU-004',
      input: { geometry, matrix },
      prevState: null,
      cause: 'matrix must be a Matrix3x3 instance'
    });
  }

  const commands = geometry.getCommands();
  const newCommands = [];

  for (const cmd of commands) {
    switch (cmd.type) {
      case CommandType.MOVE_TO: {
        const p = matrix.transformPoint(new Vector2(cmd.x, cmd.y));
        newCommands.push(Object.freeze({ type: CommandType.MOVE_TO, x: p.x, y: p.y }));
        break;
      }
      case CommandType.LINE_TO: {
        const p = matrix.transformPoint(new Vector2(cmd.x, cmd.y));
        newCommands.push(Object.freeze({ type: CommandType.LINE_TO, x: p.x, y: p.y }));
        break;
      }
      case CommandType.QUADRATIC_TO: {
        const c = matrix.transformPoint(new Vector2(cmd.cx, cmd.cy));
        const p = matrix.transformPoint(new Vector2(cmd.x, cmd.y));
        newCommands.push(Object.freeze({
          type: CommandType.QUADRATIC_TO,
          cx: c.x, cy: c.y, x: p.x, y: p.y
        }));
        break;
      }
      case CommandType.CUBIC_TO: {
        const c1 = matrix.transformPoint(new Vector2(cmd.c1x, cmd.c1y));
        const c2 = matrix.transformPoint(new Vector2(cmd.c2x, cmd.c2y));
        const p = matrix.transformPoint(new Vector2(cmd.x, cmd.y));
        newCommands.push(Object.freeze({
          type: CommandType.CUBIC_TO,
          c1x: c1.x, c1y: c1.y,
          c2x: c2.x, c2y: c2.y,
          x: p.x, y: p.y
        }));
        break;
      }
      case CommandType.CLOSE: {
        // CLOSE no tiene coordenadas; se copia sin cambios
        newCommands.push(Object.freeze({ type: CommandType.CLOSE }));
        break;
      }
    }
  }

  return new Path(newCommands);
}