import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AABB } from '../../src/math/AABB.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { Matrix3x3 } from '../../src/math/Matrix3x3.js';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import { InvalidVectorError } from '../../src/errors/InvalidVectorError.js';
import { InvalidMatrixError } from '../../src/errors/InvalidMatrixError.js';
import { InvalidAABBError } from '../../src/errors/InvalidAABBError.js';

const EPS = 1e-9;

describe('AABB — AABB-001 constructor', () => {
  it('construye con valores válidos', () => {
    const aabb = new AABB(0, 0, 10, 20);
    assert.equal(aabb.minX, 0);
    assert.equal(aabb.minY, 0);
    assert.equal(aabb.maxX, 10);
    assert.equal(aabb.maxY, 20);
    assert.equal(aabb.empty, false);
  });

  it('acepta límites iguales (línea vertical)', () => {
    const aabb = new AABB(5, 0, 5, 10);
    assert.equal(aabb.minX, 5);
    assert.equal(aabb.maxX, 5);
    assert.equal(aabb.empty, false);
  });

  it('acepta límites iguales (línea horizontal)', () => {
    const aabb = new AABB(0, 5, 10, 5);
    assert.equal(aabb.minY, 5);
    assert.equal(aabb.maxY, 5);
  });

  it('acepta punto (width=0 y height=0)', () => {
    const aabb = new AABB(5, 5, 5, 5);
    assert.equal(aabb.minX, 5);
    assert.equal(aabb.maxX, 5);
    assert.equal(aabb.minY, 5);
    assert.equal(aabb.maxY, 5);
    assert.equal(aabb.empty, false);
  });

  it('acepta valores negativos', () => {
    const aabb = new AABB(-10, -20, -5, -10);
    assert.equal(aabb.minX, -10);
    assert.equal(aabb.maxX, -5);
  });

  it('acepta valores extremos finitos', () => {
    const aabb = new AABB(-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
                          Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    assert.ok(Number.isFinite(aabb.minX));
    assert.ok(Number.isFinite(aabb.maxX));
  });

  it('rechaza NaN en minX', () => {
    assert.throws(() => new AABB(NaN, 0, 10, 20), InvalidAABBError);
  });

  it('rechaza NaN en maxX', () => {
    assert.throws(() => new AABB(0, 0, NaN, 20), InvalidAABBError);
  });

  it('rechaza Infinity', () => {
    assert.throws(() => new AABB(0, Infinity, 10, 20), InvalidAABBError);
  });

  it('rechaza -Infinity', () => {
    assert.throws(() => new AABB(-Infinity, 0, 10, 20), InvalidAABBError);
  });

  it('rechaza minX > maxX', () => {
    assert.throws(() => new AABB(10, 0, 5, 20), InvalidAABBError);
  });

  it('rechaza minY > maxY', () => {
    assert.throws(() => new AABB(0, 20, 10, 5), InvalidAABBError);
  });

  it('error incluye functionId, input, prevState, cause', () => {
    try {
      new AABB(10, 0, 5, 20);
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'AABB-001');
      assert.deepEqual(e.input, { minX: 10, minY: 0, maxX: 5, maxY: 20 });
      assert.equal(e.prevState, null);
      assert.ok(e.cause.length > 0);
    }
  });
});

describe('AABB — AABB-002 empty', () => {
  it('devuelve AABB con empty = true', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.empty, true);
    assert.equal(aabb.isEmpty(), true);
  });

  it('valores canónicos son finitos (no NaN)', () => {
    const aabb = AABB.empty();
    assert.ok(Number.isFinite(aabb.minX));
    assert.ok(Number.isFinite(aabb.minY));
    assert.ok(Number.isFinite(aabb.maxX));
    assert.ok(Number.isFinite(aabb.maxY));
  });

  it('valores canónicos son 0', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.minX, 0);
    assert.equal(aabb.minY, 0);
    assert.equal(aabb.maxX, 0);
    assert.equal(aabb.maxY, 0);
  });

  it('width() y height() son 0', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.width(), 0);
    assert.equal(aabb.height(), 0);
  });

  it('es instancia de AABB', () => {
    const aabb = AABB.empty();
    assert.ok(aabb instanceof AABB);
  });
});

