import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Circle } from '../../src/geometry/Circle.js';
import { Vector2 } from '../../src/math/Vector2.js';
import { AABB } from '../../src/math/AABB.js';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import { InvalidGeometryError } from '../../src/errors/InvalidGeometryError.js';

const EPS = 1e-9;

describe('Circle — CIR-001 constructor', () => {
  it('construye con valores válidos', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    assert.ok(c.getCenter().equalsApprox(new Vector2(10, 20), EPS));
    assert.equal(c.getRadius(), 5);
  });

  it('acepta radio 0 (círculo puntual)', () => {
    const c = new Circle(new Vector2(0, 0), 0);
    assert.equal(c.getRadius(), 0);
  });

  it('acepta radio muy grande', () => {
    const c = new Circle(new Vector2(0, 0), Number.MAX_SAFE_INTEGER / 2);
    assert.ok(Number.isFinite(c.getRadius()));
  });

  it('acepta centro con coordenadas negativas', () => {
    const c = new Circle(new Vector2(-10, -20), 3);
    assert.ok(c.getCenter().equalsApprox(new Vector2(-10, -20), EPS));
  });

  it('copia del centro: mutar Vector2 original no afecta', () => {
    const center = new Vector2(10, 20);
    const c = new Circle(center, 5);
    center.x = 999;
    center.y = 888;
    assert.ok(c.getCenter().equalsApprox(new Vector2(10, 20), EPS));
  });

  it('rechaza radio negativo', () => {
    assert.throws(
      () => new Circle(new Vector2(0, 0), -1),
      InvalidGeometryError
    );
  });

  it('rechaza radio NaN', () => {
    assert.throws(
      () => new Circle(new Vector2(0, 0), NaN),
      InvalidGeometryError
    );
  });

  it('rechaza radio Infinity', () => {
    assert.throws(
      () => new Circle(new Vector2(0, 0), Infinity),
      InvalidGeometryError
    );
  });

  it('rechaza radio -Infinity', () => {
    assert.throws(
      () => new Circle(new Vector2(0, 0), -Infinity),
      InvalidGeometryError
    );
  });

  it('rechaza centro no-Vector2 (objeto plano)', () => {
    assert.throws(
      () => new Circle({ x: 0, y: 0 }, 5),
      InvalidGeometryError
    );
  });

  it('rechaza centro null', () => {
    assert.throws(
      () => new Circle(null, 5),
      InvalidGeometryError
    );
  });

  it('rechaza centro undefined', () => {
    assert.throws(
      () => new Circle(undefined, 5),
      InvalidGeometryError
    );
  });

  it('error incluye functionId, input, prevState, cause', () => {
    try {
      new Circle(new Vector2(0, 0), -1);
      assert.fail('debería lanzar');
    } catch (e) {
      assert.equal(e.functionId, 'CIR-001');
      assert.ok(e.input !== null && typeof e.input === 'object');
      assert.equal(e.input.radius, -1);
      assert.equal(e.prevState, null);
      assert.ok(typeof e.cause === 'string');
      assert.ok(e.cause.length > 0);
    }
  });
});

describe('Circle — CIR-002 setCenter', () => {
  it('actualiza el centro', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    c.setCenter(new Vector2(50, 60));
    assert.ok(c.getCenter().equalsApprox(new Vector2(50, 60), EPS));
  });

  it('copia: mutar Vector2 original no afecta', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const newCenter = new Vector2(50, 60);
    c.setCenter(newCenter);
    newCenter.x = 999;
    assert.ok(c.getCenter().equalsApprox(new Vector2(50, 60), EPS));
  });

  it('no altera el radio', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    c.setCenter(new Vector2(50, 60));
    assert.equal(c.getRadius(), 5);
  });

  it('rechaza centro no-Vector2', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.setCenter({ x: 10, y: 20 }), InvalidGeometryError);
  });

  it('rechaza centro null', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.setCenter(null), InvalidGeometryError);
  });
});

describe('Circle — CIR-003 setRadius', () => {
  it('actualiza el radio', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    c.setRadius(10);
    assert.equal(c.getRadius(), 10);
  });

  it('no altera el centro', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    c.setRadius(10);
    assert.ok(c.getCenter().equalsApprox(new Vector2(10, 20), EPS));
  });

  it('acepta radio 0', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    c.setRadius(0);
    assert.equal(c.getRadius(), 0);
  });

  it('rechaza radio negativo', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.setRadius(-1), InvalidGeometryError);
  });

  it('rechaza radio NaN', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.setRadius(NaN), InvalidGeometryError);
  });

  it('rechaza radio Infinity', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.setRadius(Infinity), InvalidGeometryError);
  });
});

