import { BizError } from "./base.js";
import { ErrorCode } from "./error-codes.js";

export class ThirdPartiesIntegrationError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.UNKNOWN, message ?? "Failed to get response from third parties", 500);
    this.retryable = false;
  }
}

export class EmptyResponseBodyError extends BizError {
  constructor(message?: string) {
    super(ErrorCode.EMPTY_RESPONSE_BODY, message ?? "EMPTY_RESPONSE_BODY", 500);
    this.retryable = false;
  }
}