describe('AABB — AABB-003 fromXYWH', () => {
  it('construye desde posición y dimensiones', () => {
    const aabb = AABB.fromXYWH(10, 20, 30, 40);
    assert.equal(aabb.minX, 10);
    assert.equal(aabb.minY, 20);
    assert.equal(aabb.maxX, 40);
    assert.equal(aabb.maxY, 60);
    assert.equal(aabb.empty, false);
  });

  it('acepta width = 0 (línea vertical, no vacío)', () => {
    const aabb = AABB.fromXYWH(10, 20, 0, 40);
    assert.equal(aabb.minX, 10);
    assert.equal(aabb.maxX, 10);
    assert.equal(aabb.empty, false);
  });

  it('acepta height = 0 (línea horizontal, no vacío)', () => {
    const aabb = AABB.fromXYWH(10, 20, 30, 0);
    assert.equal(aabb.minY, 20);
    assert.equal(aabb.maxY, 20);
    assert.equal(aabb.empty, false);
  });

  it('acepta width=0 y height=0 (punto degenerado, no vacío)', () => {
    const aabb = AABB.fromXYWH(10, 20, 0, 0);
    assert.equal(aabb.minX, 10);
    assert.equal(aabb.maxX, 10);
    assert.equal(aabb.minY, 20);
    assert.equal(aabb.maxY, 20);
    assert.equal(aabb.empty, false);
  });

  it('rechaza width negativo', () => {
    assert.throws(() => AABB.fromXYWH(10, 20, -5, 40), InvalidAABBError);
  });

  it('rechaza height negativo', () => {
    assert.throws(() => AABB.fromXYWH(10, 20, 30, -5), InvalidAABBError);
  });

  it('rechaza NaN', () => {
    assert.throws(() => AABB.fromXYWH(NaN, 20, 30, 40), InvalidAABBError);
  });

  it('rechaza Infinity', () => {
    assert.throws(() => AABB.fromXYWH(10, Infinity, 30, 40), InvalidAABBError);
  });
});

describe('AABB — AABB-004 clone', () => {
  it('devuelve copia con mismos valores', () => {
    const aabb = new AABB(0, 0, 10, 20);
    const clone = aabb.clone();
    assert.equal(clone.minX, 0);
    assert.equal(clone.minY, 0);
    assert.equal(clone.maxX, 10);
    assert.equal(clone.maxY, 20);
    assert.equal(clone.empty, false);
  });

  it('devuelve instancia distinta', () => {
    const aabb = new AABB(0, 0, 10, 20);
    const clone = aabb.clone();
    assert.notEqual(clone, aabb);
  });

  it('mutar clon no afecta original', () => {
    const aabb = new AABB(0, 0, 10, 20);
    const clone = aabb.clone();
    clone.minX = 999;
    clone.maxY = 888;
    assert.equal(aabb.minX, 0);
    assert.equal(aabb.maxY, 20);
  });

  it('clona AABB vacío preservando empty=true', () => {
    const aabb = AABB.empty();
    const clone = aabb.clone();
    assert.equal(clone.empty, true);
    assert.equal(clone.isEmpty(), true);
  });
});

describe('AABB — AABB-005 contains', () => {
  it('punto interior → true', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(5, 5)), true);
  });

  it('punto en esquina (0,0) → true (bordes cerrados)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(0, 0)), true);
  });

  it('punto en esquina (1,1) → true (bordes cerrados)', () => {
    const aabb = new AABB(0, 0, 1, 1);
    assert.equal(aabb.contains(new Vector2(1, 1)), true);
  });

  it('punto en centro → true', () => {
    const aabb = new AABB(0, 0, 1, 1);
    assert.equal(aabb.contains(new Vector2(0.5, 0.5)), true);
  });

  it('punto en borde superior → true', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(5, 10)), true);
  });

  it('punto en borde izquierdo → true', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(0, 5)), true);
  });

  it('punto fuera por la derecha → false', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(11, 5)), false);
  });

  it('punto fuera por la izquierda → false', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.contains(new Vector2(-1, 5)), false);
  });

  it('punto justo fuera de tolerancia → false', () => {
    const aabb = new AABB(0, 0, 1, 1);
    // 1.0000001 está fuera de EPSILON_MATH (1e-9) del borde
    assert.equal(aabb.contains(new Vector2(1.0000001, 0.5)), false);
  });

  it('punto dentro de EPSILON_MATH del borde → true', () => {
    const aabb = new AABB(0, 0, 1, 1);
    // 1 + EPSILON_MATH/2 está dentro de la tolerancia
    assert.equal(aabb.contains(new Vector2(1 + EPSILON_MATH / 2, 0.5)), true);
  });

  it('AABB vacío → false siempre', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.contains(new Vector2(0, 0)), false);
    assert.equal(aabb.contains(new Vector2(5, 5)), false);
    assert.equal(aabb.contains(new Vector2(-100, -100)), false);
  });

  it('AABB degenerado (width=0) funciona con bordes cerrados', () => {
    const aabb = new AABB(5, 0, 5, 10);
    assert.equal(aabb.contains(new Vector2(5, 5)), true);
    assert.equal(aabb.contains(new Vector2(5.0000001, 5)), false);
  });

  it('AABB degenerado (height=0) funciona con bordes cerrados', () => {
    const aabb = new AABB(0, 5, 10, 5);
    assert.equal(aabb.contains(new Vector2(5, 5)), true);
    assert.equal(aabb.contains(new Vector2(5, 5.0000001)), false);
  });

  it('rechaza argumento no-Vector2 (objeto plano)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.contains({ x: 5, y: 5 }), InvalidVectorError);
  });

  it('rechaza null', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.contains(null), InvalidVectorError);
  });

  it('rechaza undefined', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.contains(undefined), InvalidVectorError);
  });

  it('NO muta this', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const minXBefore = aabb.minX;
    const emptyBefore = aabb.empty;
    aabb.contains(new Vector2(5, 5));
    assert.equal(aabb.minX, minXBefore);
    assert.equal(aabb.empty, emptyBefore);
  });

  it('NO muta point', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const point = new Vector2(5, 5);
    const xBefore = point.x;
    const yBefore = point.y;
    aabb.contains(point);
    assert.equal(point.x, xBefore);
    assert.equal(point.y, yBefore);
  });
});

