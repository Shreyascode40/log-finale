/**
 * Application-level error with a stable code, surfaced by server actions as
 * `{ success: false, error }`.
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
