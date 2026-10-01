/**
 * Error para operaciones inválidas sobre Path.
 * ADR-004-D6: error cerrado de geometry/. No reutiliza errores de math/.
 */
export class InvalidPathError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid path: ${cause}`);
    this.name = 'InvalidPathError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}