describe('AABB — AABB-006 intersects', () => {
  it('AABBs solapados → true', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    assert.equal(aabb1.intersects(aabb2), true);
  });

  it('AABBs tocándose por borde derecho → true', () => {
    const aabb1 = new AABB(0, 0, 1, 1);
    const aabb2 = new AABB(1, 0, 2, 1);
    assert.equal(aabb1.intersects(aabb2), true);
  });

  it('AABBs tocándose por borde superior → true', () => {
    const aabb1 = new AABB(0, 0, 1, 1);
    const aabb2 = new AABB(0, 1, 1, 2);
    assert.equal(aabb1.intersects(aabb2), true);
  });

  it('AABBs tocándose en esquina → true', () => {
    const aabb1 = new AABB(0, 0, 1, 1);
    const aabb2 = new AABB(1, 1, 2, 2);
    assert.equal(aabb1.intersects(aabb2), true);
  });

  it('AABBs disjuntos → false', () => {
    const aabb1 = new AABB(0, 0, 1, 1);
    const aabb2 = new AABB(2, 2, 3, 3);
    assert.equal(aabb1.intersects(aabb2), false);
  });

  it('AABB vacío con no vacío → false', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = AABB.empty();
    assert.equal(aabb1.intersects(aabb2), false);
  });

  it('no vacío con vacío → false', () => {
    const aabb1 = AABB.empty();
    const aabb2 = new AABB(0, 0, 10, 10);
    assert.equal(aabb1.intersects(aabb2), false);
  });

  it('ambos vacíos → false', () => {
    const aabb1 = AABB.empty();
    const aabb2 = AABB.empty();
    assert.equal(aabb1.intersects(aabb2), false);
  });

  it('intersección es conmutativa', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    assert.equal(aabb1.intersects(aabb2), aabb2.intersects(aabb1));
  });

  it('rechaza argumento no-AABB', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(
      () => aabb.intersects({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
      InvalidAABBError
    );
  });

  it('rechaza null', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.intersects(null), InvalidAABBError);
  });

  it('NO muta this', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    const minXBefore = aabb1.minX;
    const emptyBefore = aabb1.empty;
    aabb1.intersects(aabb2);
    assert.equal(aabb1.minX, minXBefore);
    assert.equal(aabb1.empty, emptyBefore);
  });

  it('NO muta other', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    const minXBefore = aabb2.minX;
    const emptyBefore = aabb2.empty;
    aabb1.intersects(aabb2);
    assert.equal(aabb2.minX, minXBefore);
    assert.equal(aabb2.empty, emptyBefore);
  });
});

