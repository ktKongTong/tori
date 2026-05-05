import { Hono } from "hono";
import { honoNitroHandler } from "./nitro";
import { getNodeTokenProxyApp } from "../src/node-app.ts";
import { isApiRequestPath } from "../src/web-app.ts";

const app = new Hono();

app.use("*", async (context, next) => {
  if (!isApiRequestPath(new URL(context.req.url).pathname)) {
    await next();
    return;
  }
  return getNodeTokenProxyApp().fetch(context.req.raw);
});

export default honoNitroHandler(app);
