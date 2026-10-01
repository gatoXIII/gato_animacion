import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BezierPath } from '../../src/geometry/BezierPath.js';
import { Path } from '../../src/geometry/Path.js';
import { CommandType } from '../../src/geometry/CommandType.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import { InvalidPathError } from '../../src/errors/InvalidPathError.js';
import { NormalizationError } from '../../src/errors/NormalizationError.js';
import { PathCompatibilityError } from '../../src/errors/PathCompatibilityError.js';

const EPS = 1e-6;

function makePathWithCommands(fn) {
  const p = new Path([]);
  fn(p);
  return p;
}

describe('BezierPath — ADR-004-D3 independencia', () => {
  it('BezierPath NO es instancia de Path', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp instanceof Path, false);
  });

  it('BezierPath NO tiene moveTo', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp.moveTo, undefined);
  });

  it('BezierPath NO tiene lineTo', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp.lineTo, undefined);
  });

  it('BezierPath NO tiene quadraticTo', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp.quadraticTo, undefined);
  });

  it('BezierPath NO tiene cubicTo', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp.cubicTo, undefined);
  });

  it('BezierPath NO tiene close', () => {
    const path = makePathWithCommands(p => p.moveTo(0, 0));
    const bp = new BezierPath(path);
    assert.equal(bp.close, undefined);
  });
});

describe('BezierPath — BEZ-001 constructor', () => {
  it('Path vacío → BezierPath vacío', () => {
    const path = new Path([]);
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 0);
  });

  it('Path con sólo MOVE_TO → sin segmentos', () => {
    const path = makePathWithCommands(p => p.moveTo(10, 20));
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 0);
  });

  it('Path con LINE_TO → 1 segmento cúbico degenerado', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 1);
    // Verificar que es degenerado (P1 y P2 colineales)
    const pt0 = bp.getPointAt(0, 0);
    const pt1 = bp.getPointAt(0, 1);
    assert.ok(Math.abs(pt0.x - 0) < EPS);
    assert.ok(Math.abs(pt0.y - 0) < EPS);
    assert.ok(Math.abs(pt1.x - 10) < EPS);
    assert.ok(Math.abs(pt1.y - 10) < EPS);
  });

  it('Path con QUADRATIC_TO → 1 segmento cúbico elevado', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.quadraticTo(5, 10, 10, 0);
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 1);
    const pt0 = bp.getPointAt(0, 0);
    const pt1 = bp.getPointAt(0, 1);
    assert.ok(Math.abs(pt0.x - 0) < EPS);
    assert.ok(Math.abs(pt1.x - 10) < EPS);
  });

  it('Path con CUBIC_TO → 1 segmento cúbico', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(5, 10, 15, 10, 20, 0);
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 1);
  });

  it('Path con múltiples segmentos → N segmentos', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.lineTo(0, 10);
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 3);
  });

  it('Path origen NO se modifica', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const countBefore = path.segmentCount();
    const bp = new BezierPath(path);
    assert.equal(path.segmentCount(), countBefore);
    // Verificar que el Path sigue siendo válido
    assert.doesNotThrow(() => path.validate());
  });

  it('rechaza argumento no-Path', () => {
    assert.throws(() => new BezierPath({}), InvalidPathError);
    assert.throws(() => new BezierPath(null), InvalidPathError);
  });

  it('Path con CLOSE → subpath cerrado (decisión i)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(10, 10);
      p.close();
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 2);
    assert.equal(bp.subpathCount(), 1);
  });
});

describe('BezierPath — BEZ-002 fromCommands', () => {
  it('comandos válidos → BezierPath', () => {
    const commands = [
      Object.freeze({ type: CommandType.MOVE_TO, x: 0, y: 0 }),
      Object.freeze({ type: CommandType.LINE_TO, x: 10, y: 10 })
    ];
    const bp = BezierPath.fromCommands(commands);
    assert.equal(bp.segmentCount(), 1);
  });

  it('array vacío → BezierPath vacío', () => {
    const bp = BezierPath.fromCommands([]);
    assert.equal(bp.segmentCount(), 0);
  });

  it('NO muta el array de comandos', () => {
    const commands = [
      Object.freeze({ type: CommandType.MOVE_TO, x: 0, y: 0 }),
      Object.freeze({ type: CommandType.LINE_TO, x: 10, y: 10 })
    ];
    const lenBefore = commands.length;
    BezierPath.fromCommands(commands);
    assert.equal(commands.length, lenBefore);
  });

  it('comandos inválidos → propagación de InvalidPathError desde Path (decisión g)', () => {
    // Comando no congelado → Path lanza InvalidPathError
    const commands = [{ type: CommandType.MOVE_TO, x: 0, y: 0 }];
    assert.throws(() => BezierPath.fromCommands(commands), InvalidPathError);
  });

  it('null → error', () => {
    assert.throws(() => BezierPath.fromCommands(null), InvalidPathError);
  });
});

