/**
 * Error para operaciones inválidas sobre geometrías (Circle, etc.).
 * ADR-004-D6: error cerrado de geometry/. No reutiliza errores de math/.
 */
export class InvalidGeometryError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid geometry: ${cause}`);
    this.name = 'InvalidGeometryError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}