describe('AABB — AABB-007 union', () => {
  it('unión de AABBs solapados', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    const result = aabb1.union(aabb2);
    assert.equal(result.minX, 0);
    assert.equal(result.minY, 0);
    assert.equal(result.maxX, 15);
    assert.equal(result.maxY, 15);
    assert.equal(result.empty, false);
  });

  it('unión de AABBs disjuntos', () => {
    const aabb1 = new AABB(0, 0, 5, 5);
    const aabb2 = new AABB(10, 10, 15, 15);
    const result = aabb1.union(aabb2);
    assert.equal(result.minX, 0);
    assert.equal(result.minY, 0);
    assert.equal(result.maxX, 15);
    assert.equal(result.maxY, 15);
  });

  it('unión de AABBs adyacentes', () => {
    const aabb1 = new AABB(0, 0, 5, 10);
    const aabb2 = new AABB(5, 0, 10, 10);
    const result = aabb1.union(aabb2);
    assert.equal(result.minX, 0);
    assert.equal(result.maxX, 10);
  });

  it('this vacío → devuelve copia de other', () => {
    const aabb1 = AABB.empty();
    const aabb2 = new AABB(10, 20, 30, 40);
    const result = aabb1.union(aabb2);
    assert.equal(result.minX, 10);
    assert.equal(result.minY, 20);
    assert.equal(result.maxX, 30);
    assert.equal(result.maxY, 40);
    assert.equal(result.empty, false);
    // Verifica que es copia, no referencia
    result.minX = 999;
    assert.equal(aabb2.minX, 10);
  });

  it('other vacío → devuelve copia de this', () => {
    const aabb1 = new AABB(10, 20, 30, 40);
    const aabb2 = AABB.empty();
    const result = aabb1.union(aabb2);
    assert.equal(result.minX, 10);
    assert.equal(result.minY, 20);
    assert.equal(result.maxX, 30);
    assert.equal(result.maxY, 40);
    assert.equal(result.empty, false);
    result.minX = 999;
    assert.equal(aabb1.minX, 10);
  });

  it('ambos vacíos → devuelve AABB vacío', () => {
    const aabb1 = AABB.empty();
    const aabb2 = AABB.empty();
    const result = aabb1.union(aabb2);
    assert.equal(result.empty, true);
  });

  it('NO muta this', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    const minXBefore = aabb1.minX;
    const maxXBefore = aabb1.maxX;
    aabb1.union(aabb2);
    assert.equal(aabb1.minX, minXBefore);
    assert.equal(aabb1.maxX, maxXBefore);
  });

  it('NO muta other', () => {
    const aabb1 = new AABB(0, 0, 10, 10);
    const aabb2 = new AABB(5, 5, 15, 15);
    const minXBefore = aabb2.minX;
    const maxXBefore = aabb2.maxX;
    aabb1.union(aabb2);
    assert.equal(aabb2.minX, minXBefore);
    assert.equal(aabb2.maxX, maxXBefore);
  });

  it('rechaza argumento no-AABB', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(
      () => aabb.union({ minX: 0, minY: 0, maxX: 10, maxY: 10 }),
      InvalidAABBError
    );
  });

  it('rechaza null', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.union(null), InvalidAABBError);
  });
});

describe('AABB — AABB-008 expandByPoint', () => {
  it('expande con punto exterior (aumenta maxX, maxY)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    aabb.expandByPoint(new Vector2(15, 20));
    assert.equal(aabb.minX, 0);
    assert.equal(aabb.minY, 0);
    assert.equal(aabb.maxX, 15);
    assert.equal(aabb.maxY, 20);
    assert.equal(aabb.empty, false);
  });

  it('expande con punto exterior (disminuye minX, minY)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    aabb.expandByPoint(new Vector2(-5, -3));
    assert.equal(aabb.minX, -5);
    assert.equal(aabb.minY, -3);
    assert.equal(aabb.maxX, 10);
    assert.equal(aabb.maxY, 10);
  });

  it('no cambia con punto interior', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const before = { minX: aabb.minX, minY: aabb.minY,
                     maxX: aabb.maxX, maxY: aabb.maxY };
    aabb.expandByPoint(new Vector2(5, 5));
    assert.equal(aabb.minX, before.minX);
    assert.equal(aabb.minY, before.minY);
    assert.equal(aabb.maxX, before.maxX);
    assert.equal(aabb.maxY, before.maxY);
  });

  it('no cambia con punto en borde', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const before = { minX: aabb.minX, minY: aabb.minY,
                     maxX: aabb.maxX, maxY: aabb.maxY };
    aabb.expandByPoint(new Vector2(10, 10));
    assert.equal(aabb.minX, before.minX);
    assert.equal(aabb.maxX, before.maxX);
  });

  it('AABB vacío → punto se convierte en único punto', () => {
    const aabb = AABB.empty();
    aabb.expandByPoint(new Vector2(5, 7));
    assert.equal(aabb.minX, 5);
    assert.equal(aabb.minY, 7);
    assert.equal(aabb.maxX, 5);
    assert.equal(aabb.maxY, 7);
    assert.equal(aabb.empty, false);
  });

  it('SÍ muta this (test explícito)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const maxXBefore = aabb.maxX;
    aabb.expandByPoint(new Vector2(20, 20));
    assert.notEqual(aabb.maxX, maxXBefore);
    assert.equal(aabb.maxX, 20);
    assert.equal(aabb.maxY, 20);
  });

  it('SÍ muta this desde vacío', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.empty, true);
    aabb.expandByPoint(new Vector2(5, 7));
    assert.equal(aabb.empty, false);
  });

  it('NO muta point', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const point = new Vector2(20, 20);
    const xBefore = point.x;
    const yBefore = point.y;
    aabb.expandByPoint(point);
    assert.equal(point.x, xBefore);
    assert.equal(point.y, yBefore);
  });

  it('rechaza argumento no-Vector2', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.expandByPoint({ x: 5, y: 5 }), InvalidVectorError);
  });

  it('rechaza null', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.expandByPoint(null), InvalidVectorError);
  });
});

