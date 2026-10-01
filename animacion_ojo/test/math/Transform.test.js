import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform } from '../../src/math/Transform.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { Matrix3x3 } from '../../src/math/Matrix3x3.js';
import { InvalidNumericInputError } from '../../src/errors/InvalidNumericInputError.js';
import { InvalidVectorError } from '../../src/errors/InvalidVectorError.js';

const EPS = 1e-9;

describe('Transform — TRN-001 constructor', () => {
  it('sin argumentos produce defaults correctos', () => {
    const t = new Transform();
    const p = t.getPosition();
    assert.ok(p.equalsApprox(new Vector2(0, 0), EPS));
    assert.equal(t.getRotation(), 0);
    const s = t.getScale();
    assert.ok(s.equalsApprox(new Vector2(1, 1), EPS));
    assert.equal(t.isDirty(), true);
  });

  it('con argumentos explícitos produce estado exacto', () => {
    const pos = new Vector2(10, 20);
    const rot = Math.PI / 4;
    const scl = new Vector2(2, 3);
    const t = new Transform(pos, rot, scl);
    assert.ok(t.getPosition().equalsApprox(pos, EPS));
    assert.equal(t.getRotation(), rot);
    assert.ok(t.getScale().equalsApprox(scl, EPS));
    assert.equal(t.isDirty(), true);
  });

  it('defensa contra aliasing: mutar Vector2 pasado al constructor no afecta', () => {
    const pos = new Vector2(10, 20);
    const t = new Transform(pos, 0, new Vector2(1, 1));
    pos.x = 999;
    pos.y = 888;
    const stored = t.getPosition();
    assert.ok(stored.equalsApprox(new Vector2(10, 20), EPS));
  });

  it('rechaza position no-Vector2', () => {
    assert.throws(() => new Transform({ x: 1, y: 2 }, 0, new Vector2(1, 1)), InvalidVectorError);
  });

  it('rechaza rotation NaN', () => {
    assert.throws(() => new Transform(new Vector2(0, 0), NaN, new Vector2(1, 1)), InvalidNumericInputError);
  });

  it('rechaza rotation Infinity', () => {
    assert.throws(() => new Transform(new Vector2(0, 0), Infinity, new Vector2(1, 1)), InvalidNumericInputError);
  });

  it('rechaza scale no-Vector2', () => {
    assert.throws(() => new Transform(new Vector2(0, 0), 0, { x: 1, y: 1 }), InvalidVectorError);
  });

  it('acepta escala (0,0)', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(0, 0));
    assert.ok(t.getScale().equalsApprox(new Vector2(0, 0), EPS));
  });

  it('acepta escala negativa', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(-1, -1));
    assert.ok(t.getScale().equalsApprox(new Vector2(-1, -1), EPS));
  });
});

describe('Transform — TRN-002 getPosition', () => {
  it('devuelve copia independiente', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const p1 = t.getPosition();
    const p2 = t.getPosition();
    assert.notEqual(p1, p2);
    assert.ok(p1.equalsApprox(p2, EPS));
  });

  it('mutar resultado no altera interno', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const p = t.getPosition();
    p.x = 999;
    const p2 = t.getPosition();
    assert.ok(p2.equalsApprox(new Vector2(10, 20), EPS));
  });

  it('NO altera dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.getPosition();
    assert.equal(t.isDirty(), false);
  });
});

describe('Transform — TRN-003 setPosition', () => {
  it('con valor distinto marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setPosition(new Vector2(10, 20));
    assert.equal(t.isDirty(), true);
  });

  it('con valor igual dentro de tolerancia NO ensucia', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setPosition(new Vector2(10 + 1e-7, 20));
    assert.equal(t.isDirty(), false);
  });

  it('no altera rotation ni scale', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(2, 3));
    t.setPosition(new Vector2(10, 20));
    assert.equal(t.getRotation(), Math.PI / 4);
    assert.ok(t.getScale().equalsApprox(new Vector2(2, 3), EPS));
  });

  it('guarda copia, no referencia', () => {
    const t = new Transform();
    const pos = new Vector2(10, 20);
    t.setPosition(pos);
    pos.x = 999;
    const stored = t.getPosition();
    assert.ok(stored.equalsApprox(new Vector2(10, 20), EPS));
  });

  it('rechaza null', () => {
    const t = new Transform();
    assert.throws(() => t.setPosition(null), InvalidVectorError);
  });

  it('rechaza Vector2 con NaN', () => {
    const t = new Transform();
    const bad = new Vector2(0, 0);
    bad.x = NaN;
    assert.throws(() => t.setPosition(bad), InvalidVectorError);
  });
});

