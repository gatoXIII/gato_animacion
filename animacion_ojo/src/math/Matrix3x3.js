import { Vector2 } from './Vector2.js';
import { EPSILON_MATH } from './Epsilon.js';
import { InvalidNumericInputError } from '../errors/InvalidNumericInputError.js';
import { InvalidMatrixError } from '../errors/InvalidMatrixError.js';
import { InvalidVectorError } from '../errors/InvalidVectorError.js';
import { NonInvertibleMatrixError } from '../errors/NonInvertibleMatrixError.js';

export class Matrix3x3 {
  // ADR-003-D5: sólo Array de 9 números, no typed arrays.
  constructor(values) {
    if (values === undefined) {
      this.values = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    } else {
      if (!Array.isArray(values) || values.length !== 9) {
        throw new InvalidMatrixError({
          functionId: 'MAT-001',
          input: { values },
          prevState: null,
          cause: 'values must be an Array of exactly 9 numbers (typed arrays not accepted per ADR-003-D5)'
        });
      }
      for (let i = 0; i < 9; i++) {
        if (!Number.isFinite(values[i])) {
          throw new InvalidMatrixError({
            functionId: 'MAT-001',
            input: { values },
            prevState: null,
            cause: `values[${i}] must be a finite number`
          });
        }
      }
      this.values = values.slice();
    }
  }

  static identity() {
    return new Matrix3x3([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }

  static translation(tx, ty) {
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      throw new InvalidNumericInputError({
        functionId: 'MAT-003',
        input: { tx, ty },
        prevState: null,
        cause: 'tx and ty must be finite numbers'
      });
    }
    return new Matrix3x3([1, 0, tx, 0, 1, ty, 0, 0, 1]);
  }

  static rotation(angleRad) {
    if (!Number.isFinite(angleRad)) {
      throw new InvalidNumericInputError({
        functionId: 'MAT-004',
        input: { angleRad },
        prevState: null,
        cause: 'angleRad must be a finite number'
      });
    }
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return new Matrix3x3([c, -s, 0, s, c, 0, 0, 0, 1]);
  }

  static scale(sx, sy) {
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      throw new InvalidNumericInputError({
        functionId: 'MAT-005',
        input: { sx, sy },
        prevState: null,
        cause: 'sx and sy must be finite numbers'
      });
    }
    return new Matrix3x3([sx, 0, 0, 0, sy, 0, 0, 0, 1]);
  }

  multiply(other) {
    if (!(other instanceof Matrix3x3)) {
      throw new InvalidMatrixError({
        functionId: 'MAT-006',
        input: { other },
        prevState: { values: this.values },
        cause: 'other must be a Matrix3x3'
      });
    }
    const a = this.values;
    const b = other.values;
    const result = new Array(9);
    
    result[0] = a[0] * b[0] + a[1] * b[3] + a[2] * b[6];
    result[1] = a[0] * b[1] + a[1] * b[4] + a[2] * b[7];
    result[2] = a[0] * b[2] + a[1] * b[5] + a[2] * b[8];
    
    result[3] = a[3] * b[0] + a[4] * b[3] + a[5] * b[6];
    result[4] = a[3] * b[1] + a[4] * b[4] + a[5] * b[7];
    result[5] = a[3] * b[2] + a[4] * b[5] + a[5] * b[8];
    
    result[6] = a[6] * b[0] + a[7] * b[3] + a[8] * b[6];
    result[7] = a[6] * b[1] + a[7] * b[4] + a[8] * b[7];
    result[8] = a[6] * b[2] + a[7] * b[5] + a[8] * b[8];
    
    return new Matrix3x3(result);
  }

  determinant() {
    const v = this.values;
    return v[0] * (v[4] * v[8] - v[5] * v[7]) -
           v[1] * (v[3] * v[8] - v[5] * v[6]) +
           v[2] * (v[3] * v[7] - v[4] * v[6]);
  }

  // ADR-003-D1: umbral = EPSILON_MATH (no 1e-10 hardcodeado).
  invert() {
    const det = this.determinant();
    
    if (Math.abs(det) <= EPSILON_MATH) {
      throw new NonInvertibleMatrixError({
        functionId: 'MAT-008',
        input: { values: this.values },
        prevState: { values: this.values },
        cause: `determinant (${det}) is within EPSILON_MATH (${EPSILON_MATH})`
      });
    }
    
    const v = this.values;
    const invDet = 1 / det;
    const result = new Array(9);
    
    result[0] = (v[4] * v[8] - v[5] * v[7]) * invDet;
    result[1] = (v[2] * v[7] - v[1] * v[8]) * invDet;
    result[2] = (v[1] * v[5] - v[2] * v[4]) * invDet;
    
    result[3] = (v[5] * v[6] - v[3] * v[8]) * invDet;
    result[4] = (v[0] * v[8] - v[2] * v[6]) * invDet;
    result[5] = (v[2] * v[3] - v[0] * v[5]) * invDet;
    
    result[6] = (v[3] * v[7] - v[4] * v[6]) * invDet;
    result[7] = (v[1] * v[6] - v[0] * v[7]) * invDet;
    result[8] = (v[0] * v[4] - v[1] * v[3]) * invDet;
    
    return new Matrix3x3(result);
  }

  transformPoint(point) {
    if (!(point instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'MAT-009',
        input: { point },
        prevState: { values: this.values },
        cause: 'point must be a Vector2'
      });
    }
    const v = this.values;
    const x = v[0] * point.x + v[1] * point.y + v[2];
    const y = v[3] * point.x + v[4] * point.y + v[5];
    return new Vector2(x, y);
  }

  transformVector(vector) {
    if (!(vector instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'MAT-010',
        input: { vector },
        prevState: { values: this.values },
        cause: 'vector must be a Vector2'
      });
    }
    const v = this.values;
    const x = v[0] * vector.x + v[1] * vector.y;
    const y = v[3] * vector.x + v[4] * vector.y;
    return new Vector2(x, y);
  }

  clone() {
    return new Matrix3x3(this.values.slice());
  }

  // ADR-003-D1: epsilon obligatorio. Sin default.
  equalsApprox(other, epsilon) {
    if (!(other instanceof Matrix3x3)) {
      throw new InvalidMatrixError({
        functionId: 'MAT-012',
        input: { other, epsilon },
        prevState: { values: this.values },
        cause: 'other must be a Matrix3x3'
      });
    }
    if (epsilon === undefined || epsilon === null) {
      throw new InvalidNumericInputError({
        functionId: 'MAT-012',
        input: { other, epsilon },
        prevState: { values: this.values },
        cause: 'epsilon is required (no default per ADR-003-D1)'
      });
    }
    if (!Number.isFinite(epsilon) || epsilon <= 0) {
      throw new InvalidNumericInputError({
        functionId: 'MAT-012',
        input: { other, epsilon },
        prevState: { values: this.values },
        cause: 'epsilon must be a positive finite number'
      });
    }
    for (let i = 0; i < 9; i++) {
      if (Math.abs(this.values[i] - other.values[i]) > epsilon) {
        return false;
      }
    }
    return true;
  }

  isFinite() {
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(this.values[i])) {
        return false;
      }
    }
    return true;
  }
}