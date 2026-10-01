export class NonInvertibleMatrixError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Non-invertible matrix: ${cause}`);
    this.name = 'NonInvertibleMatrixError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}