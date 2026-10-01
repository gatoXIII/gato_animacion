export class InvalidNumericInputError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid numeric input: ${cause}`);
    this.name = 'InvalidNumericInputError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}