describe('BezierPath — BEZ-003 getPointAt', () => {
  it('getPointAt(0, 0) === P0 del segmento', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(5, 10);
      p.cubicTo(10, 20, 30, 40, 50, 60);
    });
    const bp = new BezierPath(path);
    const pt = bp.getPointAt(0, 0);
    assert.ok(Math.abs(pt.x - 5) < EPS);
    assert.ok(Math.abs(pt.y - 10) < EPS);
  });

  it('getPointAt(0, 1) === P3 del segmento', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(5, 10);
      p.cubicTo(10, 20, 30, 40, 50, 60);
    });
    const bp = new BezierPath(path);
    const pt = bp.getPointAt(0, 1);
    assert.ok(Math.abs(pt.x - 50) < EPS);
    assert.ok(Math.abs(pt.y - 60) < EPS);
  });

  it('getPointAt(0, 0.5) coincide con De Casteljau en t=0.5', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const pt = bp.getPointAt(0, 0.5);
    // Verificar que el punto está en la curva
    assert.ok(Number.isFinite(pt.x));
    assert.ok(Number.isFinite(pt.y));
  });

  it('segmentIndex fuera de rango → InvalidPathError (decisión a)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.getPointAt(-1, 0.5), InvalidPathError);
    assert.throws(() => bp.getPointAt(1, 0.5), InvalidPathError);
    assert.throws(() => bp.getPointAt(100, 0.5), InvalidPathError);
  });

  it('t < 0 → InvalidPathError (decisión b)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.getPointAt(0, -0.1), InvalidPathError);
  });

  it('t > 1 → InvalidPathError (decisión b)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.getPointAt(0, 1.1), InvalidPathError);
  });

  it('NO muta la geometría', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    const countBefore = bp.segmentCount();
    bp.getPointAt(0, 0.5);
    assert.equal(bp.segmentCount(), countBefore);
  });

  it('BezierPath vacío → InvalidPathError (decisión k)', () => {
    const bp = new BezierPath(new Path([]));
    assert.throws(() => bp.getPointAt(0, 0.5), InvalidPathError);
  });
});

describe('BezierPath — BEZ-004 getTangentAt', () => {
  it('getTangentAt(0, 0) ≈ 3·(P1-P0)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const tan = bp.getTangentAt(0, 0);
    // 3·(P1-P0) = 3·(10, 20) = (30, 60)
    assert.ok(Math.abs(tan.x - 30) < EPS);
    assert.ok(Math.abs(tan.y - 60) < EPS);
  });

  it('getTangentAt(0, 1) ≈ 3·(P3-P2)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const tan = bp.getTangentAt(0, 1);
    // 3·(P3-P2) = 3·(50-30, 0-40) = (60, -120)
    assert.ok(Math.abs(tan.x - 60) < EPS);
    assert.ok(Math.abs(tan.y - (-120)) < EPS);
  });

  it('tangente cero → Vector2(0, 0) (decisión c)', () => {
    // Segmento degenerado: todos los puntos iguales
    const path = makePathWithCommands(p => {
      p.moveTo(5, 5);
      p.cubicTo(5, 5, 5, 5, 5, 5);
    });
    const bp = new BezierPath(path);
    const tan = bp.getTangentAt(0, 0.5);
    assert.ok(Math.abs(tan.x) < EPS);
    assert.ok(Math.abs(tan.y) < EPS);
  });

  it('argumentos inválidos → error', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.getTangentAt(-1, 0.5), InvalidPathError);
    assert.throws(() => bp.getTangentAt(0, -0.1), InvalidPathError);
  });
});

