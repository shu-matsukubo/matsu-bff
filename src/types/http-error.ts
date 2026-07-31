export type PublicErrorStatus = 400 | 401 | 404 | 409 | 422 | 502;

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

  if (data && typeof data === 'object' && 'error' in data) {
    const nestedError = (data as { error?: unknown }).error;

    if (nestedError && typeof nestedError === 'object' && 'message' in nestedError) {
      const message = (nestedError as { message?: unknown }).message;

      if (typeof message === 'string' && message.trim()) {
        return message.trim();
      }
    }
  }

  return fallback;
};
