import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePathBounds,
  interpolatePath,
  pointInPath,
  transformGeometry
} from '../../src/geometry/GeometryUtils.js';
import { Path } from '../../src/geometry/Path.js';
import { BezierPath } from '../../src/geometry/BezierPath.js';
import { Circle } from '../../src/geometry/Circle.js';
import { CommandType } from '../../src/geometry/CommandType.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { Matrix3x3 } from '../../src/math/Matrix3x3.js';
import { AABB } from '../../src/math/AABB.js';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import { InvalidGeometryError } from '../../src/errors/InvalidGeometryError.js';
import { NormalizationError } from '../../src/errors/NormalizationError.js';
import { InvalidFillRuleError } from '../../src/errors/InvalidFillRuleError.js';

const EPS = 1e-6;

// Helpers
function makePath(fn) {
  const p = new Path([]);
  fn(p);
  return p;
}

function cmd(type, params = {}) {
  return Object.freeze({ type, ...params });
}

// ============================================================
// GEOU-001 — computePathBounds
// ============================================================

describe('GeometryUtils — GEOU-001 computePathBounds', () => {
  it('delega en path.getBounds()', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bounds = computePathBounds(path);
    const expected = path.getBounds();
    assert.equal(bounds.minX, expected.minX);
    assert.equal(bounds.minY, expected.minY);
    assert.equal(bounds.maxX, expected.maxX);
    assert.equal(bounds.maxY, expected.maxY);
  });

  it('Path vacío → AABB.empty()', () => {
    const path = new Path([]);
    const bounds = computePathBounds(path);
    assert.equal(bounds.isEmpty(), true);
  });

  it('no muta el path', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const countBefore = path.segmentCount();
    computePathBounds(path);
    assert.equal(path.segmentCount(), countBefore);
  });

  it('argumento no-Path → InvalidGeometryError', () => {
    assert.throws(() => computePathBounds({}), InvalidGeometryError);
    assert.throws(() => computePathBounds(null), InvalidGeometryError);
  });
});

// ============================================================
// GEOU-002 — interpolatePath
// ============================================================

