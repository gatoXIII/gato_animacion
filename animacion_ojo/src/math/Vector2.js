import { InvalidNumericInputError } from '../errors/InvalidNumericInputError.js';
import { InvalidVectorError } from '../errors/InvalidVectorError.js';
import { ZeroLengthVectorError } from '../errors/ZeroLengthVectorError.js';

export class Vector2 {
  constructor(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new InvalidNumericInputError({
        functionId: 'VEC-001',
        input: { x, y },
        prevState: null,
        cause: 'x and y must be finite numbers'
      });
    }
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Vector2(this.x, this.y);
  }

  add(other) {
    if (!(other instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'VEC-003',
        input: { other },
        prevState: { x: this.x, y: this.y },
        cause: 'other must be a Vector2'
      });
    }
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other) {
    if (!(other instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'VEC-004',
        input: { other },
        prevState: { x: this.x, y: this.y },
        cause: 'other must be a Vector2'
      });
    }
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  multiplyScalar(s) {
    if (!Number.isFinite(s)) {
      throw new InvalidNumericInputError({
        functionId: 'VEC-005',
        input: { s },
        prevState: { x: this.x, y: this.y },
        cause: 's must be a finite number'
      });
    }
    return new Vector2(this.x * s, this.y * s);
  }

  dot(other) {
    if (!(other instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'VEC-006',
        input: { other },
        prevState: { x: this.x, y: this.y },
        cause: 'other must be a Vector2'
      });
    }
    return this.x * other.x + this.y * other.y;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }

  lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  normalize() {
    const len = this.length();
    if (len === 0) {
      throw new ZeroLengthVectorError({
        functionId: 'VEC-009',
        input: { x: this.x, y: this.y },
        prevState: { x: this.x, y: this.y },
        cause: 'Cannot normalize a zero-length vector'
      });
    }
    return new Vector2(this.x / len, this.y / len);
  }

  equalsApprox(other, epsilon = 1e-6) {
    if (!(other instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'VEC-010',
        input: { other, epsilon },
        prevState: { x: this.x, y: this.y },
        cause: 'other must be a Vector2'
      });
    }
    if (!Number.isFinite(epsilon) || epsilon <= 0) {
      throw new InvalidNumericInputError({
        functionId: 'VEC-010',
        input: { other, epsilon },
        prevState: { x: this.x, y: this.y },
        cause: 'epsilon must be a positive finite number'
      });
    }
    return Math.abs(this.x - other.x) <= epsilon &&
           Math.abs(this.y - other.y) <= epsilon;
  }

  isFinite() {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }
}