import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from '../../src/math/Vector2.js';
import { InvalidNumericInputError } from '../../src/errors/InvalidNumericInputError.js';
import { InvalidVectorError } from '../../src/errors/InvalidVectorError.js';
import { ZeroLengthVectorError } from '../../src/errors/ZeroLengthVectorError.js';

const EPS = 1e-9;

describe('Vector2 — VEC-001 constructor', () => {
  it('construye con valores finitos', () => {
    const v = new Vector2(3, 4);
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });

  it('acepta (0, 0)', () => {
    const v = new Vector2(0, 0);
    assert.equal(v.x, 0);
    assert.equal(v.y, 0);
  });

  it('acepta valores negativos', () => {
    const v = new Vector2(-5, -7);
    assert.equal(v.x, -5);
    assert.equal(v.y, -7);
  });

  it('rechaza NaN en x', () => {
    assert.throws(() => new Vector2(NaN, 4), InvalidNumericInputError);
  });

  it('rechaza NaN en y', () => {
    assert.throws(() => new Vector2(3, NaN), InvalidNumericInputError);
  });

  it('rechaza Infinity', () => {
    assert.throws(() => new Vector2(Infinity, 4), InvalidNumericInputError);
    assert.throws(() => new Vector2(3, -Infinity), InvalidNumericInputError);
  });

  it('rechaza undefined', () => {
    assert.throws(() => new Vector2(undefined, 4), InvalidNumericInputError);
  });

  it('rechaza null', () => {
    assert.throws(() => new Vector2(null, 4), InvalidNumericInputError);
  });

  it('rechaza string', () => {
    assert.throws(() => new Vector2('3', 4), InvalidNumericInputError);
  });

  it('error incluye functionId, input, prevState, cause', () => {
    try {
      new Vector2(NaN, 4);
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'VEC-001');
      assert.deepEqual(e.input, { x: NaN, y: 4 });
      assert.equal(e.prevState, null);
      assert.ok(e.cause.length > 0);
    }
  });
});

describe('Vector2 — VEC-002 clone', () => {
  it('devuelve vector con mismos valores', () => {
    const v = new Vector2(3, 4);
    const c = v.clone();
    assert.equal(c.x, 3);
    assert.equal(c.y, 4);
  });

  it('devuelve instancia distinta', () => {
    const v = new Vector2(3, 4);
    const c = v.clone();
    assert.notEqual(c, v);
  });

  it('mutar clon no afecta original', () => {
    const v = new Vector2(3, 4);
    const c = v.clone();
    c.x = 99;
    c.y = 100;
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });
});

describe('Vector2 — VEC-003 add', () => {
  it('suma válida', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(3, 4);
    const r = v1.add(v2);
    assert.equal(r.x, 4);
    assert.equal(r.y, 6);
  });

  it('suma con vector cero', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(0, 0);
    const r = v1.add(v2);
    assert.equal(r.x, 3);
    assert.equal(r.y, 4);
  });

  it('no muta this', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(3, 4);
    v1.add(v2);
    assert.equal(v1.x, 1);
    assert.equal(v1.y, 2);
  });

  it('no muta other', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(3, 4);
    v1.add(v2);
    assert.equal(v2.x, 3);
    assert.equal(v2.y, 4);
  });

  it('rechaza argumento no-Vector2', () => {
    const v = new Vector2(1, 2);
    assert.throws(() => v.add({ x: 3, y: 4 }), InvalidVectorError);
    assert.throws(() => v.add(null), InvalidVectorError);
    assert.throws(() => v.add(undefined), InvalidVectorError);
    assert.throws(() => v.add(5), InvalidVectorError);
  });
});