describe('Transform — TRN-004 translate', () => {
  it('suma correctamente', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    t.translate(new Vector2(5, -3));
    assert.ok(t.getPosition().equalsApprox(new Vector2(15, 17), EPS));
  });

  it('marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.translate(new Vector2(1, 0));
    assert.equal(t.isDirty(), true);
  });

  it('no altera rotation ni scale', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(2, 3));
    t.translate(new Vector2(10, 10));
    assert.equal(t.getRotation(), Math.PI / 4);
    assert.ok(t.getScale().equalsApprox(new Vector2(2, 3), EPS));
  });

  it('delta cero marca dirty (operación explícita)', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.translate(new Vector2(0, 0));
    assert.equal(t.isDirty(), true);
  });

  it('rechaza delta no-Vector2', () => {
    const t = new Transform();
    assert.throws(() => t.translate({ x: 1, y: 2 }), InvalidVectorError);
  });
});

describe('Transform — TRN-005 getRotation', () => {
  it('devuelve valor correcto', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(1, 1));
    assert.equal(t.getRotation(), Math.PI / 4);
  });

  it('NO altera dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.getRotation();
    assert.equal(t.isDirty(), false);
  });
});

describe('Transform — TRN-006 setRotation', () => {
  it('con valor distinto marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setRotation(Math.PI / 4);
    assert.equal(t.isDirty(), true);
  });

  it('con valor igual NO ensucia', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setRotation(Math.PI / 4);
    assert.equal(t.isDirty(), false);
  });

  it('con valor dentro de tolerancia NO ensucia', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setRotation(Math.PI / 4 + 1e-7);
    assert.equal(t.isDirty(), false);
  });

  it('no altera position ni scale', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(2, 3));
    t.setRotation(Math.PI / 4);
    assert.ok(t.getPosition().equalsApprox(new Vector2(10, 20), EPS));
    assert.ok(t.getScale().equalsApprox(new Vector2(2, 3), EPS));
  });

  it('rechaza NaN', () => {
    const t = new Transform();
    assert.throws(() => t.setRotation(NaN), InvalidNumericInputError);
  });

  it('rechaza Infinity', () => {
    const t = new Transform();
    assert.throws(() => t.setRotation(Infinity), InvalidNumericInputError);
  });
});

describe('Transform — TRN-007 rotate', () => {
  it('suma correctamente', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(1, 1));
    t.rotate(Math.PI / 4);
    assert.ok(Math.abs(t.getRotation() - Math.PI / 2) < EPS);
  });

  it('marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.rotate(0.1);
    assert.equal(t.isDirty(), true);
  });

  it('no altera position ni scale', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(2, 3));
    t.rotate(Math.PI / 4);
    assert.ok(t.getPosition().equalsApprox(new Vector2(10, 20), EPS));
    assert.ok(t.getScale().equalsApprox(new Vector2(2, 3), EPS));
  });

  it('delta cero marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.rotate(0);
    assert.equal(t.isDirty(), true);
  });

  it('rechaza NaN', () => {
    const t = new Transform();
    assert.throws(() => t.rotate(NaN), InvalidNumericInputError);
  });
});

describe('Transform — TRN-008 getScale', () => {
  it('devuelve copia independiente', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 3));
    const s1 = t.getScale();
    const s2 = t.getScale();
    assert.notEqual(s1, s2);
    assert.ok(s1.equalsApprox(s2, EPS));
  });

  it('mutar resultado no altera interno', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 3));
    const s = t.getScale();
    s.x = 999;
    const s2 = t.getScale();
    assert.ok(s2.equalsApprox(new Vector2(2, 3), EPS));
  });

  it('NO altera dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.getScale();
    assert.equal(t.isDirty(), false);
  });
});

describe('Transform — TRN-009 setScale', () => {
  it('con valor distinto marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setScale(new Vector2(2, 2));
    assert.equal(t.isDirty(), true);
  });

  it('con valor igual NO ensucia', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 2));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setScale(new Vector2(2, 2));
    assert.equal(t.isDirty(), false);
  });

  it('no altera position ni rotation', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(1, 1));
    t.setScale(new Vector2(2, 3));
    assert.ok(t.getPosition().equalsApprox(new Vector2(10, 20), EPS));
    assert.equal(t.getRotation(), Math.PI / 4);
  });

  it('guarda copia, no referencia', () => {
    const t = new Transform();
    const scl = new Vector2(2, 3);
    t.setScale(scl);
    scl.x = 999;
    const stored = t.getScale();
    assert.ok(stored.equalsApprox(new Vector2(2, 3), EPS));
  });

  it('rechaza null', () => {
    const t = new Transform();
    assert.throws(() => t.setScale(null), InvalidVectorError);
  });

  it('acepta escala (0,0)', () => {
    const t = new Transform();
    t.setScale(new Vector2(0, 0));
    assert.ok(t.getScale().equalsApprox(new Vector2(0, 0), EPS));
  });
});

