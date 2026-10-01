/**
 * Error para reglas de relleno inválidas en pointInPath.
 * ADR-004-D5/D6: error cerrado de geometry/. No reutiliza errores
 * de math/.
 */
export class InvalidFillRuleError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid fill rule: ${cause}`);
    this.name = 'InvalidFillRuleError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}