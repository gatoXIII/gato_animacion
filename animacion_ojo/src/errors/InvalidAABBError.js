export class InvalidAABBError extends Error {
  constructor({ functionId, input, prevState, cause }) {
    super(`[${functionId}] Invalid AABB: ${cause}`);
    this.name = 'InvalidAABBError';
    this.functionId = functionId;
    this.input = input;
    this.prevState = prevState;
    this.cause = cause;
  }
}