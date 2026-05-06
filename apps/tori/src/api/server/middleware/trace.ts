import { getRuntimeKey } from "hono/adapter";
import { requestId } from "hono/request-id";
import { uniqueId } from "@repo/utils/id";

const genTraceId = () => {
  return uniqueId().replaceAll("-", "");
};

export function traceMiddleware() {
  return requestId({
    generator: (c) => {
      if (getRuntimeKey() === "workerd") {
        return c.req.header()["Cf-Ray"] ?? genTraceId();
      }
      return genTraceId();
    },
  });
}