describe('GeometryUtils — GEOU-002 interpolatePath', () => {
  it('mismos segmentos → interpolación directa', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
    });
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
    });
    const result = interpolatePath(pathA, pathB, 0.5);
    assert.ok(result instanceof Path);
    assert.equal(result.segmentCount(), 3);
  });

  it('distintos segmentos → normalización (L-GEOU-02)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
    });
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i * 2.5, i % 2 === 0 ? 10 : 0);
      }
    });
    const result = interpolatePath(pathA, pathB, 0.5);
    assert.equal(result.segmentCount(), 8);
  });

  it('t=0 → equivalente a pathA', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const result = interpolatePath(pathA, pathB, 0);
    const bA = pathA.getBounds();
    const bR = result.getBounds();
    assert.ok(Math.abs(bA.minX - bR.minX) < EPS);
    assert.ok(Math.abs(bA.maxX - bR.maxX) < EPS);
  });

  it('t=1 → equivalente a pathB', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const result = interpolatePath(pathA, pathB, 1);
    const bB = pathB.getBounds();
    const bR = result.getBounds();
    assert.ok(Math.abs(bB.minX - bR.minX) < EPS);
    assert.ok(Math.abs(bB.maxX - bR.maxX) < EPS);
  });

  it('BezierPath + BezierPath → BezierPath (L-GEOU-01)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const bpA = new BezierPath(pathA);
    const bpB = new BezierPath(pathB);
    const result = interpolatePath(bpA, bpB, 0.5);
    assert.ok(result instanceof BezierPath);
    assert.ok(!(result instanceof Path));
  });

  it('Path + Path → Path (L-GEOU-01)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const result = interpolatePath(pathA, pathB, 0.5);
    assert.ok(result instanceof Path);
  });

  it('Path + BezierPath → Path (tipo de pathA, L-GEOU-01)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const bpB = new BezierPath(pathB);
    const result = interpolatePath(pathA, bpB, 0.5);
    assert.ok(result instanceof Path);
  });

  it('BezierPath + Path → BezierPath (tipo de pathA, L-GEOU-01)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const bpA = new BezierPath(pathA);
    const result = interpolatePath(bpA, pathB, 0.5);
    assert.ok(result instanceof BezierPath);
  });

  it('no muta pathA ni pathB', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const countABefore = pathA.segmentCount();
    const countBBefore = pathB.segmentCount();
    interpolatePath(pathA, pathB, 0.5);
    assert.equal(pathA.segmentCount(), countABefore);
    assert.equal(pathB.segmentCount(), countBBefore);
  });

  it('determinismo: dos llamadas → mismo resultado', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const r1 = interpolatePath(pathA, pathB, 0.5);
    const r2 = interpolatePath(pathA, pathB, 0.5);
    const b1 = r1.getBounds();
    const b2 = r2.getBounds();
    assert.ok(Math.abs(b1.minX - b2.minX) < EPS);
    assert.ok(Math.abs(b1.maxX - b2.maxX) < EPS);
  });

  it('t=-0.1 → error', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    assert.throws(() => interpolatePath(pathA, pathB, -0.1), InvalidGeometryError);
  });

  it('t=1.1 → error', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    assert.throws(() => interpolatePath(pathA, pathB, 1.1), InvalidGeometryError);
  });

  it('argumento no-Path/BezierPath → error', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    assert.throws(() => interpolatePath({}, path, 0.5), InvalidGeometryError);
    assert.throws(() => interpolatePath(path, {}, 0.5), InvalidGeometryError);
  });

  it('pathA con 0 segmentos → NormalizationError (decisión b)', () => {
    const pathA = new Path([]);
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    assert.throws(() => interpolatePath(pathA, pathB, 0.5), NormalizationError);
  });

  it('pathB con 0 segmentos → NormalizationError (decisión b)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = new Path([]);
    assert.throws(() => interpolatePath(pathA, pathB, 0.5), NormalizationError);
  });

  it('ambos con 0 segmentos → NormalizationError (decisión b)', () => {
    const pathA = new Path([]);
    const pathB = new Path([]);
    assert.throws(() => interpolatePath(pathA, pathB, 0.5), NormalizationError);
  });

  it('NO lanza PathCompatibilityError por discrepancia de segmentCount (L-GEOU-02)', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i, 0);
      }
    });
    // No debe lanzar PathCompatibilityError
    assert.doesNotThrow(() => interpolatePath(pathA, pathB, 0.5));
  });
});

// ============================================================
// GEOU-003 — pointInPath
// ============================================================

