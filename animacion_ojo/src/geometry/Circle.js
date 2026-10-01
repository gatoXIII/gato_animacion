import { Vector2 } from '../math/Vector2.js';
import { AABB } from '../math/AABB.js';
import { EPSILON_MATH } from '../math/Epsilon.js';
import { InvalidGeometryError } from '../errors/InvalidGeometryError.js';

export class Circle {
  #center;
  #radius;

  // CIR-001
  constructor(center, radius) {
    if (!(center instanceof Vector2)) {
      throw new InvalidGeometryError({
        functionId: 'CIR-001',
        input: { center, radius },
        prevState: null,
        cause: 'center must be a Vector2'
      });
    }
    if (!Number.isFinite(radius)) {
      throw new InvalidGeometryError({
        functionId: 'CIR-001',
        input: { center, radius },
        prevState: null,
        cause: `radius must be a finite number, got ${radius}`
      });
    }
    if (radius < 0) {
      throw new InvalidGeometryError({
        functionId: 'CIR-001',
        input: { center, radius },
        prevState: null,
        cause: `radius must be non-negative, got ${radius}`
      });
    }
    // Copia del centro, no referencia
    this.#center = center.clone();
    this.#radius = radius;
  }

  // CIR-002
  setCenter(center) {
    if (!(center instanceof Vector2)) {
      throw new InvalidGeometryError({
        functionId: 'CIR-002',
        input: { center },
        prevState: { center: this.#center.clone(), radius: this.#radius },
        cause: 'center must be a Vector2'
      });
    }
    // Copia, no referencia
    this.#center = center.clone();
  }

  // CIR-003
  setRadius(radius) {
    if (!Number.isFinite(radius)) {
      throw new InvalidGeometryError({
        functionId: 'CIR-003',
        input: { radius },
        prevState: { center: this.#center.clone(), radius: this.#radius },
        cause: `radius must be a finite number, got ${radius}`
      });
    }
    if (radius < 0) {
      throw new InvalidGeometryError({
        functionId: 'CIR-003',
        input: { radius },
        prevState: { center: this.#center.clone(), radius: this.#radius },
        cause: `radius must be non-negative, got ${radius}`
      });
    }
    this.#radius = radius;
  }

  // CIR-004 — AABB exacto
  getBounds() {
    return new AABB(
      this.#center.x - this.#radius,
      this.#center.y - this.#radius,
      this.#center.x + this.#radius,
      this.#center.y + this.#radius
    );
  }

  // CIR-005 — contiene con tolerancia EPSILON_MATH (ADR-003-D1)
  // Inclusión cerrada. Usa lengthSq cuando es posible para evitar sqrt.
  contains(point) {
    if (!(point instanceof Vector2)) {
      throw new InvalidGeometryError({
        functionId: 'CIR-005',
        input: { point },
        prevState: { center: this.#center.clone(), radius: this.#radius },
        cause: 'point must be a Vector2'
      });
    }
    const dx = point.x - this.#center.x;
    const dy = point.y - this.#center.y;
    const distSq = dx * dx + dy * dy;
    const r = this.#radius;
    const rSq = r * r;

    // Claramente dentro (sin sqrt)
    if (distSq <= rSq) {
      return true;
    }

    // Claramente fuera de la banda de tolerancia (sin sqrt)
    const rPlusEps = r + EPSILON_MATH;
    const rPlusEpsSq = rPlusEps * rPlusEps;
    if (distSq > rPlusEpsSq) {
      return false;
    }

    // Banda de tolerancia: usar sqrt para precisión
    const dist = Math.sqrt(distSq);
    return dist <= rPlusEps;
  }

  // CIR-006 — devuelve COPIA del centro (extensión §13, ADR-005)
  getCenter() {
    return this.#center.clone();
  }

  // CIR-007 — devuelve primitivo (extensión §13, ADR-005)
  getRadius() {
    return this.#radius;
  }

  // CIR-008 — copia independiente (extensión §13, ADR-005)
  clone() {
    return new Circle(this.#center.clone(), this.#radius);
  }
}