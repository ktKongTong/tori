import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import { every } from "hono/combine";
import {
  type DescribeRouteOptions,
  describeRoute as honoDescribeRoute,
  resolver,
  uniqueSymbol,
  validator,
} from "hono-openapi";
import { z } from "zod";
import { ZodValidatorError } from "@/api/domain/error";
export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["input"];
export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
  Schema["~standard"]["types"]
>["output"];

const defaultErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    traceId: z.string().optional(),
    detail: z.any().optional(),
  })
  .meta({
    id: "common_error",
    description: "error model",
    ref: "CommonError",
  });

const rateLimitErrorSchema = defaultErrorSchema
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
type ExtendedDescribeRouteOptions<
  BodySchema extends StandardSchemaV1 = StandardSchemaV1,
  QuerySchema extends StandardSchemaV1 = StandardSchemaV1,
  FormSchema extends StandardSchemaV1 = StandardSchemaV1,
  ParamSchema extends StandardSchemaV1 = StandardSchemaV1,
  HeaderSchema extends StandardSchemaV1 = StandardSchemaV1,
  CookieSchema extends StandardSchemaV1 = StandardSchemaV1,
  ResponseSchema extends StandardSchemaV1 = StandardSchemaV1,
> = DescribeRouteOptions & {
  request?: {
    body?: BodySchema;
    query?: QuerySchema;
    form?: FormSchema;
    param?: ParamSchema;
    header?: HeaderSchema;
    cookie?: CookieSchema;
  };
  response: {
    description: string;
    body: ResponseSchema;
  };
};
type HasUndefined<T> = undefined extends T ? true : false;
type ApplyInKeySchema<Target extends keyof ValidationTargets, Schema extends StandardSchemaV1> =
  HasUndefined<InferInput<Schema>> extends true
    ? { [K in Target]?: InferInput<Schema> }
    : { [K in Target]: InferInput<Schema> };
type ApplyOutKeySchema<Target extends keyof ValidationTargets, Schema extends StandardSchemaV1> = {
  [K in Target]: InferOutput<Schema>;
};
export const describeRoute = <
  QuerySchema extends StandardSchemaV1 = StandardSchemaV1,
  HeaderSchema extends StandardSchemaV1 = StandardSchemaV1,
  CookieSchema extends StandardSchemaV1 = StandardSchemaV1,
  ParamSchema extends StandardSchemaV1 = StandardSchemaV1,
  BodySchema extends StandardSchemaV1 = StandardSchemaV1,
  FormSchema extends StandardSchemaV1 = StandardSchemaV1,
  ResponseSchema extends StandardSchemaV1 = StandardSchemaV1,
  E extends Env = any,
  P extends string = any,
  I extends Input = {
    in: ApplyInKeySchema<"query", QuerySchema> &
      ApplyInKeySchema<"header", HeaderSchema> &
      ApplyInKeySchema<"cookie", CookieSchema> &
      ApplyInKeySchema<"param", ParamSchema> &
      ApplyInKeySchema<"json", BodySchema> &
      ApplyInKeySchema<"form", FormSchema>;
    out: ApplyOutKeySchema<"query", QuerySchema> &
      ApplyOutKeySchema<"header", HeaderSchema> &
      ApplyOutKeySchema<"cookie", CookieSchema> &
      ApplyOutKeySchema<"param", ParamSchema> &
      ApplyOutKeySchema<"json", BodySchema> &
      ApplyOutKeySchema<"form", FormSchema>;
  },
  V extends I = I,
>(
  spec: Omit<
    ExtendedDescribeRouteOptions<
      BodySchema,
      QuerySchema,
      FormSchema,
      ParamSchema,
      HeaderSchema,
      CookieSchema,
      ResponseSchema
    >,
    "responses"
  >,
) => {
  const { request, response } = spec;
  const validators: any[] = [];
  const validatorMap: Record<string, any> = {};
  const addValidatorTarget = (target: keyof ValidationTargets, schema: StandardSchemaV1) => {
    validators.push(
      validator(target, schema, (result: { success: boolean; error?: unknown }, _c: unknown) => {
        if (!result.success) {
          throw new ZodValidatorError(result.error as StandardSchemaV1.Issue[]);
        }
      }),
    );
    validatorMap[target] = {
      target,
      ...resolver(schema),
    };
  };
  if (request?.form) {
    addValidatorTarget("form", request.form);
  }
  if (request?.param) {
    addValidatorTarget("param", request.param);
  }
  if (request?.body) {
    addValidatorTarget("json", request.body);
  }
  if (request?.header) {
    addValidatorTarget("header", request.header);
  }
  if (request?.cookie) {
    addValidatorTarget("cookie", request.cookie);
  }
  if (request?.query) {
    addValidatorTarget("query", request.query);
  }

  const finalSpec = {
    ...spec,
    responses: {
      200: {
        description: response.description,
        content: {
          "application/json": { schema: resolver(response.body) },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": { schema: resolver(defaultErrorSchema) },
        },
      },
      403: {
        description: "Forbidden",
        content: {
          "application/json": { schema: resolver(defaultErrorSchema) },
        },
      },
      409: {
        description: "Conflict",
        content: {
          "application/json": { schema: resolver(defaultErrorSchema) },
        },
      },
      404: {
        description: "Not Found",
        content: {
          "application/json": { schema: resolver(defaultErrorSchema) },
        },
      },
      429: {
        description: "Too Many Requests",
        content: {
          "application/json": { schema: resolver(rateLimitErrorSchema) },
        },
      },
      500: {
        description: "Internal Error",
        content: {
          "application/json": { schema: resolver(defaultErrorSchema) },
        },
      },
    },
  };

  const middleware = every(honoDescribeRoute(finalSpec), ...validators) as MiddlewareHandler<
    E,
    P,
    V
  >;
  const item = validators.map((it) => it[uniqueSymbol]);
  return Object.assign(middleware, {
    [uniqueSymbol]: [
      {
        spec: finalSpec,
        validators: validators,
      },
      ...item,
    ],
  }) as MiddlewareHandler<E, P, V>;
};