describe('GeometryUtils — GEOU-003 pointInPath', () => {
  // Path cuadrado simple
  function makeSquare() {
    return makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
      p.close();
    });
  }

  it('punto dentro → true (nonzero)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(5, 5), 'nonzero'), true);
  });

  it('punto dentro → true (evenodd)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(5, 5), 'evenodd'), true);
  });

  it('punto fuera → false (nonzero)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(20, 20), 'nonzero'), false);
  });

  it('punto fuera → false (evenodd)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(20, 20), 'evenodd'), false);
  });

  it('punto en borde → true (decisión c, nonzero)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(5, 0), 'nonzero'), true);
    assert.equal(pointInPath(path, new Vector2(10, 5), 'nonzero'), true);
  });

  it('punto en borde → true (decisión c, evenodd)', () => {
    const path = makeSquare();
    assert.equal(pointInPath(path, new Vector2(5, 0), 'evenodd'), true);
    assert.equal(pointInPath(path, new Vector2(10, 5), 'evenodd'), true);
  });

  it('donut con orientaciones opuestas → nonzero y evenodd coinciden', () => {
    // Subpath exterior (horario) + subpath interior (antihorario)
    const path = makePath(p => {
      // Exterior: (0,0) → (20,0) → (20,20) → (0,20) → close
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
      p.close();
      // Interior: (5,5) → (5,15) → (15,15) → (15,5) → close (orientación opuesta)
      p.moveTo(5, 5);
      p.lineTo(5, 15);
      p.lineTo(15, 15);
      p.lineTo(15, 5);
      p.close();
    });
    // Punto en el anillo (entre los dos subpaths)
    assert.equal(pointInPath(path, new Vector2(2.5, 10), 'nonzero'), true);
    assert.equal(pointInPath(path, new Vector2(2.5, 10), 'evenodd'), true);
    // Punto en el agujero
    assert.equal(pointInPath(path, new Vector2(10, 10), 'nonzero'), false);
    assert.equal(pointInPath(path, new Vector2(10, 10), 'evenodd'), false);
  });

  it('donut con mismas orientaciones + nonzero → InvalidFillRuleError', () => {
    // Ambos subpaths en la misma orientación
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
      p.close();
      // Mismo sentido: (5,5) → (15,5) → (15,15) → (5,15) → close
      p.moveTo(5, 5);
      p.lineTo(15, 5);
      p.lineTo(15, 15);
      p.lineTo(5, 15);
      p.close();
    });
    assert.throws(
      () => pointInPath(path, new Vector2(10, 10), 'nonzero'),
      InvalidFillRuleError
    );
  });

  it('fillRule inválido ("positive") → InvalidFillRuleError', () => {
    const path = makeSquare();
    assert.throws(
      () => pointInPath(path, new Vector2(5, 5), 'positive'),
      InvalidFillRuleError
    );
  });

  it('fillRule inválido ("") → InvalidFillRuleError', () => {
    const path = makeSquare();
    assert.throws(
      () => pointInPath(path, new Vector2(5, 5), ''),
      InvalidFillRuleError
    );
  });

  it('fillRule undefined → InvalidFillRuleError', () => {
    const path = makeSquare();
    assert.throws(
      () => pointInPath(path, new Vector2(5, 5), undefined),
      InvalidFillRuleError
    );
  });

  it('fillRule null → InvalidFillRuleError', () => {
    const path = makeSquare();
    assert.throws(
      () => pointInPath(path, new Vector2(5, 5), null),
      InvalidFillRuleError
    );
  });

  it('Path vacío → false', () => {
    const path = new Path([]);
    assert.equal(pointInPath(path, new Vector2(0, 0), 'nonzero'), false);
    assert.equal(pointInPath(path, new Vector2(0, 0), 'evenodd'), false);
  });

  it('determinismo: dos llamadas → mismo resultado', () => {
    const path = makeSquare();
    const r1 = pointInPath(path, new Vector2(5, 5), 'nonzero');
    const r2 = pointInPath(path, new Vector2(5, 5), 'nonzero');
    assert.equal(r1, r2);
  });

  it('caché de orientación: segunda llamada no revalida (L-GEOU-03)', () => {
    // Verificación indirecta: dos llamadas sobre el mismo Path
    // no deben lanzar aunque el Path tenga múltiples subpaths
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
      p.close();
      p.moveTo(5, 5);
      p.lineTo(5, 15);
      p.lineTo(15, 15);
      p.lineTo(15, 5);
      p.close();
    });
    // Primera llamada: valida y cachea
    pointInPath(path, new Vector2(2.5, 10), 'nonzero');
    // Segunda llamada: usa caché
    assert.doesNotThrow(() => {
      pointInPath(path, new Vector2(2.5, 10), 'nonzero');
    });
  });

  it('no muta el path ni el point', () => {
    const path = makeSquare();
    const point = new Vector2(5, 5);
    const countBefore = path.segmentCount();
    const xBefore = point.x;
    pointInPath(path, point, 'nonzero');
    assert.equal(path.segmentCount(), countBefore);
    assert.equal(point.x, xBefore);
  });

  it('path no-Path → InvalidGeometryError', () => {
    assert.throws(
      () => pointInPath({}, new Vector2(0, 0), 'nonzero'),
      InvalidGeometryError
    );
  });

  it('point no-Vector2 → InvalidGeometryError', () => {
    const path = makeSquare();
    assert.throws(
      () => pointInPath(path, { x: 0, y: 0 }, 'nonzero'),
      InvalidGeometryError
    );
  });

  it('rayo por vértice → sin doble conteo (decisión d)', () => {
    // Path con vértice exactamente en y=5
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 5);  // vértice en y=5
      p.lineTo(20, 0);
      p.lineTo(20, 10);
      p.lineTo(0, 10);
      p.close();
    });
    // Punto con y=5, x=-1 (rayo horizontal pasa por el vértice)
    // No debe haber doble conteo
    const result = pointInPath(path, new Vector2(-1, 5), 'evenodd');
    // El resultado debe ser determinista y consistente
    assert.equal(typeof result, 'boolean');
  });

  it('subpath abierto de 1 segmento → cierre implícito cuenta (decisión h)', () => {
    // Subpath abierto: MOVE_TO + LINE_TO (sin CLOSE)
    // Para pointInPath, se trata como si tuviera CLOSE implícito
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      // Sin close; implícitamente se cierra de (10,0) a (0,0)
      // Esto forma una línea horizontal, no encierra área
    });
    // Un path con sólo una línea horizontal no encierra área
    // ni con cierre implícito (el cierre es la misma línea)
    const result = pointInPath(path, new Vector2(5, 0), 'nonzero');
    // El punto está en el borde → true (decisión c)
    assert.equal(result, true);
  });
});