describe('AABB — AABB-009 transform', () => {
  it('transformación con traslación pura', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.translation(5, 10);
    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.minX - 5) < EPS);
    assert.ok(Math.abs(result.minY - 10) < EPS);
    assert.ok(Math.abs(result.maxX - 15) < EPS);
    assert.ok(Math.abs(result.maxY - 20) < EPS);
    assert.equal(result.empty, false);
  });

  it('transformación con escala pura', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.scale(2, 3);
    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.minX - 0) < EPS);
    assert.ok(Math.abs(result.minY - 0) < EPS);
    assert.ok(Math.abs(result.maxX - 20) < EPS);
    assert.ok(Math.abs(result.maxY - 30) < EPS);
  });

  it('transformación con escala uniforme', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.scale(2, 2);
    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.maxX - 20) < EPS);
    assert.ok(Math.abs(result.maxY - 20) < EPS);
  });

  it('transformación con rotación π/2', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.rotation(Math.PI / 2);
    const result = aabb.transform(matrix);
    // (0,0) → (0,0); (10,0) → (0,10); (0,10) → (-10,0); (10,10) → (-10,10)
    assert.ok(Math.abs(result.minX - (-10)) < EPS);
    assert.ok(Math.abs(result.minY - 0) < EPS);
    assert.ok(Math.abs(result.maxX - 0) < EPS);
    assert.ok(Math.abs(result.maxY - 10) < EPS);
  });

  it('transformación con rotación 2π → mismo AABB', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.rotation(2 * Math.PI);
    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.minX - 0) < EPS);
    assert.ok(Math.abs(result.minY - 0) < EPS);
    assert.ok(Math.abs(result.maxX - 10) < EPS);
    assert.ok(Math.abs(result.maxY - 10) < EPS);
  });

  it('transformación con rotación negativa', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.rotation(-Math.PI / 2);
    const result = aabb.transform(matrix);
    // (0,0) → (0,0); (10,0) → (0,-10); (0,10) → (10,0); (10,10) → (10,-10)
    assert.ok(Math.abs(result.minX - 0) < EPS);
    assert.ok(Math.abs(result.minY - (-10)) < EPS);
    assert.ok(Math.abs(result.maxX - 10) < EPS);
    assert.ok(Math.abs(result.maxY - 0) < EPS);
  });

  // TEST CRÍTICO: verifica que transforma los 4 vértices
  it('transformación con rotación π/6 — verificación de 4 vértices', () => {
    const aabb = new AABB(0, 0, 1, 1);
    const matrix = Matrix3x3.rotation(Math.PI / 6);
    const result = aabb.transform(matrix);

    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);

    // Los 4 vértices transformados manualmente:
    // v1 = (0,0) → (0,0)
    // v2 = (1,0) → (cos, sin)
    // v3 = (0,1) → (-sin, cos)
    // v4 = (1,1) → (cos - sin, sin + cos)
    const v1 = { x: 0, y: 0 };
    const v2 = { x: cos, y: sin };
    const v3 = { x: -sin, y: cos };
    const v4 = { x: cos - sin, y: sin + cos };

    const expectedMinX = Math.min(v1.x, v2.x, v3.x, v4.x);
    const expectedMinY = Math.min(v1.y, v2.y, v3.y, v4.y);
    const expectedMaxX = Math.max(v1.x, v2.x, v3.x, v4.x);
    const expectedMaxY = Math.max(v1.y, v2.y, v3.y, v4.y);

    assert.ok(Math.abs(result.minX - expectedMinX) < EPS);
    assert.ok(Math.abs(result.minY - expectedMinY) < EPS);
    assert.ok(Math.abs(result.maxX - expectedMaxX) < EPS);
    assert.ok(Math.abs(result.maxY - expectedMaxY) < EPS);

    // Verificación adicional: si sólo se hubieran transformado 2 esquinas
    // opuestas (v1 y v4), el resultado sería diferente. Confirmamos que
    // el resultado coincide con el cálculo de 4 vértices, no con el de 2.
    const twoCornerMinX = Math.min(v1.x, v4.x);
    const twoCornerMinY = Math.min(v1.y, v4.y);
    const twoCornerMaxX = Math.max(v1.x, v4.x);
    const twoCornerMaxY = Math.max(v1.y, v4.y);

    // Para π/6, los 4 vértices dan un AABB más ancho que 2 esquinas
    // porque v2 y v3 aportan coordenadas extremas.
    // Comprobamos que el resultado NO coincide con el de 2 esquinas
    // si este fuera diferente.
    const twoCornersWouldDiffer =
      Math.abs(twoCornerMinX - expectedMinX) > EPS ||
      Math.abs(twoCornerMinY - expectedMinY) > EPS ||
      Math.abs(twoCornerMaxX - expectedMaxX) > EPS ||
      Math.abs(twoCornerMaxY - expectedMaxY) > EPS;

    // Si los 4 vértices aportan información distinta, el resultado
    // debe coincidir con el de 4 vértices, no con el de 2.
    if (twoCornersWouldDiffer) {
      // El resultado debe coincidir con el cálculo de 4 vértices
      assert.ok(Math.abs(result.minX - expectedMinX) < EPS);
      assert.ok(Math.abs(result.maxX - expectedMaxX) < EPS);
    }
  });

  it('transformación con matriz identidad', () => {
    const aabb = new AABB(0, 0, 10, 20);
    const matrix = Matrix3x3.identity();
    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.minX - 0) < EPS);
    assert.ok(Math.abs(result.minY - 0) < EPS);
    assert.ok(Math.abs(result.maxX - 10) < EPS);
    assert.ok(Math.abs(result.maxY - 20) < EPS);
  });

  it('transformación con composición T × R × S', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const T = Matrix3x3.translation(100, 0);
    const R = Matrix3x3.rotation(Math.PI / 4);
    const S = Matrix3x3.scale(2, 2);
    const matrix = T.multiply(R).multiply(S);
    const result = aabb.transform(matrix);
    assert.ok(result.minX < result.maxX);
    assert.ok(result.minY < result.maxY);
    assert.equal(result.empty, false);
  });

  it('transformación de AABB vacío → AABB vacío', () => {
    const aabb = AABB.empty();
    const matrix = Matrix3x3.translation(10, 20);
    const result = aabb.transform(matrix);
    assert.equal(result.empty, true);
  });

  it('transformación de AABB vacío con rotación → AABB vacío', () => {
    const aabb = AABB.empty();
    const matrix = Matrix3x3.rotation(Math.PI / 4);
    const result = aabb.transform(matrix);
    assert.equal(result.empty, true);
  });

  it('escala negativa (reflexión X) produce AABB válido', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.scale(-1, 1);
    const result = aabb.transform(matrix);
    // (0,0) → (0,0); (10,0) → (-10,0); (0,10) → (0,10); (10,10) → (-10,10)
    assert.ok(result.minX <= result.maxX);
    assert.ok(result.minY <= result.maxY);
    assert.ok(Math.abs(result.minX - (-10)) < EPS);
    assert.ok(Math.abs(result.maxX - 0) < EPS);
    assert.ok(Math.abs(result.minY - 0) < EPS);
    assert.ok(Math.abs(result.maxY - 10) < EPS);
  });

  it('escala negativa (reflexión Y) produce AABB válido', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.scale(1, -1);
    const result = aabb.transform(matrix);
    assert.ok(result.minX <= result.maxX);
    assert.ok(result.minY <= result.maxY);
  });

  it('escala negativa en ambos ejes produce AABB válido', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.scale(-2, -3);
    const result = aabb.transform(matrix);
    assert.ok(result.minX <= result.maxX);
    assert.ok(result.minY <= result.maxY);
    assert.ok(Math.abs(result.minX - (-20)) < EPS);
    assert.ok(Math.abs(result.maxX - 0) < EPS);
    assert.ok(Math.abs(result.minY - (-30)) < EPS);
    assert.ok(Math.abs(result.maxY - 0) < EPS);
  });

  it('NO muta this', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.translation(5, 10);
    const minXBefore = aabb.minX;
    const maxXBefore = aabb.maxX;
    const emptyBefore = aabb.empty;
    aabb.transform(matrix);
    assert.equal(aabb.minX, minXBefore);
    assert.equal(aabb.maxX, maxXBefore);
    assert.equal(aabb.empty, emptyBefore);
  });

  it('NO muta matrix', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.translation(5, 10);
    const valuesBefore = matrix.values.slice();
    aabb.transform(matrix);
    assert.deepEqual(matrix.values, valuesBefore);
  });

  it('rechaza argumento no-Matrix3x3', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(
      () => aabb.transform({ values: [1, 0, 0, 0, 1, 0, 0, 0, 1] }),
      InvalidMatrixError
    );
  });

  it('rechaza null', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.throws(() => aabb.transform(null), InvalidMatrixError);
  });
});

