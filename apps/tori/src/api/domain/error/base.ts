import type { ErrorCodeValue } from "./error-codes.js";
export class BaseError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

export class BizError extends BaseError {
  httpStatus: number = 500;
  errorCode: ErrorCodeValue;
  retryable: boolean = false;
  detail?: unknown;
  constructor(errorCode: ErrorCodeValue, message: string, httpStatus?: number) {
    super(message);
    this.errorCode = errorCode;
    if (httpStatus) this.httpStatus = httpStatus;
  }
}
