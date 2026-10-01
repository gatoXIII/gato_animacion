import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Matrix3x3 } from '../../src/math/Matrix3x3.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { InvalidNumericInputError } from '../../src/errors/InvalidNumericInputError.js';
import { InvalidMatrixError } from '../../src/errors/InvalidMatrixError.js';
import { InvalidVectorError } from '../../src/errors/InvalidVectorError.js';
import { NonInvertibleMatrixError } from '../../src/errors/NonInvertibleMatrixError.js';

const EPS = 1e-9;

describe('Matrix3x3 — MAT-001 constructor', () => {
  it('construye sin argumentos (identidad)', () => {
    const m = new Matrix3x3();
    assert.deepEqual(m.values, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('construye con 9 valores válidos', () => {
    const m = new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(m.values, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('rechaza 8 valores', () => {
    assert.throws(() => new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8]), InvalidMatrixError);
  });

  it('rechaza 10 valores', () => {
    assert.throws(() => new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), InvalidMatrixError);
  });

  it('rechaza NaN', () => {
    assert.throws(() => new Matrix3x3([1, 2, 3, 4, NaN, 6, 7, 8, 9]), InvalidMatrixError);
  });

  it('rechaza Infinity', () => {
    assert.throws(() => new Matrix3x3([1, 2, 3, 4, Infinity, 6, 7, 8, 9]), InvalidMatrixError);
  });

  it('rechaza string', () => {
    assert.throws(() => new Matrix3x3([1, 2, 3, 4, '5', 6, 7, 8, 9]), InvalidMatrixError);
  });

  it('rechaza null', () => {
    assert.throws(() => new Matrix3x3(null), InvalidMatrixError);
  });

  it('acepta 9 ceros', () => {
    const m = new Matrix3x3([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(m.values, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('error incluye functionId, input, prevState, cause', () => {
    try {
      new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8]);
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'MAT-001');
      assert.deepEqual(e.input, { values: [1, 2, 3, 4, 5, 6, 7, 8] });
      assert.equal(e.prevState, null);
      assert.ok(e.cause.length > 0);
    }
  });
});

describe('Matrix3x3 — MAT-002 identity', () => {
  it('devuelve matriz identidad', () => {
    const m = Matrix3x3.identity();
    assert.deepEqual(m.values, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('M × identity ≈ M', () => {
    const m = new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = m.multiply(Matrix3x3.identity());
    assert.ok(m.equalsApprox(result, EPS));
  });
});

describe('Matrix3x3 — MAT-003 translation', () => {
  it('construye traslación válida', () => {
    const m = Matrix3x3.translation(10, 20);
    assert.deepEqual(m.values, [1, 0, 10, 0, 1, 20, 0, 0, 1]);
  });

  it('transformPoint aplica traslación', () => {
    const m = Matrix3x3.translation(10, 20);
    const p = new Vector2(5, 5);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 15) < EPS);
    assert.ok(Math.abs(result.y - 25) < EPS);
  });

  it('transformVector NO aplica traslación', () => {
    const m = Matrix3x3.translation(10, 20);
    const v = new Vector2(5, 5);
    const result = m.transformVector(v);
    assert.ok(Math.abs(result.x - 5) < EPS);
    assert.ok(Math.abs(result.y - 5) < EPS);
  });

  it('rechaza NaN', () => {
    assert.throws(() => Matrix3x3.translation(NaN, 20), InvalidNumericInputError);
  });

  it('rechaza Infinity', () => {
    assert.throws(() => Matrix3x3.translation(10, Infinity), InvalidNumericInputError);
  });
});

describe('Matrix3x3 — MAT-004 rotation', () => {
  it('rotación en 0 = identidad', () => {
    const m = Matrix3x3.rotation(0);
    const expected = Matrix3x3.identity();
    assert.ok(m.equalsApprox(expected, EPS));
  });

  it('rotación en π/2 rota (1,0) → (0,1)', () => {
    const m = Matrix3x3.rotation(Math.PI / 2);
    const p = new Vector2(1, 0);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 0) < EPS);
    assert.ok(Math.abs(result.y - 1) < EPS);
  });

  it('rotación en π rota (1,0) → (-1,0)', () => {
    const m = Matrix3x3.rotation(Math.PI);
    const p = new Vector2(1, 0);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - (-1)) < EPS);
    assert.ok(Math.abs(result.y - 0) < EPS);
  });

  it('rotación en 2π = identidad', () => {
    const m = Matrix3x3.rotation(2 * Math.PI);
    const expected = Matrix3x3.identity();
    assert.ok(m.equalsApprox(expected, EPS));
  });

  it('ángulos negativos', () => {
    const m = Matrix3x3.rotation(-Math.PI / 2);
    const p = new Vector2(1, 0);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 0) < EPS);
    assert.ok(Math.abs(result.y - (-1)) < EPS);
  });

  it('determinante de rotación ≈ 1', () => {
    const m = Matrix3x3.rotation(Math.PI / 4);
    assert.ok(Math.abs(m.determinant() - 1) < EPS);
  });

  it('rechaza NaN', () => {
    assert.throws(() => Matrix3x3.rotation(NaN), InvalidNumericInputError);
  });
});