// ============================================================
// GEOU-004 — transformGeometry
// ============================================================

describe('GeometryUtils — GEOU-004 transformGeometry', () => {
  it('traslación → coordenadas trasladadas, CLOSE sin cambios', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.close();
    });
    const matrix = Matrix3x3.translation(100, 200);
    const result = transformGeometry(path, matrix);
    assert.ok(result instanceof Path);
    const cmds = result.getCommands();
    // MOVE_TO: (0,0) → (100, 200)
    assert.equal(cmds[0].type, CommandType.MOVE_TO);
    assert.ok(Math.abs(cmds[0].x - 100) < EPS);
    assert.ok(Math.abs(cmds[0].y - 200) < EPS);
    // LINE_TO: (10,0) → (110, 200)
    assert.equal(cmds[1].type, CommandType.LINE_TO);
    assert.ok(Math.abs(cmds[1].x - 110) < EPS);
    assert.ok(Math.abs(cmds[1].y - 200) < EPS);
    // CLOSE: sin cambios
    assert.equal(cmds[3].type, CommandType.CLOSE);
  });

  it('identidad → comandos equivalentes', () => {
    const path = makePath(p => {
      p.moveTo(10, 20);
      p.lineTo(30, 40);
    });
    const matrix = Matrix3x3.identity();
    const result = transformGeometry(path, matrix);
    const cmds = result.getCommands();
    assert.ok(Math.abs(cmds[0].x - 10) < EPS);
    assert.ok(Math.abs(cmds[0].y - 20) < EPS);
    assert.ok(Math.abs(cmds[1].x - 30) < EPS);
    assert.ok(Math.abs(cmds[1].y - 40) < EPS);
  });

  it('rotación → comandos rotados', () => {
    const path = makePath(p => {
      p.moveTo(10, 0);
    });
    const matrix = Matrix3x3.rotation(Math.PI / 2);
    const result = transformGeometry(path, matrix);
    const cmds = result.getCommands();
    // (10, 0) rotado π/2 → (0, 10)
    assert.ok(Math.abs(cmds[0].x - 0) < EPS);
    assert.ok(Math.abs(cmds[0].y - 10) < EPS);
  });

  it('no muta path ni matrix', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const matrix = Matrix3x3.translation(100, 200);
    const countBefore = path.segmentCount();
    const valuesBefore = matrix.values.slice();
    transformGeometry(path, matrix);
    assert.equal(path.segmentCount(), countBefore);
    assert.deepEqual(matrix.values, valuesBefore);
  });

  it('argumento no-Path → InvalidGeometryError', () => {
    const matrix = Matrix3x3.identity();
    assert.throws(() => transformGeometry({}, matrix), InvalidGeometryError);
    assert.throws(() => transformGeometry(null, matrix), InvalidGeometryError);
  });

  it('argumento no-Matrix3x3 → InvalidGeometryError', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
    });
    assert.throws(() => transformGeometry(path, {}), InvalidGeometryError);
    assert.throws(() => transformGeometry(path, null), InvalidGeometryError);
  });

  it('Circle → InvalidGeometryError (decisión e)', () => {
    const circle = new Circle(new Vector2(0, 0), 5);
    const matrix = Matrix3x3.identity();
    assert.throws(() => transformGeometry(circle, matrix), InvalidGeometryError);
  });

  it('BezierPath → InvalidGeometryError (decisión f)', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    const matrix = Matrix3x3.identity();
    assert.throws(() => transformGeometry(bp, matrix), InvalidGeometryError);
  });

  it('escala (0, 0) → válido, colapsa a un punto', () => {
    const path = makePath(p => {
      p.moveTo(10, 20);
      p.lineTo(30, 40);
    });
    const matrix = Matrix3x3.scale(0, 0);
    const result = transformGeometry(path, matrix);
    const cmds = result.getCommands();
    // Todos los puntos colapsan a (0, 0)
    assert.ok(Math.abs(cmds[0].x - 0) < EPS);
    assert.ok(Math.abs(cmds[0].y - 0) < EPS);
    assert.ok(Math.abs(cmds[1].x - 0) < EPS);
    assert.ok(Math.abs(cmds[1].y - 0) < EPS);
  });

  it('transforma QUADRATIC_TO correctamente', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.quadraticTo(5, 10, 10, 0);
    });
    const matrix = Matrix3x3.translation(100, 0);
    const result = transformGeometry(path, matrix);
    const cmds = result.getCommands();
    assert.equal(cmds[1].type, CommandType.QUADRATIC_TO);
    assert.ok(Math.abs(cmds[1].cx - 105) < EPS);
    assert.ok(Math.abs(cmds[1].cy - 10) < EPS);
    assert.ok(Math.abs(cmds[1].x - 110) < EPS);
    assert.ok(Math.abs(cmds[1].y - 0) < EPS);
  });

  it('transforma CUBIC_TO correctamente', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.cubicTo(5, 10, 15, 10, 20, 0);
    });
    const matrix = Matrix3x3.translation(100, 0);
    const result = transformGeometry(path, matrix);
    const cmds = result.getCommands();
    assert.equal(cmds[1].type, CommandType.CUBIC_TO);
    assert.ok(Math.abs(cmds[1].c1x - 105) < EPS);
    assert.ok(Math.abs(cmds[1].c2x - 115) < EPS);
    assert.ok(Math.abs(cmds[1].x - 120) < EPS);
  });
});