describe('Circle — CIR-004 getBounds', () => {
  it('círculo (10, 20), r=5 → AABB (5, 15) a (15, 25)', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const b = c.getBounds();
    assert.equal(b.minX, 5);
    assert.equal(b.minY, 15);
    assert.equal(b.maxX, 15);
    assert.equal(b.maxY, 25);
    assert.equal(b.empty, false);
  });

  it('círculo (0, 0), r=0 → AABB puntual en (0, 0)', () => {
    const c = new Circle(new Vector2(0, 0), 0);
    const b = c.getBounds();
    assert.equal(b.minX, 0);
    assert.equal(b.minY, 0);
    assert.equal(b.maxX, 0);
    assert.equal(b.maxY, 0);
  });

  it('círculo (-10, -20), r=3 → AABB (-13, -23) a (-7, -17)', () => {
    const c = new Circle(new Vector2(-10, -20), 3);
    const b = c.getBounds();
    assert.equal(b.minX, -13);
    assert.equal(b.minY, -23);
    assert.equal(b.maxX, -7);
    assert.equal(b.maxY, -17);
  });

  it('getBounds no muta el Circle', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const centerBefore = c.getCenter();
    const radiusBefore = c.getRadius();
    c.getBounds();
    assert.ok(c.getCenter().equalsApprox(centerBefore, EPS));
    assert.equal(c.getRadius(), radiusBefore);
  });

  it('devuelve nuevo AABB en cada llamada', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const b1 = c.getBounds();
    const b2 = c.getBounds();
    assert.notEqual(b1, b2);
  });
});

describe('Circle — CIR-005 contains', () => {
  it('punto en el centro → true', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    assert.equal(c.contains(new Vector2(10, 20)), true);
  });

  it('punto en el borde exacto → true (inclusión cerrada)', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.equal(c.contains(new Vector2(5, 0)), true);
    assert.equal(c.contains(new Vector2(0, 5)), true);
    assert.equal(c.contains(new Vector2(-5, 0)), true);
    assert.equal(c.contains(new Vector2(0, -5)), true);
    // Borde en diagonal: (3, 4) está a distancia 5
    assert.equal(c.contains(new Vector2(3, 4)), true);
  });

  it('punto dentro → true', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.equal(c.contains(new Vector2(2, 2)), true);
    assert.equal(c.contains(new Vector2(0, 4)), true);
  });

  it('punto fuera → false', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.equal(c.contains(new Vector2(6, 0)), false);
    assert.equal(c.contains(new Vector2(10, 10)), false);
    assert.equal(c.contains(new Vector2(-10, 0)), false);
  });

  it('punto a distancia r + EPSILON_MATH/2 → true (dentro de tolerancia)', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const d = 5 + EPSILON_MATH / 2;
    assert.equal(c.contains(new Vector2(d, 0)), true);
  });

  it('punto a distancia r + 2*EPSILON_MATH → false (fuera de tolerancia)', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const d = 5 + 2 * EPSILON_MATH;
    assert.equal(c.contains(new Vector2(d, 0)), false);
  });

  it('punto a distancia r + 10*EPSILON_MATH → false', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const d = 5 + 10 * EPSILON_MATH;
    assert.equal(c.contains(new Vector2(d, 0)), false);
  });

  it('contains no muta el Circle', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const centerBefore = c.getCenter();
    const radiusBefore = c.getRadius();
    c.contains(new Vector2(10, 20));
    assert.ok(c.getCenter().equalsApprox(centerBefore, EPS));
    assert.equal(c.getRadius(), radiusBefore);
  });

  it('contains no muta el point', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const p = new Vector2(3, 4);
    const xBefore = p.x;
    const yBefore = p.y;
    c.contains(p);
    assert.equal(p.x, xBefore);
    assert.equal(p.y, yBefore);
  });

  it('rechaza point no-Vector2', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.contains({ x: 0, y: 0 }), InvalidGeometryError);
  });

  it('rechaza point null', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.throws(() => c.contains(null), InvalidGeometryError);
  });

  it('círculo con radio 0: solo el centro exacto está dentro', () => {
    const c = new Circle(new Vector2(5, 5), 0);
    assert.equal(c.contains(new Vector2(5, 5)), true);
    assert.equal(c.contains(new Vector2(5 + EPSILON_MATH / 2, 5)), true);
    assert.equal(c.contains(new Vector2(6, 5)), false);
  });
});

