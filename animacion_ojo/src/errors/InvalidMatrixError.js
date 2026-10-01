export class InvalidMatrixError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid matrix: ${cause}`);
    this.name = 'InvalidMatrixError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}