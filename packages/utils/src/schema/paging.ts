import { type ZodType, z } from "zod";

export const PageBasedPaginationParamSchema = z.object({
  page: z.coerce.number().int().min(1).prefault(1).meta({ example: 1, default: 1, minimum: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .prefault(100)
    .meta({ example: 100, default: 100, maximum: 100, minimum: 1 }),
});

export type PageBasedPaginationParam = z.output<typeof PageBasedPaginationParamSchema>;

export const PageBasedPaginationResultSchema = <T extends ZodType>(schema: T) =>
  z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    data: schema.array(),
  });

export type PageBasedPaginationResult<T> = {
  total?: number;
  pageSize: number;
  page: number;
  data: T[];
};

export const CursorBasedPaginationParamSchema = z.object({
  cursorId: z.coerce.string().optional(),
  pageSize: z.coerce
    .number()
    .optional()
    .meta({ example: 100, default: 100, maximum: 100, minimum: 1 }),
});

export type CursorBasedPaginationParam = z.output<typeof CursorBasedPaginationParamSchema>;

export const CursorBasedPaginationResultSchema = <T extends ZodType>(
  schema: T,
  idType: "string" | "number" = "string",
) =>
  z.object({
    total: z.number().optional(),
    nextCursorId: idType === "string" ? z.coerce.string().nullish() : z.coerce.number().nullish(),
    data: schema.array(),
  });

export type CursorBasedPaginationResult<T, CID extends string | number = string> = {
  total?: number;
  nextCursorId?: CID | null;
  data: T[];
};

export const EncodedPageBasedPaginationParamSchema = z.object({
  cursorId: z.string().optional(),
});

export type EncodedPageBasedPaginationParam = z.output<
  typeof EncodedPageBasedPaginationParamSchema
>;

export const EncodedPageBasedPaginationResultSchema = <T extends ZodType>(schema: T) =>
  z.object({
    total: z.number().optional(),
    nextCursorId: z.coerce.string().nullish(),
    data: schema.array(),
  });

export type EncodedPageBasedPaginationResult<T> = {
  total?: number;
  nextCursorId: string | null;
  data: T[];
};

function decodePageCursor(cursorId: string): PageBasedPaginationParam {
  const items = atob(cursorId).split(";");
  const values: Record<string, number> = {};
  for (const item of items) {
    const [key, value] = item.split(":");
    if (key) values[key] = Number.parseInt(value ?? "", 10);
  }
  return {
    page: values.page ?? 1,
    pageSize: values.pageSize ?? 100,
  };
}

function encodePageCursor(page: number, pageSize: number): EncodedPageBasedPaginationParam {
  return { cursorId: btoa(`page:${page};pageSize:${pageSize}`) };
}

export const pageCodec = z.codec(
  PageBasedPaginationParamSchema,
  EncodedPageBasedPaginationParamSchema,
  {
    encode: (input) => {
      if (!input.cursorId) return { page: 1, pageSize: 100 };
      return decodePageCursor(input.cursorId);
    },
    decode: (input) => encodePageCursor(input.page, input.pageSize),
  },
);
