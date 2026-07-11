class ApiError extends Error {
  statusCode: number;
  error: string;
  validationError?: any[];

  constructor(
    statusCode: number,
    message: string,
    error: string,
    validationError?: any[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.error = error;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