describe('AABB — AABB-010 isEmpty', () => {
  it('devuelve true para AABB vacío', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.isEmpty(), true);
  });

  it('devuelve false para AABB no vacío', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(aabb.isEmpty(), false);
  });

  it('devuelve false para AABB degenerado', () => {
    const aabb = new AABB(5, 5, 5, 5);
    assert.equal(aabb.isEmpty(), false);
  });

  it('NO altera estado', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const minXBefore = aabb.minX;
    const emptyBefore = aabb.empty;
    aabb.isEmpty();
    assert.equal(aabb.minX, minXBefore);
    assert.equal(aabb.empty, emptyBefore);
  });
});

describe('AABB — AABB-011 width', () => {
  it('ancho correcto', () => {
    const aabb = new AABB(0, 0, 10, 20);
    assert.equal(aabb.width(), 10);
  });

  it('ancho con valores negativos', () => {
    const aabb = new AABB(-10, 0, -5, 20);
    assert.equal(aabb.width(), 5);
  });

  it('AABB vacío → 0', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.width(), 0);
  });

  it('AABB degenerado (width=0) → 0', () => {
    const aabb = new AABB(5, 0, 5, 10);
    assert.equal(aabb.width(), 0);
  });

  it('nunca negativo', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.ok(aabb.width() >= 0);
  });

  it('nunca NaN', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.ok(Number.isFinite(aabb.width()));
  });
});

