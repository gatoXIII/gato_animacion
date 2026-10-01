export class ZeroLengthVectorError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Zero-length vector: ${cause}`);
    this.name = 'ZeroLengthVectorError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}