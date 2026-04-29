import { describe, expect, it } from "vite-plus/test";
import { toDatabaseError } from "../src/errors/database.ts";

describe("database errors", () => {
  it("maps database causes to safe application errors", () => {
    expect(toDatabaseError({ code: "23505" })).toMatchObject({
      errorCode: "DB_UNIQUE_VIOLATION",
      httpStatus: 409,
    });
    expect(toDatabaseError({ code: "99999" })).toMatchObject({
      errorCode: "DB_ERROR",
      httpStatus: 500,
    });
  });
});