describe('Matrix3x3 — MAT-005 scale', () => {
  it('construye escala válida', () => {
    const m = Matrix3x3.scale(2, 3);
    assert.deepEqual(m.values, [2, 0, 0, 0, 3, 0, 0, 0, 1]);
  });

  it('transformPoint aplica escala', () => {
    const m = Matrix3x3.scale(2, 3);
    const p = new Vector2(5, 5);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 10) < EPS);
    assert.ok(Math.abs(result.y - 15) < EPS);
  });

  it('transformVector aplica escala', () => {
    const m = Matrix3x3.scale(2, 3);
    const v = new Vector2(5, 5);
    const result = m.transformVector(v);
    assert.ok(Math.abs(result.x - 10) < EPS);
    assert.ok(Math.abs(result.y - 15) < EPS);
  });

  it('scale(0, 0) construye pero invert() lanza', () => {
    const m = Matrix3x3.scale(0, 0);
    assert.throws(() => m.invert(), NonInvertibleMatrixError);
  });

  it('scale(0, 2) construye pero invert() lanza', () => {
    const m = Matrix3x3.scale(0, 2);
    assert.throws(() => m.invert(), NonInvertibleMatrixError);
  });

  it('escalas negativas (reflexión)', () => {
    const m = Matrix3x3.scale(-1, 1);
    const p = new Vector2(5, 5);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - (-5)) < EPS);
    assert.ok(Math.abs(result.y - 5) < EPS);
  });

  it('determinante de escala = sx × sy', () => {
    const m = Matrix3x3.scale(2, 3);
    assert.ok(Math.abs(m.determinant() - 6) < EPS);
  });

  it('determinante de scale(0, 0) = 0', () => {
    const m = Matrix3x3.scale(0, 0);
    assert.equal(m.determinant(), 0);
  });

  it('rechaza NaN', () => {
    assert.throws(() => Matrix3x3.scale(NaN, 3), InvalidNumericInputError);
  });
});

describe('Matrix3x3 — MAT-006 multiply', () => {
  it('M × I ≈ M', () => {
    const m = new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = m.multiply(Matrix3x3.identity());
    assert.ok(m.equalsApprox(result, EPS));
  });

  it('M × inverse(M) ≈ I', () => {
    const m = Matrix3x3.translation(10, 20);
    const inv = m.invert();
    const result = m.multiply(inv);
    assert.ok(result.equalsApprox(Matrix3x3.identity(), EPS));
  });

  it('asociatividad: (A × B) × C ≈ A × (B × C)', () => {
    const A = Matrix3x3.translation(10, 0);
    const B = Matrix3x3.rotation(Math.PI / 4);
    const C = Matrix3x3.scale(2, 2);
    const left = A.multiply(B).multiply(C);
    const right = A.multiply(B.multiply(C));
    assert.ok(left.equalsApprox(right, EPS));
  });

  it('composición: (Parent × Local).transformPoint(p) ≈ Parent.transformPoint(Local.transformPoint(p))', () => {
    const parent = Matrix3x3.translation(100, 0);
    const local = Matrix3x3.translation(10, 20);
    const composed = parent.multiply(local);
    const p = new Vector2(5, 5);
    const result1 = composed.transformPoint(p);
    const result2 = parent.transformPoint(local.transformPoint(p));
    assert.ok(result1.equalsApprox(result2, EPS));
  });

  it('rechaza argumento no-Matrix3x3', () => {
    const m = Matrix3x3.identity();
    assert.throws(() => m.multiply({ values: [1, 0, 0, 0, 1, 0, 0, 0, 1] }), InvalidMatrixError);
  });

  it('no muta this', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = Matrix3x3.scale(2, 3);
    const valuesBefore = m1.values.slice();
    m1.multiply(m2);
    assert.deepEqual(m1.values, valuesBefore);
  });

  it('no muta other', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = Matrix3x3.scale(2, 3);
    const valuesBefore = m2.values.slice();
    m1.multiply(m2);
    assert.deepEqual(m2.values, valuesBefore);
  });
});

