import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vite-plus/test";
import { DatabaseError, isDrizzleError, toDatabaseError } from "./db.js";
import { ErrorCode } from "./error-codes.js";

class PostgresCauseError extends Error {
  constructor(public readonly code: string) {
    super(`postgres error ${code}`);
  }
}

function createTypedDrizzleError(code: string): DrizzleQueryError & { cause: PostgresCauseError } {
  return new DrizzleQueryError("insert", [], new PostgresCauseError(code)) as DrizzleQueryError & {
    cause: PostgresCauseError;
  };
}

describe("domain error db", () => {
  describe("isDrizzleError", () => {
    it("returns true only for DrizzleQueryError with object cause", () => {
      const drizzleError = new DrizzleQueryError("select 1", [], new PostgresCauseError("23505"));
      const plainError = new Error("boom");
      const drizzleWithoutObjectCause = new DrizzleQueryError("select 1", [], undefined);

      expect(isDrizzleError(drizzleError)).toBe(true);
      expect(isDrizzleError(plainError)).toBe(false);
      expect(isDrizzleError(drizzleWithoutObjectCause)).toBe(false);
    });
  });

  describe("toDatabaseError", () => {
    it("maps postgres unique violation", () => {
      const dbError = toDatabaseError(createTypedDrizzleError("23505"));

      expect(dbError).toBeInstanceOf(DatabaseError);
      expect(dbError.errorCode).toBe(ErrorCode.DB_UNIQUE_VIOLATION);
      expect(dbError.httpStatus).toBe(409);
      expect(dbError.message).toBe("Record already exists (duplicate value)");
    });

    it("maps postgres foreign key violation", () => {
      const dbError = toDatabaseError(createTypedDrizzleError("23503"));

      expect(dbError.errorCode).toBe(ErrorCode.DB_FOREIGN_KEY);
      expect(dbError.httpStatus).toBe(409);
      expect(dbError.message).toBe("Referenced record not found or still in use");
    });

    it("falls back to generic database error for unknown code", () => {
      const dbError = toDatabaseError(createTypedDrizzleError("99999"));

      expect(dbError.errorCode).toBe(ErrorCode.DB_ERROR);
      expect(dbError.httpStatus).toBe(500);
      expect(dbError.message).toBe("A database error occurred");
    });
  });
});
