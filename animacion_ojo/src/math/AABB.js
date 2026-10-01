import { Vector2 } from './Vector2.js';
import { Matrix3x3 } from './Matrix3x3.js';
import { EPSILON_MATH } from './Epsilon.js';
import { InvalidVectorError } from '../errors/InvalidVectorError.js';
import { InvalidMatrixError } from '../errors/InvalidMatrixError.js';
import { InvalidAABBError } from '../errors/InvalidAABBError.js';

export class AABB {
  // AABB-001
  constructor(minX, minY, maxX, maxY) {
    if (!Number.isFinite(minX) || !Number.isFinite(minY) ||
        !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      throw new InvalidAABBError({
        functionId: 'AABB-001',
        input: { minX, minY, maxX, maxY },
        prevState: null,
        cause: 'all bounds must be finite numbers'
      });
    }
    if (minX > maxX) {
      throw new InvalidAABBError({
        functionId: 'AABB-001',
        input: { minX, minY, maxX, maxY },
        prevState: null,
        cause: 'minX must be <= maxX'
      });
    }
    if (minY > maxY) {
      throw new InvalidAABBError({
        functionId: 'AABB-001',
        input: { minX, minY, maxX, maxY },
        prevState: null,
        cause: 'minY must be <= maxY'
      });
    }
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.empty = false;
  }

  // AABB-002
  static empty() {
    const aabb = Object.create(AABB.prototype);
    aabb.minX = 0;
    aabb.minY = 0;
    aabb.maxX = 0;
    aabb.maxY = 0;
    aabb.empty = true;
    return aabb;
  }

  // AABB-003
  static fromXYWH(x, y, width, height) {
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new InvalidAABBError({
        functionId: 'AABB-003',
        input: { x, y, width, height },
        prevState: null,
        cause: 'all parameters must be finite numbers'
      });
    }
    if (width < 0 || height < 0) {
      throw new InvalidAABBError({
        functionId: 'AABB-003',
        input: { x, y, width, height },
        prevState: null,
        cause: 'width and height must be non-negative'
      });
    }
    return new AABB(x, y, x + width, y + height);
  }

  // AABB-004
  clone() {
    if (this.empty) {
      return AABB.empty();
    }
    return new AABB(this.minX, this.minY, this.maxX, this.maxY);
  }

  // AABB-005 — bordes cerrados, tolerancia EPSILON_MATH (ADR-003-D1)
  contains(point) {
    if (!(point instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'AABB-005',
        input: { point },
        prevState: { minX: this.minX, minY: this.minY,
                     maxX: this.maxX, maxY: this.maxY,
                     empty: this.empty },
        cause: 'point must be a Vector2'
      });
    }
    if (this.empty) {
      return false;
    }
    return point.x >= this.minX - EPSILON_MATH &&
           point.x <= this.maxX + EPSILON_MATH &&
           point.y >= this.minY - EPSILON_MATH &&
           point.y <= this.maxY + EPSILON_MATH;
  }

  // AABB-006 — bordes cerrados, tolerancia EPSILON_MATH (ADR-003-D1)
  intersects(other) {
    if (!(other instanceof AABB)) {
      throw new InvalidAABBError({
        functionId: 'AABB-006',
        input: { other },
        prevState: { minX: this.minX, minY: this.minY,
                     maxX: this.maxX, maxY: this.maxY,
                     empty: this.empty },
        cause: 'other must be an AABB'
      });
    }
    if (this.empty || other.empty) {
      return false;
    }
    return this.maxX + EPSILON_MATH >= other.minX &&
           this.minX - EPSILON_MATH <= other.maxX &&
           this.maxY + EPSILON_MATH >= other.minY &&
           this.minY - EPSILON_MATH <= other.maxY;
  }

  // AABB-007 — NO muta operandos
  union(other) {
    if (!(other instanceof AABB)) {
      throw new InvalidAABBError({
        functionId: 'AABB-007',
        input: { other },
        prevState: { minX: this.minX, minY: this.minY,
                     maxX: this.maxX, maxY: this.maxY,
                     empty: this.empty },
        cause: 'other must be an AABB'
      });
    }
    if (this.empty && other.empty) {
      return AABB.empty();
    }
    if (this.empty) {
      return other.clone();
    }
    if (other.empty) {
      return this.clone();
    }
    return new AABB(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY)
    );
  }

  // AABB-008 — SÍ muta this
  expandByPoint(point) {
    if (!(point instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'AABB-008',
        input: { point },
        prevState: { minX: this.minX, minY: this.minY,
                     maxX: this.maxX, maxY: this.maxY,
                     empty: this.empty },
        cause: 'point must be a Vector2'
      });
    }
    if (this.empty) {
      this.minX = point.x;
      this.minY = point.y;
      this.maxX = point.x;
      this.maxY = point.y;
      this.empty = false;
    } else {
      if (point.x < this.minX) this.minX = point.x;
      if (point.y < this.minY) this.minY = point.y;
      if (point.x > this.maxX) this.maxX = point.x;
      if (point.y > this.maxY) this.maxY = point.y;
    }
  }

  // AABB-009 — transforma los 4 vértices; NO sólo 2 esquinas
  transform(matrix) {
    if (!(matrix instanceof Matrix3x3)) {
      throw new InvalidMatrixError({
        functionId: 'AABB-009',
        input: { matrix },
        prevState: { minX: this.minX, minY: this.minY,
                     maxX: this.maxX, maxY: this.maxY,
                     empty: this.empty },
        cause: 'matrix must be a Matrix3x3'
      });
    }
    if (this.empty) {
      return AABB.empty();
    }

    const v1 = matrix.transformPoint(new Vector2(this.minX, this.minY));
    const v2 = matrix.transformPoint(new Vector2(this.maxX, this.minY));
    const v3 = matrix.transformPoint(new Vector2(this.minX, this.maxY));
    const v4 = matrix.transformPoint(new Vector2(this.maxX, this.maxY));

    const minX = Math.min(v1.x, v2.x, v3.x, v4.x);
    const minY = Math.min(v1.y, v2.y, v3.y, v4.y);
    const maxX = Math.max(v1.x, v2.x, v3.x, v4.x);
    const maxY = Math.max(v1.y, v2.y, v3.y, v4.y);

    return new AABB(minX, minY, maxX, maxY);
  }

  // AABB-010
  isEmpty() {
    return this.empty;
  }

  // AABB-011
  width() {
    if (this.empty) {
      return 0;
    }
    return this.maxX - this.minX;
  }

  // AABB-012
  height() {
    if (this.empty) {
      return 0;
    }
    return this.maxY - this.minY;
  }
}