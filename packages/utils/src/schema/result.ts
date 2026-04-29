import { Result } from "better-result";
import type { z } from "zod";

export type SchemaResult<TSchema extends z.ZodType> = Result<z.output<TSchema>, z.ZodError>;

export function safeParseResult<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): SchemaResult<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return Result.err(parsed.error);
  return Result.ok(parsed.data);
}

export function parseResult<TSchema extends z.ZodType>(schema: TSchema) {
  return (value: unknown): SchemaResult<TSchema> => safeParseResult(schema, value);
}
