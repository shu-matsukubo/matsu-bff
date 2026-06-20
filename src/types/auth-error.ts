export class AuthError extends Error {
  readonly statusCode: number;
  readonly data: unknown;

  constructor(statusCode: number, data: unknown) {
    super(`Auth server returned ${statusCode}`);
    this.statusCode = statusCode;
    this.data = data;
  }
}