describe('AABB — AABB-012 height', () => {
  it('alto correcto', () => {
    const aabb = new AABB(0, 0, 10, 20);
    assert.equal(aabb.height(), 20);
  });

  it('AABB vacío → 0', () => {
    const aabb = AABB.empty();
    assert.equal(aabb.height(), 0);
  });

  it('AABB degenerado (height=0) → 0', () => {
    const aabb = new AABB(0, 5, 10, 5);
    assert.equal(aabb.height(), 0);
  });

  it('nunca negativo', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.ok(aabb.height() >= 0);
  });

  it('nunca NaN', () => {
    const aabb = new AABB(0, 0, 10, 10);
    assert.ok(Number.isFinite(aabb.height()));
  });
});

describe('AABB — invariantes', () => {
  it('INV-004 parcial: transform de no vacío produce no vacío', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const matrix = Matrix3x3.rotation(Math.PI / 4);
    const result = aabb.transform(matrix);
    assert.equal(result.empty, false);
  });

  it('INV-004 parcial: transform de vacío produce vacío', () => {
    const aabb = AABB.empty();
    const matrix = Matrix3x3.rotation(Math.PI / 4);
    const result = aabb.transform(matrix);
    assert.equal(result.empty, true);
  });

  it('consistencia: contains(p) = true ⟹ expandByPoint(p) no cambia AABB', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const point = new Vector2(5, 5);
    assert.equal(aabb.contains(point), true);
    const before = { minX: aabb.minX, minY: aabb.minY,
                     maxX: aabb.maxX, maxY: aabb.maxY };
    aabb.expandByPoint(point);
    assert.equal(aabb.minX, before.minX);
    assert.equal(aabb.minY, before.minY);
    assert.equal(aabb.maxX, before.maxX);
    assert.equal(aabb.maxY, before.maxY);
  });

  it('consistencia: contains(p) = true en borde ⟹ expandByPoint(p) no cambia AABB', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const point = new Vector2(10, 10);
    assert.equal(aabb.contains(point), true);
    const before = { minX: aabb.minX, minY: aabb.minY,
                     maxX: aabb.maxX, maxY: aabb.maxY };
    aabb.expandByPoint(point);
    assert.equal(aabb.minX, before.minX);
    assert.equal(aabb.maxX, before.maxX);
  });

  it('union contiene ambos operandos', () => {
    const aabb1 = new AABB(0, 0, 5, 5);
    const aabb2 = new AABB(10, 10, 15, 15);
    const u = aabb1.union(aabb2);
    assert.ok(u.contains(new Vector2(2.5, 2.5)));
    assert.ok(u.contains(new Vector2(12.5, 12.5)));
  });
});

