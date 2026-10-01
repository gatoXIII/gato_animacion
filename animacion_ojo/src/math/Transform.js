import { Vector2 } from './Vector2.js';
import { Matrix3x3 } from './Matrix3x3.js';
import { EPSILON_MATH } from './Epsilon.js';
import { InvalidNumericInputError } from '../errors/InvalidNumericInputError.js';
import { InvalidVectorError } from '../errors/InvalidVectorError.js';

export class Transform {
  constructor(position, rotation, scale) {
    const pos = position === undefined ? new Vector2(0, 0) : position;
    const rot = rotation === undefined ? 0 : rotation;
    const scl = scale === undefined ? new Vector2(1, 1) : scale;

    if (!(pos instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-001',
        input: { position: pos },
        prevState: null,
        cause: 'position must be a Vector2'
      });
    }
    if (!Number.isFinite(rot)) {
      throw new InvalidNumericInputError({
        functionId: 'TRN-001',
        input: { rotation: rot },
        prevState: null,
        cause: 'rotation must be a finite number'
      });
    }
    if (!(scl instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-001',
        input: { scale: scl },
        prevState: null,
        cause: 'scale must be a Vector2'
      });
    }

    this._position = pos.clone();
    this._rotation = rot;
    this._scale = scl.clone();
    this._matrixCache = null;
    this._dirty = true;
  }

  getPosition() {
    return this._position.clone();
  }

  // ADR-003-D4: compara con equalsApprox usando EPSILON_MATH.
  setPosition(position) {
    if (!(position instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-003',
        input: { position },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'position must be a Vector2'
      });
    }
    if (!this._position.equalsApprox(position, EPSILON_MATH)) {
      this._position = position.clone();
      this._dirty = true;
    }
  }

  translate(delta) {
    if (!(delta instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-004',
        input: { delta },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'delta must be a Vector2'
      });
    }
    this._position = this._position.add(delta);
    this._dirty = true;
  }

  getRotation() {
    return this._rotation;
  }

  // ADR-003-D4: compara con EPSILON_MATH.
  setRotation(radians) {
    if (!Number.isFinite(radians)) {
      throw new InvalidNumericInputError({
        functionId: 'TRN-006',
        input: { radians },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'radians must be a finite number'
      });
    }
    if (Math.abs(this._rotation - radians) > EPSILON_MATH) {
      this._rotation = radians;
      this._dirty = true;
    }
  }

  rotate(deltaRadians) {
    if (!Number.isFinite(deltaRadians)) {
      throw new InvalidNumericInputError({
        functionId: 'TRN-007',
        input: { deltaRadians },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'deltaRadians must be a finite number'
      });
    }
    this._rotation += deltaRadians;
    this._dirty = true;
  }

  getScale() {
    return this._scale.clone();
  }

  // ADR-003-D4: compara con equalsApprox usando EPSILON_MATH.
  setScale(scale) {
    if (!(scale instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-009',
        input: { scale },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'scale must be a Vector2'
      });
    }
    if (!this._scale.equalsApprox(scale, EPSILON_MATH)) {
      this._scale = scale.clone();
      this._dirty = true;
    }
  }

  scaleBy(factor) {
    if (!(factor instanceof Vector2)) {
      throw new InvalidVectorError({
        functionId: 'TRN-010',
        input: { factor },
        prevState: { position: this._position.clone(), rotation: this._rotation, scale: this._scale.clone() },
        cause: 'factor must be a Vector2'
      });
    }
    this._scale = new Vector2(
      this._scale.x * factor.x,
      this._scale.y * factor.y
    );
    this._dirty = true;
  }

  // ADR-003-D3: orden T × R × S.
  toMatrix() {
    if (!this._dirty && this._matrixCache !== null) {
      return this._matrixCache.clone();
    }
    const T = Matrix3x3.translation(this._position.x, this._position.y);
    const R = Matrix3x3.rotation(this._rotation);
    const S = Matrix3x3.scale(this._scale.x, this._scale.y);
    const M = T.multiply(R).multiply(S);
    this._matrixCache = M;
    this._dirty = false;
    return M.clone();
  }

  isDirty() {
    return this._dirty;
  }

  // ADR-003-D2: NO toca matrixCache.
  clearDirty() {
    this._dirty = false;
  }
}