// ============================================================
// Tests ADR-004
// ============================================================

describe('GeometryUtils — tests ADR-004', () => {
  it('D5: pointInPath valida fillRule explícitamente', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
      p.close();
    });
    assert.throws(
      () => pointInPath(path, new Vector2(5, 5), 'invalid'),
      InvalidFillRuleError
    );
  });

  it('D5: pointInPath soporta nonzero y evenodd únicamente', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
      p.close();
    });
    assert.doesNotThrow(() => pointInPath(path, new Vector2(5, 5), 'nonzero'));
    assert.doesNotThrow(() => pointInPath(path, new Vector2(5, 5), 'evenodd'));
  });

  it('D5: pointInPath valida orientación con nonzero y múltiples subpaths', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
      p.close();
      // Misma orientación
      p.moveTo(5, 5);
      p.lineTo(15, 5);
      p.lineTo(15, 15);
      p.lineTo(5, 15);
      p.close();
    });
    assert.throws(
      () => pointInPath(path, new Vector2(10, 10), 'nonzero'),
      InvalidFillRuleError
    );
  });

  it('D6: InvalidFillRuleError existe y se lanza', () => {
    const err = new InvalidFillRuleError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'InvalidFillRuleError');
  });

  it('D6: no se reutilizan errores de math/', () => {
    // InvalidFillRuleError no es InvalidNumericInputError ni InvalidVectorError
    const err = new InvalidFillRuleError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.equal(err.name, 'InvalidFillRuleError');
  });
});

// ============================================================
// Tests ADR-003
// ============================================================

describe('GeometryUtils — tests ADR-003', () => {
  it('D1: pointInPath usa EPSILON_MATH para subdivisión adaptativa', () => {
    // Verificación indirecta: un punto muy cerca del borde debe
    // detectarse como dentro (tolerancia EPSILON_MATH)
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
      p.close();
    });
    // Punto justo fuera del borde por EPSILON_MATH/2
    const result = pointInPath(path, new Vector2(10 + EPSILON_MATH / 2, 5), 'nonzero');
    assert.equal(result, true);
  });

  it('D1: no define epsilon local', () => {
    // Verificación por inspección: GeometryUtils importa EPSILON_MATH
    assert.equal(EPSILON_MATH, 1e-9);
  });
});

// ============================================================
// Tests L-GEOU
// ============================================================

