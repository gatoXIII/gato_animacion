/**
 * Error para incompatibilidad entre paths en operaciones de morphing.
 * ADR-004-D6: error cerrado de geometry/. No reutiliza errores de math/.
 * Reservado para Etapa 10 (PathInterpolator); no se lanza en 5b.
 */
export class PathCompatibilityError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Path compatibility error: ${cause}`);
    this.name = 'PathCompatibilityError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}