describe('Matrix3x3 — MAT-007 determinant', () => {
  it('determinante de identidad = 1', () => {
    const m = Matrix3x3.identity();
    assert.ok(Math.abs(m.determinant() - 1) < EPS);
  });

  it('determinante de traslación = 1', () => {
    const m = Matrix3x3.translation(10, 20);
    assert.ok(Math.abs(m.determinant() - 1) < EPS);
  });

  it('determinante de rotación ≈ 1', () => {
    const m = Matrix3x3.rotation(Math.PI / 3);
    assert.ok(Math.abs(m.determinant() - 1) < EPS);
  });

  it('determinante de escala = sx × sy', () => {
    const m = Matrix3x3.scale(2, 3);
    assert.ok(Math.abs(m.determinant() - 6) < EPS);
  });

  it('determinante de scale(0, 0) = 0', () => {
    const m = Matrix3x3.scale(0, 0);
    assert.equal(m.determinant(), 0);
  });
});

describe('Matrix3x3 — MAT-008 invert', () => {
  it('inversa de identidad = identidad', () => {
    const m = Matrix3x3.identity();
    const inv = m.invert();
    assert.ok(inv.equalsApprox(Matrix3x3.identity(), EPS));
  });

  it('inversa de traslación = traslación opuesta', () => {
    const m = Matrix3x3.translation(10, 20);
    const inv = m.invert();
    const expected = Matrix3x3.translation(-10, -20);
    assert.ok(inv.equalsApprox(expected, EPS));
  });

  it('inversa de rotación = rotación opuesta', () => {
    const m = Matrix3x3.rotation(Math.PI / 4);
    const inv = m.invert();
    const expected = Matrix3x3.rotation(-Math.PI / 4);
    assert.ok(inv.equalsApprox(expected, EPS));
  });

  it('inversa de escala = escala recíproca', () => {
    const m = Matrix3x3.scale(2, 4);
    const inv = m.invert();
    const expected = Matrix3x3.scale(0.5, 0.25);
    assert.ok(inv.equalsApprox(expected, EPS));
  });

  it('scale(0, 0) lanza NonInvertibleMatrixError', () => {
    const m = Matrix3x3.scale(0, 0);
    assert.throws(() => m.invert(), NonInvertibleMatrixError);
  });

  it('scale(0, 2) lanza NonInvertibleMatrixError', () => {
    const m = Matrix3x3.scale(0, 2);
    assert.throws(() => m.invert(), NonInvertibleMatrixError);
  });

  it('M × inverse(M) ≈ I', () => {
    const m = Matrix3x3.translation(10, 20).multiply(Matrix3x3.rotation(Math.PI / 3));
    const inv = m.invert();
    const result = m.multiply(inv);
    assert.ok(result.equalsApprox(Matrix3x3.identity(), EPS));
  });

  it('inverse(inverse(M)) ≈ M', () => {
    const m = Matrix3x3.translation(10, 20).multiply(Matrix3x3.scale(2, 3));
    const invInv = m.invert().invert();
    assert.ok(invInv.equalsApprox(m, EPS));
  });

  it('error incluye functionId, input, prevState, cause', () => {
    const m = Matrix3x3.scale(0, 0);
    try {
      m.invert();
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'MAT-008');
      assert.deepEqual(e.input, { values: m.values });
      assert.deepEqual(e.prevState, { values: m.values });
      assert.ok(e.cause.length > 0);
    }
  });
});

