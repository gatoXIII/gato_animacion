export class InvalidVectorError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid vector argument: ${cause}`);
    this.name = 'InvalidVectorError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}