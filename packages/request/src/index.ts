import { Result } from "better-result";
import { FetchError, ofetch, type Fetch, type FetchOptions, type FetchRequest } from "ofetch";
import type { z } from "zod";

export type RequestErrorKind = "http" | "validation" | "unknown";

export type RequestErrorOptions = {
  kind?: RequestErrorKind;
  status?: number;
  payload?: unknown;
  cause?: unknown;
};

export class RequestError extends Error {
  readonly kind: RequestErrorKind;
  readonly status?: number;
  readonly payload?: unknown;

  constructor(message: string, options: RequestErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RequestError";
    this.kind = options.kind ?? "unknown";
    this.status = options.status;
    this.payload = options.payload;
  }
}

export type RequestClientOptions = FetchOptions<"json"> & {
  fetch?: Fetch;
};

export type JsonRequestOptions<TSchema extends z.ZodTypeAny | undefined = undefined> =
  FetchOptions<"json"> & {
    schema?: TSchema;
    as?: "json";
  };

export type ResultRequestOptions<TSchema extends z.ZodTypeAny | undefined = undefined> =
  FetchOptions<"json"> & {
    schema?: TSchema;
    as: "result";
  };

export type RequestOptions<TSchema extends z.ZodTypeAny | undefined = undefined> =
  | JsonRequestOptions<TSchema>
  | ResultRequestOptions<TSchema>;

export type RequestResult<T> = Result<T, RequestError>;

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export type RequestBodyOptions<TSchema extends z.ZodTypeAny | undefined = undefined> = Omit<
  RequestOptions<TSchema>,
  "body" | "method"
>;

export type RequestNoBodyOptions<TSchema extends z.ZodTypeAny | undefined = undefined> = Omit<
  RequestOptions<TSchema>,
  "body" | "method"
>;

type InternalRequestOptions = FetchOptions<"json"> & {
  schema?: z.ZodTypeAny;
  as?: "json" | "result";
};

function hasHeader(headers: Headers, name: string) {
  return headers.has(name);
}

function isBrowserBody(value: unknown) {
  return (
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}

function shouldUseJsonContentType(value: unknown) {
  return (
    value !== undefined && value !== null && typeof value === "object" && !isBrowserBody(value)
  );
}

function toFetchOptions(options: InternalRequestOptions = {}): FetchOptions<"json"> {
  const { schema: _schema, as: _as, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (!hasHeader(headers, "accept")) {
    headers.set("accept", "application/json");
  }

  if (shouldUseJsonContentType(fetchOptions.body) && !hasHeader(headers, "content-type")) {
    headers.set("content-type", "application/json");
  }

  return {
    ...fetchOptions,
    headers,
  };
}

function messageFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  if ("message" in payload) return String((payload as { message: unknown }).message);
  if ("error" in payload) return String((payload as { error: unknown }).error);
  return undefined;
}

export function normalizeRequestError(error: unknown): RequestError {
  if (error instanceof RequestError) return error;

  if (error instanceof FetchError) {
    const payload = error.data;
    const status = error.status ?? error.response?.status;
    return new RequestError(messageFromPayload(payload) ?? error.message, {
      kind: "http",
      status,
      payload,
      cause: error,
    });
  }

  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as z.ZodError;
    return new RequestError(
      `Response validation failed: ${zodError.issues.map((issue) => issue.message).join("; ")}`,
      {
        kind: "validation",
        status: 500,
        payload: zodError.flatten(),
        cause: error,
      },
    );
  }

  if (error instanceof Error) {
    return new RequestError(error.message, { cause: error });
  }

  return new RequestError("Unknown request error", { payload: error });
}

function parseWithSchema<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown) {
  return schema.parse(value) as z.output<TSchema>;
}