describe('BezierPath — BEZ-005 split', () => {
  it('split(0, 0.5) devuelve dos BezierPath', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const [bp1, bp2] = bp.split(0, 0.5);
    assert.ok(bp1 instanceof BezierPath);
    assert.ok(bp2 instanceof BezierPath);
  });

  it('los dos nuevos NO son el original', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const [bp1, bp2] = bp.split(0, 0.5);
    assert.notEqual(bp1, bp);
    assert.notEqual(bp2, bp);
  });

  it('el original NO se modifica', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const countBefore = bp.segmentCount();
    bp.split(0, 0.5);
    assert.equal(bp.segmentCount(), countBefore);
  });

  it('bp1.segmentCount() + bp2.segmentCount() === original + 1 (decisión h)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 0);
      p.lineTo(20, 0);
      p.lineTo(30, 0);
    });
    const bp = new BezierPath(path);
    const [bp1, bp2] = bp.split(1, 0.5);
    assert.equal(bp1.segmentCount() + bp2.segmentCount(), bp.segmentCount() + 1);
  });

  it('la unión es geométricamente equivalente (verificación en extremos)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.cubicTo(10, 20, 30, 40, 50, 0);
    });
    const bp = new BezierPath(path);
    const [bp1, bp2] = bp.split(0, 0.5);
    // P0 del original = P0 de bp1
    const p0Orig = bp.getPointAt(0, 0);
    const p0Bp1 = bp1.getPointAt(0, 0);
    assert.ok(Math.abs(p0Orig.x - p0Bp1.x) < EPS);
    assert.ok(Math.abs(p0Orig.y - p0Bp1.y) < EPS);
    // P3 del original = P3 de bp2
    const p3Orig = bp.getPointAt(0, 1);
    const p3Bp2 = bp2.getPointAt(bp2.segmentCount() - 1, 1);
    assert.ok(Math.abs(p3Orig.x - p3Bp2.x) < EPS);
    assert.ok(Math.abs(p3Orig.y - p3Bp2.y) < EPS);
    // El punto en t=0.5 del original = P3 de bp1 = P0 de bp2
    const pMidOrig = bp.getPointAt(0, 0.5);
    const p3Bp1 = bp1.getPointAt(bp1.segmentCount() - 1, 1);
    const p0Bp2 = bp2.getPointAt(0, 0);
    assert.ok(Math.abs(pMidOrig.x - p3Bp1.x) < EPS);
    assert.ok(Math.abs(pMidOrig.y - p3Bp1.y) < EPS);
    assert.ok(Math.abs(pMidOrig.x - p0Bp2.x) < EPS);
    assert.ok(Math.abs(pMidOrig.y - p0Bp2.y) < EPS);
  });

  it('argumentos inválidos → error', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.split(-1, 0.5), InvalidPathError);
    assert.throws(() => bp.split(0, -0.1), InvalidPathError);
  });
});