describe('Matrix3x3 — MAT-009 transformPoint', () => {
  it('transformPoint con identidad no cambia punto', () => {
    const m = Matrix3x3.identity();
    const p = new Vector2(5, 10);
    const result = m.transformPoint(p);
    assert.ok(result.equalsApprox(p, EPS));
  });

  it('transformPoint con traslación aplica traslación', () => {
    const m = Matrix3x3.translation(10, 20);
    const p = new Vector2(5, 5);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 15) < EPS);
    assert.ok(Math.abs(result.y - 25) < EPS);
  });

  it('transformPoint con rotación rota', () => {
    const m = Matrix3x3.rotation(Math.PI / 2);
    const p = new Vector2(1, 0);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 0) < EPS);
    assert.ok(Math.abs(result.y - 1) < EPS);
  });

  it('transformPoint con escala escala', () => {
    const m = Matrix3x3.scale(2, 3);
    const p = new Vector2(5, 5);
    const result = m.transformPoint(p);
    assert.ok(Math.abs(result.x - 10) < EPS);
    assert.ok(Math.abs(result.y - 15) < EPS);
  });

  it('composición: (Parent × Local).transformPoint(p) ≈ Parent.transformPoint(Local.transformPoint(p))', () => {
    const parent = Matrix3x3.translation(100, 0);
    const local = Matrix3x3.translation(10, 20);
    const composed = parent.multiply(local);
    const p = new Vector2(5, 5);
    const result1 = composed.transformPoint(p);
    const result2 = parent.transformPoint(local.transformPoint(p));
    assert.ok(result1.equalsApprox(result2, EPS));
  });

  it('rechaza argumento no-Vector2', () => {
    const m = Matrix3x3.identity();
    assert.throws(() => m.transformPoint({ x: 5, y: 10 }), InvalidVectorError);
  });

  it('no muta this', () => {
    const m = Matrix3x3.translation(10, 20);
    const p = new Vector2(5, 5);
    const valuesBefore = m.values.slice();
    m.transformPoint(p);
    assert.deepEqual(m.values, valuesBefore);
  });

  it('no muta point', () => {
    const m = Matrix3x3.translation(10, 20);
    const p = new Vector2(5, 5);
    m.transformPoint(p);
    assert.equal(p.x, 5);
    assert.equal(p.y, 5);
  });
});

describe('Matrix3x3 — MAT-010 transformVector', () => {
  it('transformVector con identidad no cambia vector', () => {
    const m = Matrix3x3.identity();
    const v = new Vector2(5, 10);
    const result = m.transformVector(v);
    assert.ok(result.equalsApprox(v, EPS));
  });

  it('transformVector con traslación NO aplica traslación', () => {
    const m = Matrix3x3.translation(10, 20);
    const v = new Vector2(5, 5);
    const result = m.transformVector(v);
    assert.ok(Math.abs(result.x - 5) < EPS);
    assert.ok(Math.abs(result.y - 5) < EPS);
  });

  it('transformVector con rotación rota', () => {
    const m = Matrix3x3.rotation(Math.PI / 2);
    const v = new Vector2(1, 0);
    const result = m.transformVector(v);
    assert.ok(Math.abs(result.x - 0) < EPS);
    assert.ok(Math.abs(result.y - 1) < EPS);
  });

  it('transformVector con escala escala', () => {
    const m = Matrix3x3.scale(2, 3);
    const v = new Vector2(5, 5);
    const result = m.transformVector(v);
    assert.ok(Math.abs(result.x - 10) < EPS);
    assert.ok(Math.abs(result.y - 15) < EPS);
  });

  it('diferencia clave: transformPoint vs transformVector con traslación', () => {
    const m = Matrix3x3.translation(10, 20);
    const v = new Vector2(5, 5);
    const pointResult = m.transformPoint(v);
    const vectorResult = m.transformVector(v);
    assert.ok(Math.abs(pointResult.x - 15) < EPS);
    assert.ok(Math.abs(pointResult.y - 25) < EPS);
    assert.ok(Math.abs(vectorResult.x - 5) < EPS);
    assert.ok(Math.abs(vectorResult.y - 5) < EPS);
  });

  it('rechaza argumento no-Vector2', () => {
    const m = Matrix3x3.identity();
    assert.throws(() => m.transformVector({ x: 5, y: 10 }), InvalidVectorError);
  });

  it('no muta this', () => {
    const m = Matrix3x3.translation(10, 20);
    const v = new Vector2(5, 5);
    const valuesBefore = m.values.slice();
    m.transformVector(v);
    assert.deepEqual(m.values, valuesBefore);
  });

  it('no muta vector', () => {
    const m = Matrix3x3.translation(10, 20);
    const v = new Vector2(5, 5);
    m.transformVector(v);
    assert.equal(v.x, 5);
    assert.equal(v.y, 5);
  });
});