describe('Vector2 — VEC-004 subtract', () => {
  it('resta válida', () => {
    const v1 = new Vector2(5, 7);
    const v2 = new Vector2(2, 3);
    const r = v1.subtract(v2);
    assert.equal(r.x, 3);
    assert.equal(r.y, 4);
  });

  it('resta consigo mismo → vector cero', () => {
    const v = new Vector2(3, 4);
    const r = v.subtract(v);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  it('no muta this', () => {
    const v1 = new Vector2(5, 7);
    const v2 = new Vector2(2, 3);
    v1.subtract(v2);
    assert.equal(v1.x, 5);
    assert.equal(v1.y, 7);
  });

  it('no muta other', () => {
    const v1 = new Vector2(5, 7);
    const v2 = new Vector2(2, 3);
    v1.subtract(v2);
    assert.equal(v2.x, 2);
    assert.equal(v2.y, 3);
  });

  it('rechaza argumento no-Vector2', () => {
    const v = new Vector2(1, 2);
    assert.throws(() => v.subtract({ x: 3, y: 4 }), InvalidVectorError);
  });
});

describe('Vector2 — VEC-005 multiplyScalar', () => {
  it('escalado válido', () => {
    const v = new Vector2(3, 4);
    const r = v.multiplyScalar(2);
    assert.equal(r.x, 6);
    assert.equal(r.y, 8);
  });

  it('escalado por 0', () => {
    const v = new Vector2(3, 4);
    const r = v.multiplyScalar(0);
    assert.equal(r.x, 0);
    assert.equal(r.y, 0);
  });

  it('escalado por 1', () => {
    const v = new Vector2(3, 4);
    const r = v.multiplyScalar(1);
    assert.equal(r.x, 3);
    assert.equal(r.y, 4);
  });

  it('escalado por -1', () => {
    const v = new Vector2(3, 4);
    const r = v.multiplyScalar(-1);
    assert.equal(r.x, -3);
    assert.equal(r.y, -4);
  });

  it('no muta this', () => {
    const v = new Vector2(3, 4);
    v.multiplyScalar(2);
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });

  it('rechaza NaN', () => {
    const v = new Vector2(3, 4);
    assert.throws(() => v.multiplyScalar(NaN), InvalidNumericInputError);
  });

  it('rechaza Infinity', () => {
    const v = new Vector2(3, 4);
    assert.throws(() => v.multiplyScalar(Infinity), InvalidNumericInputError);
  });
});

describe('Vector2 — VEC-006 dot', () => {
  it('producto escalar válido', () => {
    const v1 = new Vector2(2, 3);
    const v2 = new Vector2(4, 5);
    assert.equal(v1.dot(v2), 23);
  });

  it('dot con vector cero → 0', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(0, 0);
    assert.equal(v1.dot(v2), 0);
  });

  it('dot consigo mismo = lengthSquared', () => {
    const v = new Vector2(3, 4);
    assert.equal(v.dot(v), v.lengthSquared());
  });

  it('vectores ortogonales → 0', () => {
    const v1 = new Vector2(1, 0);
    const v2 = new Vector2(0, 1);
    assert.equal(v1.dot(v2), 0);
  });

  it('rechaza argumento no-Vector2', () => {
    const v = new Vector2(1, 2);
    assert.throws(() => v.dot({ x: 3, y: 4 }), InvalidVectorError);
  });
});

describe('Vector2 — VEC-007 length', () => {
  it('longitud de (3, 4) ≈ 5', () => {
    const v = new Vector2(3, 4);
    assert.ok(Math.abs(v.length() - 5) < EPS);
  });

  it('longitud de (0, 0) = 0', () => {
    const v = new Vector2(0, 0);
    assert.equal(v.length(), 0);
  });

  it('longitud de vector unitario = 1', () => {
    const v = new Vector2(1, 0);
    assert.ok(Math.abs(v.length() - 1) < EPS);
  });

  it('longitud siempre >= 0', () => {
    const v = new Vector2(-3, -4);
    assert.ok(v.length() >= 0);
  });
});

describe('Vector2 — VEC-008 lengthSquared', () => {
  it('lengthSquared de (3, 4) = 25', () => {
    const v = new Vector2(3, 4);
    assert.equal(v.lengthSquared(), 25);
  });

  it('lengthSquared de (0, 0) = 0', () => {
    const v = new Vector2(0, 0);
    assert.equal(v.lengthSquared(), 0);
  });

  it('lengthSquared de (1, 0) = 1', () => {
    const v = new Vector2(1, 0);
    assert.equal(v.lengthSquared(), 1);
  });
});

describe('Vector2 — VEC-009 normalize', () => {
  it('normaliza (3, 4) → (0.6, 0.8)', () => {
    const v = new Vector2(3, 4);
    const n = v.normalize();
    assert.ok(Math.abs(n.x - 0.6) < EPS);
    assert.ok(Math.abs(n.y - 0.8) < EPS);
  });

  it('longitud del normalizado ≈ 1', () => {
    const v = new Vector2(3, 4);
    const n = v.normalize();
    assert.ok(Math.abs(n.length() - 1) < EPS);
  });

  it('no muta this', () => {
    const v = new Vector2(3, 4);
    v.normalize();
    assert.equal(v.x, 3);
    assert.equal(v.y, 4);
  });

  it('lanza ZeroLengthVectorError para (0, 0)', () => {
    const v = new Vector2(0, 0);
    assert.throws(() => v.normalize(), ZeroLengthVectorError);
  });

  it('error incluye functionId, input, prevState, cause', () => {
    const v = new Vector2(0, 0);
    try {
      v.normalize();
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'VEC-009');
      assert.deepEqual(e.input, { x: 0, y: 0 });
      assert.deepEqual(e.prevState, { x: 0, y: 0 });
      assert.ok(e.cause.length > 0);
    }
  });

  it('normaliza vector muy pequeño pero no cero', () => {
    const v = new Vector2(1e-10, 1e-10);
    const n = v.normalize();
    assert.ok(Math.abs(n.length() - 1) < EPS);
  });
});

