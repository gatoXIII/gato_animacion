import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EPSILON_MATH } from '../../src/math/Epsilon.js';
import * as EpsilonModule from '../../src/math/Epsilon.js';

describe('Epsilon — EPS-001', () => {
  it('valor exportado es 1e-9', () => {
    assert.equal(EPSILON_MATH, 1e-9);
  });

  it('es un número finito', () => {
    assert.equal(typeof EPSILON_MATH, 'number');
    assert.ok(Number.isFinite(EPSILON_MATH));
  });

  it('es mayor que cero', () => {
    assert.ok(EPSILON_MATH > 0);
  });

  it('dos imports devuelven el mismo valor', async () => {
    const mod1 = await import('../../src/math/Epsilon.js');
    const mod2 = await import('../../src/math/Epsilon.js');
    assert.equal(mod1.EPSILON_MATH, mod2.EPSILON_MATH);
    assert.equal(mod1.EPSILON_MATH, 1e-9);
  });

  it('el módulo exporta exactamente EPSILON_MATH y nada más relevante', () => {
    const keys = Object.keys(EpsilonModule);
    assert.deepEqual(keys, ['EPSILON_MATH']);
  });
});