describe('Transform — TRN-010 scaleBy', () => {
  it('multiplica componente a componente', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 3));
    t.scaleBy(new Vector2(3, 2));
    assert.ok(t.getScale().equalsApprox(new Vector2(6, 6), EPS));
  });

  it('marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.scaleBy(new Vector2(1, 1));
    assert.equal(t.isDirty(), true);
  });

  it('no altera position ni rotation', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(1, 1));
    t.scaleBy(new Vector2(2, 2));
    assert.ok(t.getPosition().equalsApprox(new Vector2(10, 20), EPS));
    assert.equal(t.getRotation(), Math.PI / 4);
  });

  it('factor (1,1) marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.scaleBy(new Vector2(1, 1));
    assert.equal(t.isDirty(), true);
  });

  it('rechaza factor no-Vector2', () => {
    const t = new Transform();
    assert.throws(() => t.scaleBy({ x: 2, y: 2 }), InvalidVectorError);
  });
});

describe('Transform — TRN-011 toMatrix', () => {
  it('identidad devuelve identidad', () => {
    const t = new Transform();
    const m = t.toMatrix();
    assert.ok(m.equalsApprox(Matrix3x3.identity(), EPS));
  });

  it('traslación pura', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const m = t.toMatrix();
    const expected = Matrix3x3.translation(10, 20);
    assert.ok(m.equalsApprox(expected, EPS));
  });

  it('rotación pura', () => {
    const t = new Transform(new Vector2(0, 0), Math.PI / 2, new Vector2(1, 1));
    const m = t.toMatrix();
    const expected = Matrix3x3.rotation(Math.PI / 2);
    assert.ok(m.equalsApprox(expected, EPS));
  });

  it('escala pura', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 3));
    const m = t.toMatrix();
    const expected = Matrix3x3.scale(2, 3);
    assert.ok(m.equalsApprox(expected, EPS));
  });

  it('dos llamadas seguidas sin mutación dan mismo resultado', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    const m1 = t.toMatrix();
    const m2 = t.toMatrix();
    assert.ok(m1.equalsApprox(m2, EPS));
  });

  it('mutación después de toMatrix marca dirty', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setPosition(new Vector2(10, 20));
    assert.equal(t.isDirty(), true);
  });

  it('toMatrix limpia dirty al recomputar', () => {
    const t = new Transform();
    assert.equal(t.isDirty(), true);
    t.toMatrix();
    assert.equal(t.isDirty(), false);
  });

  it('toMatrix no muta position/rotation/scale', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    const pBefore = t.getPosition();
    const rBefore = t.getRotation();
    const sBefore = t.getScale();
    t.toMatrix();
    assert.ok(t.getPosition().equalsApprox(pBefore, EPS));
    assert.equal(t.getRotation(), rBefore);
    assert.ok(t.getScale().equalsApprox(sBefore, EPS));
  });

  it('resultado es copia, no caché mutable interna', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const m1 = t.toMatrix();
    m1.values[0] = 999;
    const m2 = t.toMatrix();
    assert.ok(m2.equalsApprox(Matrix3x3.translation(10, 20), EPS));
  });

  it('TRANS-01: padre × hijo consistente', () => {
    const parentT = new Transform(new Vector2(100, 0), 0, new Vector2(1, 1));
    const childT = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const composed = parentT.toMatrix().multiply(childT.toMatrix());
    const p = new Vector2(5, 5);
    const result1 = composed.transformPoint(p);
    const result2 = parentT.toMatrix().transformPoint(childT.toMatrix().transformPoint(p));
    assert.ok(result1.equalsApprox(result2, EPS));
  });

  it('TRANS-02: worldToLocal(localToWorld(P)) ≈ P', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 2));
    const m = t.toMatrix();
    const inv = m.invert();
    const p = new Vector2(50, 60);
    const transformed = m.transformPoint(p);
    const restored = inv.transformPoint(transformed);
    assert.ok(restored.equalsApprox(p, EPS));
  });

  it('TRANS-03: scale=(0,0) produce matriz no invertible', () => {
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(0, 0));
    const m = t.toMatrix();
    assert.throws(() => m.invert());
  });
});