describe('Vector2 — VEC-010 equalsApprox', () => {
  it('vectores idénticos → true', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3, 4);
    //assert.equal(v1.equalsApprox(v2), true);
    assert.equal(v1.equalsApprox(v2, 1e-6), true);
  });

  it('vectores dentro de epsilon → true', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3 + 1e-7, 4 - 1e-7);
    assert.equal(v1.equalsApprox(v2, 1e-6), true);
  });

  it('vectores fuera de epsilon → false', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3.1, 4);
    assert.equal(v1.equalsApprox(v2, 1e-6), false);
  });

  it('epsilon por defecto = 1e-6', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3 + 1e-7, 4);
   // assert.equal(v1.equalsApprox(v2), true);
   assert.equal(v1.equalsApprox(v2, 1e-6), true);
  });

  it('lanza InvalidNumericInputError si epsilon <= 0', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3, 4);
    assert.throws(() => v1.equalsApprox(v2, 0), InvalidNumericInputError);
    assert.throws(() => v1.equalsApprox(v2, -1), InvalidNumericInputError);
  });

  it('lanza InvalidNumericInputError si epsilon = NaN', () => {
    const v1 = new Vector2(3, 4);
    const v2 = new Vector2(3, 4);
    assert.throws(() => v1.equalsApprox(v2, NaN), InvalidNumericInputError);
  });

  it('lanza InvalidVectorError si other no es Vector2', () => {
    const v = new Vector2(3, 4);
    assert.throws(() => v.equalsApprox({ x: 3, y: 4 }), InvalidVectorError);
  });
});

describe('Vector2 — VEC-011 isFinite', () => {
  it('vector finito → true', () => {
    const v = new Vector2(3, 4);
    assert.equal(v.isFinite(), true);
  });

  it('vector cero → true', () => {
    const v = new Vector2(0, 0);
    assert.equal(v.isFinite(), true);
  });

  it('no lanza (verificación directa)', () => {
    const v = new Vector2(3, 4);
    assert.doesNotThrow(() => v.isFinite());
  });

  // Nota: no podemos construir Vector2 con NaN/Infinity (VEC-001 los rechaza),
  // pero isFinite() debe ser robusto si somehow se corrompe el estado.
  // Simulamos corrompiendo manualmente para probar el método en sí.
  it('detecta NaN si el estado se corrompe', () => {
    const v = new Vector2(3, 4);
    v.x = NaN;
    assert.equal(v.isFinite(), false);
  });

  it('detecta Infinity si el estado se corrompe', () => {
    const v = new Vector2(3, 4);
    v.y = Infinity;
    assert.equal(v.isFinite(), false);
  });
});
describe('Vector2 — ADR-003-D1', () => {
  it('equalsApprox sin epsilon lanza InvalidNumericInputError', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1, 2);
    assert.throws(() => v1.equalsApprox(v2), InvalidNumericInputError);
  });

  it('equalsApprox con epsilon undefined lanza', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1, 2);
    assert.throws(() => v1.equalsApprox(v2, undefined), InvalidNumericInputError);
  });

  it('equalsApprox con epsilon null lanza', () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1, 2);
    assert.throws(() => v1.equalsApprox(v2, null), InvalidNumericInputError);
  });
});