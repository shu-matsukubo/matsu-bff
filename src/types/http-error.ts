export type PublicErrorStatus = 400 | 401 | 409 | 422 | 502;

export class HttpError extends Error {
  readonly statusCode: PublicErrorStatus;

  constructor(statusCode: PublicErrorStatus, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const getErrorMessage = (data: unknown, fallback: string): string => {
  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
};
