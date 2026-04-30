import { Result } from "better-result";
import type { z } from "zod";
import { readConfigKeys, type ConfigSource } from "./source.ts";

export type ConfigDefinition<TSchema extends z.ZodType> = {
  schema: TSchema;
  keys: readonly string[];
};

export type ConfigResult<TSchema extends z.ZodType> = Result<z.output<TSchema>, z.ZodError>;

export function defineConfig<TSchema extends z.ZodType>(definition: ConfigDefinition<TSchema>) {
  return definition;
}

export function loadConfig<TSchema extends z.ZodType>(
  definition: ConfigDefinition<TSchema>,
  source: ConfigSource,
): ConfigResult<TSchema> {
  const input = readConfigKeys(source, definition.keys);
  const parsed = definition.schema.safeParse(input);
  if (!parsed.success) return Result.err(parsed.error);
  return Result.ok(parsed.data);
}

export function requireConfig<TSchema extends z.ZodType>(
  definition: ConfigDefinition<TSchema>,
  source: ConfigSource,
): z.output<TSchema> {
  const result = loadConfig(definition, source);
  if (result.isErr()) throw result.error;
  return result.value;
}
