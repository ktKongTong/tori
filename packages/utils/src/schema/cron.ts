import { z } from "zod";

const wildcardSchema = z.literal("*");
const stepValueSchema = z.enum(Array.from({ length: 9_999 }, (_, index) => String(index + 1)));

function createCronFieldSchema(min: number, max: number) {
  const integerSchema = z
    .enum(Array.from({ length: max - min + 1 }, (_, index) => String(min + index)))
    .transform(Number);

  const rangeSchema = z.templateLiteral([z.int(), z.literal("-"), z.int()]).refine((value) => {
    const [start, end] = value.split("-");
    const startParseResult = integerSchema.safeParse(start);
    const endParseResult = integerSchema.safeParse(end);
    return (
      startParseResult.success &&
      endParseResult.success &&
      startParseResult.data <= endParseResult.data
    );
  });

  const wildcardOrRangeSchema = wildcardSchema.or(rangeSchema);

  const stepSchema = z
    .templateLiteral([wildcardOrRangeSchema, z.literal("/"), z.int()])
    .refine((value) => {
      const [start, end] = value.split("/");
      return (
        wildcardOrRangeSchema.safeParse(start).success && stepValueSchema.safeParse(end).success
      );
    });

  const wildcardOrRangeOrIntegerOrStepSchema = wildcardOrRangeSchema
    .or(integerSchema)
    .or(stepSchema);

  return z.string().refine((value) => {
    return value
      .split(",")
      .every((part) => wildcardOrRangeOrIntegerOrStepSchema.safeParse(part).success);
  });
}

const minuteSchema = createCronFieldSchema(0, 59);
const hourSchema = createCronFieldSchema(0, 23);
const dayOfMonthSchema = createCronFieldSchema(1, 31);
const monthSchema = createCronFieldSchema(1, 12);
const dayOfWeekSchema = createCronFieldSchema(0, 6);

export const cronSchema = z
  .string()
  .transform((value) => value.trim().split(/\s+/u))
  .refine((fields) => fields.length === 5, { error: "Invalid cron expression" })
  .refine((fields) => minuteSchema.safeParse(fields[0]).success, { error: "Invalid minute field" })
  .refine((fields) => hourSchema.safeParse(fields[1]).success, { error: "Invalid hour field" })
  .refine((fields) => dayOfMonthSchema.safeParse(fields[2]).success, {
    error: "Invalid day of month field",
  })
  .refine((fields) => monthSchema.safeParse(fields[3]).success, { error: "Invalid month field" })
  .refine((fields) => dayOfWeekSchema.safeParse(fields[4]).success, {
    error: "Invalid day of week field",
  })
  .transform((fields) => fields.join(" "));
