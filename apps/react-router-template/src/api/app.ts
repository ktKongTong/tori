import { Hono } from "hono";

export type ServerOptions = {
  adapter?: unknown;
};

import { getRuntimeKey } from "hono/adapter";

export const createApp = (_options: ServerOptions) => {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      runtime: getRuntimeKey(),
    });
  });

  return app;
};
