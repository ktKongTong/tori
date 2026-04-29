import { z } from "zod";

export const errorResponseSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    traceId: z.string().optional(),
    detail: z.unknown().optional(),
  })
  .meta({
    id: "common_error",
    description: "error model",
    ref: "CommonError",
  });

export type ErrorResponse = z.output<typeof errorResponseSchema>;

export const rateLimitErrorResponseSchema = errorResponseSchema
  .safeExtend({
    detail: z.object({
      retryAfter: z
        .int()
        .min(0)
        .optional()
        .meta({
          description: "retry after in sec",
          examples: [3600],
        }),
    }),
  })
  .meta({
    id: "rate_limit_error",
    description: "rate limit error",
    ref: "RateLimitError",
  });

export type RateLimitErrorResponse = z.output<typeof rateLimitErrorResponseSchema>;
