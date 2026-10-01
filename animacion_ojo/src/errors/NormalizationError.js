/**
 * Error para operaciones de normalización de segmentos que fallan.
 * ADR-004-D6: error cerrado de geometry/. No reutiliza errores de math/.
 */
export class NormalizationError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Normalization error: ${cause}`);
    this.name = 'NormalizationError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}