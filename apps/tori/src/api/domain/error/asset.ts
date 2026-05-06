import { BizError } from "@/api/domain/error/base.ts";
import { ErrorCode } from "./error-codes.js";
export class AssetSizeLimitExceedError extends BizError {
  constructor(_size?: string) {
    super(ErrorCode.SIZE_LIMIT_EXCEEDED, `SIZE_LIMIT_EXCEEDED`, 400);
  }
}
