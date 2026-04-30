import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { createMergedConfigSource, createRecordConfigSource } from "../src/source.ts";
import { defineConfig, loadConfig, requireConfig } from "../src/schema.ts";

describe("config", () => {
  it("loads typed config from merged sources", () => {
    const definition = defineConfig({
      keys: ["MODE", "PORT"],
      schema: z.object({
        MODE: z.enum(["dev", "prod"]),
        PORT: z.coerce.number().int().positive(),
      }),
    });
    const source = createMergedConfigSource(
      createRecordConfigSource({ MODE: undefined, PORT: "3000" }),
      createRecordConfigSource({ MODE: "dev" }),
    );

    const result = loadConfig(definition, source);
    expect(result.isOk()).toBe(true);
    expect(requireConfig(definition, source)).toEqual({ MODE: "dev", PORT: 3000 });
  });
});