export function createRequestClient(options: RequestClientOptions = {}) {
  const { fetch, ...defaults } = options;
  const client = ofetch.create(defaults as FetchOptions, fetch ? { fetch } : undefined);

  async function jsonInternal(request: FetchRequest, options: InternalRequestOptions = {}) {
    const payload = await client<unknown>(request, toFetchOptions(options));
    return options.schema ? parseWithSchema(options.schema, payload) : payload;
  }

  async function json<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function json<T = unknown>(request: FetchRequest, options?: JsonRequestOptions): Promise<T>;
  async function json(request: FetchRequest, options: InternalRequestOptions = {}) {
    try {
      return await jsonInternal(request, options);
    } catch (error) {
      throw normalizeRequestError(error);
    }
  }

  async function result<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: JsonRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function result<T = unknown>(
    request: FetchRequest,
    options?: JsonRequestOptions,
  ): Promise<RequestResult<T>>;
  async function result(request: FetchRequest, options: InternalRequestOptions = {}) {
    try {
      const value = await jsonInternal(request, options);
      return Result.ok(value);
    } catch (error) {
      return Result.err(normalizeRequestError(error));
    }
  }

  async function dispatch(fetchRequest: FetchRequest, options: InternalRequestOptions = {}) {
    if (options.as === "result") {
      return result(fetchRequest, options as JsonRequestOptions);
    }

    return json(fetchRequest, options as JsonRequestOptions);
  }

  function withMethod(method: HttpMethod, options: InternalRequestOptions = {}) {
    return {
      ...options,
      method,
    } satisfies InternalRequestOptions;
  }

  function withBody(method: HttpMethod, body: unknown, options: InternalRequestOptions = {}) {
    return {
      ...options,
      body: body as InternalRequestOptions["body"],
      method,
    } satisfies InternalRequestOptions;
  }

  async function get<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: ResultRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function get<T = unknown>(
    request: FetchRequest,
    options: ResultRequestOptions,
  ): Promise<RequestResult<T>>;
  async function get<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function get<T = unknown>(request: FetchRequest, options?: JsonRequestOptions): Promise<T>;
  async function get(fetchRequest: FetchRequest, options: InternalRequestOptions = {}) {
    return dispatch(fetchRequest, withMethod("GET", options));
  }

  async function post<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function post<T = unknown>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions,
  ): Promise<RequestResult<T>>;
  async function post<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function post<T = unknown>(
    request: FetchRequest,
    body?: unknown,
    options?: JsonRequestOptions,
  ): Promise<T>;
  async function post(
    fetchRequest: FetchRequest,
    body?: unknown,
    options: InternalRequestOptions = {},
  ) {
    return dispatch(fetchRequest, withBody("POST", body, options));
  }

  async function put<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function put<T = unknown>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions,
  ): Promise<RequestResult<T>>;
  async function put<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function put<T = unknown>(
    request: FetchRequest,
    body?: unknown,
    options?: JsonRequestOptions,
  ): Promise<T>;
  async function put(
    fetchRequest: FetchRequest,
    body?: unknown,
    options: InternalRequestOptions = {},
  ) {
    return dispatch(fetchRequest, withBody("PUT", body, options));
  }

  async function patch<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function patch<T = unknown>(
    request: FetchRequest,
    body: unknown,
    options: ResultRequestOptions,
  ): Promise<RequestResult<T>>;
  async function patch<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    body: unknown,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function patch<T = unknown>(
    request: FetchRequest,
    body?: unknown,
    options?: JsonRequestOptions,
  ): Promise<T>;
  async function patch(
    fetchRequest: FetchRequest,
    body?: unknown,
    options: InternalRequestOptions = {},
  ) {
    return dispatch(fetchRequest, withBody("PATCH", body, options));
  }

  async function del<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: ResultRequestOptions<TSchema>,
  ): Promise<RequestResult<z.output<TSchema>>>;
  async function del<T = unknown>(
    request: FetchRequest,
    options: ResultRequestOptions,
  ): Promise<RequestResult<T>>;
  async function del<TSchema extends z.ZodTypeAny>(
    request: FetchRequest,
    options: JsonRequestOptions<TSchema>,
  ): Promise<z.output<TSchema>>;
  async function del<T = unknown>(request: FetchRequest, options?: JsonRequestOptions): Promise<T>;
  async function del(fetchRequest: FetchRequest, options: InternalRequestOptions = {}) {
    return dispatch(fetchRequest, withMethod("DELETE", options));
  }

  return {
    delete: del,
    fetch: client,
    get,
    json,
    normalizeError: normalizeRequestError,
    patch,
    post,
    put,
    result,
  };
}