describe('Transform — TRN-012 isDirty', () => {
  it('devuelve valor correcto', () => {
    const t = new Transform();
    assert.equal(t.isDirty(), true);
    t.toMatrix();
    assert.equal(t.isDirty(), false);
  });

  it('NO altera dirty', () => {
    const t = new Transform();
    const before = t.isDirty();
    t.isDirty();
    assert.equal(t.isDirty(), before);
  });
});

describe('Transform — TRN-013 clearDirty', () => {
  it('limpia dirty', () => {
    const t = new Transform();
    assert.equal(t.isDirty(), true);
    t.clearDirty();
    assert.equal(t.isDirty(), false);
  });

  it('no altera position/rotation/scale', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    const pBefore = t.getPosition();
    const rBefore = t.getRotation();
    const sBefore = t.getScale();
    t.clearDirty();
    assert.ok(t.getPosition().equalsApprox(pBefore, EPS));
    assert.equal(t.getRotation(), rBefore);
    assert.ok(t.getScale().equalsApprox(sBefore, EPS));
  });

  it('no altera matrixCache', () => {
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    const m1 = t.toMatrix();
    const cacheValues = m1.values.slice();
    t.clearDirty();
    const m2 = t.toMatrix();
    assert.ok(m2.equalsApprox(new Matrix3x3(cacheValues), EPS));
  });

  it('NO toca objetos externos (test conceptual de aislamiento)', () => {
    const fakeSceneNode = { dirtyFlags: { TRANSFORM_DIRTY: true, GEOMETRY_DIRTY: true } };
    const t = new Transform();
    t.clearDirty();
    assert.equal(fakeSceneNode.dirtyFlags.TRANSFORM_DIRTY, true);
    assert.equal(fakeSceneNode.dirtyFlags.GEOMETRY_DIRTY, true);
  });

  it('clearDirty con matrixCache=null es válido (estado estable)', () => {
    const t = new Transform();
    t.clearDirty();
    assert.equal(t.isDirty(), false);
    const m = t.toMatrix();
    assert.ok(m instanceof Matrix3x3);
  });
});

describe('Transform — determinismo', () => {
  it('mismas entradas → mismo toMatrix()', () => {
    const t1 = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    const t2 = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    assert.ok(t1.toMatrix().equalsApprox(t2.toMatrix(), EPS));
  });

  it('sin dependencia de orden de getters', () => {
    const t = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    t.getPosition();
    t.getRotation();
    t.getScale();
    const m1 = t.toMatrix();
    const t2 = new Transform(new Vector2(10, 20), Math.PI / 4, new Vector2(2, 3));
    const m2 = t2.toMatrix();
    assert.ok(m1.equalsApprox(m2, EPS));
  });
});

describe('Transform — INV-005', () => {
  it('ningún setter que cambie valor deja dirty=false', () => {
    const t = new Transform();
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    
    t.setPosition(new Vector2(1, 0));
    assert.equal(t.isDirty(), true);
    t.toMatrix();
    
    t.setRotation(0.1);
    assert.equal(t.isDirty(), true);
    t.toMatrix();
    
    t.setScale(new Vector2(2, 2));
    assert.equal(t.isDirty(), true);
  });
});

describe('Transform — ADR-003', () => {
  it('ADR-003-D4: setPosition con valor dentro de EPSILON_MATH no ensucia', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setPosition(new Vector2(10 + EPSILON_MATH / 2, 20));
    assert.equal(t.isDirty(), false);
  });

  it('ADR-003-D4: setPosition con valor fuera de EPSILON_MATH ensucia', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    const t = new Transform(new Vector2(10, 20), 0, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setPosition(new Vector2(10 + EPSILON_MATH * 10, 20));
    assert.equal(t.isDirty(), true);
  });

  it('ADR-003-D4: setRotation con valor dentro de EPSILON_MATH no ensucia', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    const t = new Transform(new Vector2(0, 0), Math.PI / 4, new Vector2(1, 1));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setRotation(Math.PI / 4 + EPSILON_MATH / 2);
    assert.equal(t.isDirty(), false);
  });

  it('ADR-003-D4: setScale con valor dentro de EPSILON_MATH no ensucia', async () => {
    const { EPSILON_MATH } = await import('../../src/math/Epsilon.js');
    const t = new Transform(new Vector2(0, 0), 0, new Vector2(2, 2));
    t.toMatrix();
    assert.equal(t.isDirty(), false);
    t.setScale(new Vector2(2 + EPSILON_MATH / 2, 2));
    assert.equal(t.isDirty(), false);
  });
});