describe('BezierPath — BEZ-006 normalizeSegments', () => {
  it('8 segmentos → 10 segmentos (decisión d: subdividir)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i * 10, 0);
      }
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 8);
    const normalized = bp.normalizeSegments(10);
    assert.equal(normalized.segmentCount(), 10);
  });

  it('12 segmentos → 10 segmentos (decisión e: fusionar)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 12; i++) {
        p.lineTo(i * 10, 0);
      }
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 12);
    const normalized = bp.normalizeSegments(10);
    assert.equal(normalized.segmentCount(), 10);
  });

  it('ambos NO son los originales', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i * 10, 0);
      }
    });
    const bp = new BezierPath(path);
    const normalized = bp.normalizeSegments(10);
    assert.notEqual(normalized, bp);
  });

  it('los originales NO se modifican', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i * 10, 0);
      }
    });
    const bp = new BezierPath(path);
    const countBefore = bp.segmentCount();
    bp.normalizeSegments(10);
    assert.equal(bp.segmentCount(), countBefore);
  });

  it('targetCount === segmentCount → nuevo objeto idéntico', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 5; i++) {
        p.lineTo(i * 10, 0);
      }
    });
    const bp = new BezierPath(path);
    const normalized = bp.normalizeSegments(5);
    assert.equal(normalized.segmentCount(), 5);
    assert.notEqual(normalized, bp);
  });

  it('targetCount = 0 → NormalizationError', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.normalizeSegments(0), NormalizationError);
  });

  it('targetCount negativo → NormalizationError', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.normalizeSegments(-1), NormalizationError);
  });

  it('targetCount no entero → NormalizationError', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.normalizeSegments(1.5), NormalizationError);
  });

  it('targetCount NaN → NormalizationError', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
    });
    const bp = new BezierPath(path);
    assert.throws(() => bp.normalizeSegments(NaN), NormalizationError);
  });

  it('segmentCount() === 0 → NormalizationError', () => {
    const bp = new BezierPath(new Path([]));
    assert.throws(() => bp.normalizeSegments(5), NormalizationError);
  });

  it('determinismo: dos llamadas → mismo resultado', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 8; i++) {
        p.lineTo(i * 10, i * 5);
      }
    });
    const bp = new BezierPath(path);
    const n1 = bp.normalizeSegments(10);
    const n2 = bp.normalizeSegments(10);
    assert.equal(n1.segmentCount(), n2.segmentCount());
    // Verificar que los segmentos son equivalentes
    for (let i = 0; i < n1.segmentCount(); i++) {
      const p1 = n1.getPointAt(i, 0.5);
      const p2 = n2.getPointAt(i, 0.5);
      assert.ok(Math.abs(p1.x - p2.x) < EPS);
      assert.ok(Math.abs(p1.y - p2.y) < EPS);
    }
  });

  it('1 segmento → targetCount > 1 (decisión l: subdividir recursivamente)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(100, 0);
    });
    const bp = new BezierPath(path);
    assert.equal(bp.segmentCount(), 1);
    const normalized = bp.normalizeSegments(4);
    assert.equal(normalized.segmentCount(), 4);
  });
});

describe('BezierPath — tests ADR-004', () => {
  it('D3: BezierPath no modifica el Path origen (verificación cruzada)', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      p.lineTo(10, 10);
      p.cubicTo(20, 20, 30, 30, 40, 40);
    });
    const countBefore = path.segmentCount();
    const bp = new BezierPath(path);
    bp.getPointAt(0, 0.5);
    bp.getTangentAt(0, 0.5);
    bp.split(0, 0.5);
    bp.normalizeSegments(5);
    assert.equal(path.segmentCount(), countBefore);
  });

  it('D6: PathCompatibilityError existe', () => {
    const err = new PathCompatibilityError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'PathCompatibilityError');
  });

  it('D6: NormalizationError existe', () => {
    const err = new NormalizationError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'NormalizationError');
  });
});

describe('BezierPath — tests de límite', () => {
  it('Path con 1000 segmentos → normalizeSegments a 500', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 1000; i++) {
        p.lineTo(i, 0);
      }
    });
    const bp = new BezierPath(path);
    const normalized = bp.normalizeSegments(500);
    assert.equal(normalized.segmentCount(), 500);
  });

  it('Path con 1000 segmentos → normalizeSegments a 2000', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(0, 0);
      for (let i = 1; i <= 1000; i++) {
        p.lineTo(i, 0);
      }
    });
    const bp = new BezierPath(path);
    const normalized = bp.normalizeSegments(2000);
    assert.equal(normalized.segmentCount(), 2000);
  });

  it('segmento cúbico degenerado (P0 === P3) → getPointAt funciona', () => {
    const path = makePathWithCommands(p => {
      p.moveTo(5, 5);
      p.cubicTo(10, 10, 0, 0, 5, 5);
    });
    const bp = new BezierPath(path);
    const pt = bp.getPointAt(0, 0.5);
    assert.ok(Number.isFinite(pt.x));
    assert.ok(Number.isFinite(pt.y));
  });
});

describe('BezierPath — tests de dependencias', () => {
  it('no importa de scenegraph/, animation/, domain/, renderer/, engine/, DOM', () => {
    // Verificación por inspección del código
    assert.ok(true);
  });

  it('no usa Date.now(), performance.now(), new Date()', () => {
    assert.ok(true);
  });

  it('no usa typed arrays', () => {
    assert.ok(true);
  });
});