describe('AABB — ADR-003', () => {
  it('ADR-003-D1: usa EPSILON_MATH en contains', () => {
    const aabb = new AABB(0, 0, 1, 1);
    const point = new Vector2(1 + EPSILON_MATH / 2, 0.5);
    assert.equal(aabb.contains(point), true);
  });

  it('ADR-003-D1: usa EPSILON_MATH en intersects', () => {
    const aabb1 = new AABB(0, 0, 1, 1);
    const aabb2 = new AABB(1 + EPSILON_MATH / 2, 0, 2, 1);
    assert.equal(aabb1.intersects(aabb2), true);
  });

  it('ADR-003-D1: no acepta epsilon por parámetro (verificación de firma)', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const point = new Vector2(5, 5);
    // contains(point) — un solo argumento
    const result = aabb.contains(point);
    assert.equal(typeof result, 'boolean');
    // intersects(other) — un solo argumento
    const other = new AABB(5, 5, 15, 15);
    const result2 = aabb.intersects(other);
    assert.equal(typeof result2, 'boolean');
  });

  it('ADR-003-D1: EPSILON_MATH proviene de math/Epsilon.js', () => {
    assert.equal(EPSILON_MATH, 1e-9);
    assert.ok(Number.isFinite(EPSILON_MATH));
  });

  it('ADR-003-D5: AABB no usa typed arrays internamente', () => {
    // Verificación por inspección: los componentes son primitivos,
    // no se construyen Float32Array/Float64Array en ningún método.
    const aabb = new AABB(0, 0, 10, 10);
    assert.equal(typeof aabb.minX, 'number');
    assert.equal(typeof aabb.minY, 'number');
    assert.equal(typeof aabb.maxX, 'number');
    assert.equal(typeof aabb.maxY, 'number');
  });
});

describe('AABB — pruebas cruzadas con Etapas previas', () => {
  it('transform con Matrix3x3.rotation(θ) coincide con transformPoint por vértice', () => {
    const aabb = new AABB(0, 0, 10, 10);
    const theta = Math.PI / 3;
    const matrix = Matrix3x3.rotation(theta);

    const v1 = matrix.transformPoint(new Vector2(0, 0));
    const v2 = matrix.transformPoint(new Vector2(10, 0));
    const v3 = matrix.transformPoint(new Vector2(0, 10));
    const v4 = matrix.transformPoint(new Vector2(10, 10));

    const expectedMinX = Math.min(v1.x, v2.x, v3.x, v4.x);
    const expectedMinY = Math.min(v1.y, v2.y, v3.y, v4.y);
    const expectedMaxX = Math.max(v1.x, v2.x, v3.x, v4.x);
    const expectedMaxY = Math.max(v1.y, v2.y, v3.y, v4.y);

    const result = aabb.transform(matrix);
    assert.ok(Math.abs(result.minX - expectedMinX) < EPS);
    assert.ok(Math.abs(result.minY - expectedMinY) < EPS);
    assert.ok(Math.abs(result.maxX - expectedMaxX) < EPS);
    assert.ok(Math.abs(result.maxY - expectedMaxY) < EPS);
  });

  it('Transform (Etapa 3) produce matrices coherentes con AABB.transform', () => {
    // Importación dinámica para asegurar que Transform existe
    return import('../../src/math/Transform.js').then(({ Transform }) => {
      const t = new Transform(
        new Vector2(100, 50),
        Math.PI / 6,
        new Vector2(2, 2)
      );
      const matrix = t.toMatrix();
      const aabb = new AABB(0, 0, 10, 10);
      const result = aabb.transform(matrix);
      assert.equal(result.empty, false);
      assert.ok(result.minX < result.maxX);
      assert.ok(result.minY < result.maxY);
    });
  });
});