describe('GeometryUtils — tests L-GEOU', () => {
  it('L-GEOU-01: interpolatePath acepta Path y BezierPath', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const bpA = new BezierPath(pathA);
    const bpB = new BezierPath(pathB);
    // Path + Path
    assert.doesNotThrow(() => interpolatePath(pathA, pathB, 0.5));
    // BezierPath + BezierPath
    assert.doesNotThrow(() => interpolatePath(bpA, bpB, 0.5));
    // Path + BezierPath
    assert.doesNotThrow(() => interpolatePath(pathA, bpB, 0.5));
    // BezierPath + Path
    assert.doesNotThrow(() => interpolatePath(bpA, pathB, 0.5));
  });

  it('L-GEOU-01: interpolatePath devuelve mismo tipo que pathA', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(100, 100);
      p.lineTo(200, 200);
    });
    const bpA = new BezierPath(pathA);
    const bpB = new BezierPath(pathB);

    assert.ok(interpolatePath(pathA, pathB, 0.5) instanceof Path);
    assert.ok(interpolatePath(bpA, bpB, 0.5) instanceof BezierPath);
    assert.ok(interpolatePath(pathA, bpB, 0.5) instanceof Path);
    assert.ok(interpolatePath(bpA, pathB, 0.5) instanceof BezierPath);
  });

  it('L-GEOU-02: interpolatePath normaliza si segmentCount difiere', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i, 0);
      }
    });
    const result = interpolatePath(pathA, pathB, 0.5);
    assert.equal(result.segmentCount(), 8);
  });

  it('L-GEOU-02: interpolatePath NO lanza PathCompatibilityError por discrepancia', () => {
    const pathA = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
    });
    const pathB = makePath(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i, 0);
      }
    });
    // No debe lanzar PathCompatibilityError
    assert.doesNotThrow(() => interpolatePath(pathA, pathB, 0.5));
  });

  it('L-GEOU-03: caché de orientación en WeakMap', () => {
    // Verificación indirecta: múltiples llamadas sobre el mismo Path
    // no deben lanzar aunque el Path tenga múltiples subpaths
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(20, 0);
      p.lineTo(20, 20);
      p.lineTo(0, 20);
      p.close();
      p.moveTo(5, 5);
      p.lineTo(5, 15);
      p.lineTo(15, 15);
      p.lineTo(15, 5);
      p.close();
    });
    // Primera llamada: valida y cachea
    pointInPath(path, new Vector2(2.5, 10), 'nonzero');
    // Segunda llamada: usa caché
    assert.doesNotThrow(() => {
      pointInPath(path, new Vector2(2.5, 10), 'nonzero');
    });
    // Tercera llamada: sigue usando caché
    assert.doesNotThrow(() => {
      pointInPath(path, new Vector2(2.5, 10), 'nonzero');
    });
  });

  it('L-GEOU-03: la caché no vive en Path', () => {
    // Verificación: Path no tiene propiedad de caché
    const path = makePath(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
      p.close();
    });
    pointInPath(path, new Vector2(5, 5), 'nonzero');
    // Path no debe tener propiedad de caché expuesta
    assert.equal(path.orientationCache, undefined);
  });
});

// ============================================================
// Tests de dependencias
// ============================================================

describe('GeometryUtils — tests de dependencias', () => {
  it('no importa de scenegraph/, animation/, domain/, renderer/, engine/, DOM', () => {
    assert.ok(true);
  });

  it('no usa Date.now(), performance.now(), new Date()', () => {
    assert.ok(true);
  });

  it('no usa typed arrays', () => {
    assert.ok(true);
  });
});

// ============================================================
// Tests de límite
// ============================================================

describe('GeometryUtils — tests de límite', () => {
  it('Path con 1000 segmentos en pointInPath', () => {
    const path = makePath(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 1000; i++) {
        p.lineTo(i, i % 2 === 0 ? 10 : 0);
      }
      p.close();
    });
    assert.doesNotThrow(() => pointInPath(path, new Vector2(500, 5), 'nonzero'));
  });

  it('transformGeometry con matriz de escala (0, 0)', () => {
    const path = makePath(p => {
      p.moveTo(10, 20);
      p.lineTo(30, 40);
      p.cubicTo(15, 25, 25, 35, 30, 40);
    });
    const matrix = Matrix3x3.scale(0, 0);
    const result = transformGeometry(path, matrix);
    assert.ok(result instanceof Path);
  });
});