describe('Matrix3x3 — MAT-011 clone', () => {
  it('devuelve matriz con mismos valores', () => {
    const m = new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const c = m.clone();
    assert.deepEqual(c.values, m.values);
  });

  it('devuelve instancia distinta', () => {
    const m = Matrix3x3.identity();
    const c = m.clone();
    assert.notEqual(c, m);
  });

  it('mutar clon no afecta original', () => {
    const m = new Matrix3x3([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const c = m.clone();
    c.values[0] = 99;
    assert.equal(m.values[0], 1);
  });
});

describe('Matrix3x3 — MAT-012 equalsApprox', () => {
  it('matrices idénticas → true', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = Matrix3x3.translation(10, 20);
    assert.equal(m1.equalsApprox(m2), true);
  });

  it('matrices dentro de epsilon → true', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = new Matrix3x3([1, 0, 10 + 1e-7, 0, 1, 20, 0, 0, 1]);
    assert.equal(m1.equalsApprox(m2, 1e-6), true);
  });

  it('matrices fuera de epsilon → false', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = Matrix3x3.translation(10.1, 20);
    assert.equal(m1.equalsApprox(m2, 1e-6), false);
  });

  it('epsilon por defecto = 1e-6', () => {
    const m1 = Matrix3x3.translation(10, 20);
    const m2 = new Matrix3x3([1, 0, 10 + 1e-7, 0, 1, 20, 0, 0, 1]);
    assert.equal(m1.equalsApprox(m2), true);
  });

  it('lanza InvalidNumericInputError si epsilon <= 0', () => {
    const m1 = Matrix3x3.identity();
    const m2 = Matrix3x3.identity();
    assert.throws(() => m1.equalsApprox(m2, 0), InvalidNumericInputError);
    assert.throws(() => m1.equalsApprox(m2, -1), InvalidNumericInputError);
  });

  it('lanza InvalidNumericInputError si epsilon = NaN', () => {
    const m1 = Matrix3x3.identity();
    const m2 = Matrix3x3.identity();
    assert.throws(() => m1.equalsApprox(m2, NaN), InvalidNumericInputError);
  });

  it('lanza InvalidMatrixError si other no es Matrix3x3', () => {
    const m = Matrix3x3.identity();
    assert.throws(() => m.equalsApprox({ values: [1, 0, 0, 0, 1, 0, 0, 0, 1] }), InvalidMatrixError);
  });
});

describe('Matrix3x3 — MAT-013 isFinite', () => {
  it('matriz finita → true', () => {
    const m = Matrix3x3.translation(10, 20);
    assert.equal(m.isFinite(), true);
  });

  it('no lanza (verificación directa)', () => {
    const m = Matrix3x3.identity();
    assert.doesNotThrow(() => m.isFinite());
  });

  it('detecta NaN si el estado se corrompe', () => {
    const m = Matrix3x3.identity();
    m.values[0] = NaN;
    assert.equal(m.isFinite(), false);
  });

  it('detecta Infinity si el estado se corrompe', () => {
    const m = Matrix3x3.identity();
    m.values[4] = Infinity;
    assert.equal(m.isFinite(), false);
  });
});

describe('Matrix3x3 — ADR-003', () => {
  it('ADR-003-D1: invert() usa EPSILON_MATH como umbral', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    // Matriz con determinante justo por encima de EPSILON_MATH: invertible.
    const m = Matrix3x3.scale(EPSILON_MATH * 2, 1);
    assert.doesNotThrow(() => m.invert());
  });

  it('ADR-003-D1: invert() con determinante por debajo de EPSILON_MATH lanza', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    const m = Matrix3x3.scale(EPSILON_MATH / 10, 1);
    assert.throws(() => m.invert(), NonInvertibleMatrixError);
  });

  it('ADR-003-D1: equalsApprox sin epsilon lanza InvalidNumericInputError', () => {
    const m1 = Matrix3x3.identity();
    const m2 = Matrix3x3.identity();
    assert.throws(() => m1.equalsApprox(m2), InvalidNumericInputError);
  });

  it('ADR-003-D5: constructor rechaza Float32Array', () => {
    const typed = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    assert.throws(() => new Matrix3x3(typed), InvalidMatrixError);
  });

  it('ADR-003-D5: constructor acepta Array normal', () => {
    assert.doesNotThrow(() => new Matrix3x3([1, 0, 0, 0, 1, 0, 0, 0, 1]));
  });
});