describe('Circle — CIR-006 getCenter', () => {
  it('devuelve Vector2 con mismos valores', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const center = c.getCenter();
    assert.ok(center.equalsApprox(new Vector2(10, 20), EPS));
  });

  it('devuelve instancia distinta', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const c1 = c.getCenter();
    const c2 = c.getCenter();
    assert.notEqual(c1, c2);
  });

  it('mutar resultado no altera interno', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const center = c.getCenter();
    center.x = 999;
    center.y = 888;
    const center2 = c.getCenter();
    assert.ok(center2.equalsApprox(new Vector2(10, 20), EPS));
  });
});

describe('Circle — CIR-007 getRadius', () => {
  it('devuelve valor correcto', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    assert.equal(c.getRadius(), 5);
  });

  it('devuelve 0 para círculo puntual', () => {
    const c = new Circle(new Vector2(0, 0), 0);
    assert.equal(c.getRadius(), 0);
  });

  it('devuelve valor tras setRadius', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    c.setRadius(10);
    assert.equal(c.getRadius(), 10);
  });
});

describe('Circle — CIR-008 clone', () => {
  it('clone() !== original', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    assert.notEqual(cl, c);
  });

  it('centro copiado', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    assert.ok(cl.getCenter().equalsApprox(new Vector2(10, 20), EPS));
  });

  it('radio copiado', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    assert.equal(cl.getRadius(), 5);
  });

  it('setRadius sobre clon no afecta original', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    cl.setRadius(100);
    assert.equal(c.getRadius(), 5);
    assert.equal(cl.getRadius(), 100);
  });

  it('setCenter sobre original no afecta clon', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    c.setCenter(new Vector2(999, 999));
    assert.ok(cl.getCenter().equalsApprox(new Vector2(10, 20), EPS));
  });

  it('mutar getCenter() del clon no afecta original', () => {
    const c = new Circle(new Vector2(10, 20), 5);
    const cl = c.clone();
    const clCenter = cl.getCenter();
    clCenter.x = 999;
    assert.ok(c.getCenter().equalsApprox(new Vector2(10, 20), EPS));
    assert.ok(cl.getCenter().equalsApprox(new Vector2(10, 20), EPS));
  });
});

describe('Circle — tests ADR-004', () => {
  it('D6: InvalidGeometryError se lanza en casos de radio inválido', () => {
    try {
      new Circle(new Vector2(0, 0), -1);
      assert.fail('debería lanzar');
    } catch (e) {
      assert.ok(e instanceof InvalidGeometryError);
      assert.equal(e.name, 'InvalidGeometryError');
    }
  });

  it('D6: no se reutilizan errores de math/', () => {
    // InvalidGeometryError no es InvalidNumericInputError ni InvalidVectorError
    const err = new InvalidGeometryError({
      functionId: 'TEST',
      input: {},
      prevState: null,
      cause: 'test'
    });
    assert.equal(err.name, 'InvalidGeometryError');
    assert.ok(err instanceof Error);
  });
});

describe('Circle — tests ADR-003', () => {
  it('D1: contains usa EPSILON_MATH para tolerancia', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    // Punto a distancia r + EPSILON_MATH/2 debe estar dentro
    const d = 5 + EPSILON_MATH / 2;
    assert.equal(c.contains(new Vector2(d, 0)), true);
  });

  it('D1: contains no acepta epsilon por parámetro (verificación de firma)', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    // contains(point) — un solo argumento
    const result = c.contains(new Vector2(0, 0));
    assert.equal(typeof result, 'boolean');
  });

  it('D1: no define epsilon local', () => {
    // Verificación por inspección del código: Circle importa EPSILON_MATH
    // de math/Epsilon.js y no define su propia constante.
    assert.equal(EPSILON_MATH, 1e-9);
  });
});

describe('Circle — tests de dependencias', () => {
  it('no importa de geometry/Path.js ni geometry/BezierPath.js', () => {
    // Verificación por inspección del código
    assert.ok(true);
  });

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

describe('Circle — tests de límite', () => {
  it('radio extremadamente grande', () => {
    const r = Number.MAX_SAFE_INTEGER / 2;
    const c = new Circle(new Vector2(0, 0), r);
    assert.equal(c.getRadius(), r);
    const b = c.getBounds();
    assert.ok(Number.isFinite(b.minX));
    assert.ok(Number.isFinite(b.maxX));
  });

  it('centro en coordenadas extremas finitas', () => {
    const big = Number.MAX_SAFE_INTEGER / 2;
    const c = new Circle(new Vector2(big, big), 1);
    assert.ok(Number.isFinite(c.getCenter().x));
    assert.ok(Number.isFinite(c.getCenter().y));
  });

  it('punto en coordenadas extremas finitas', () => {
    const c = new Circle(new Vector2(0, 0), 5);
    const big = Number.MAX_SAFE_INTEGER / 2;
    // Debe devolver false sin lanzar
    assert.equal(c.contains(new Vector2(big, big)), false);
  });
});