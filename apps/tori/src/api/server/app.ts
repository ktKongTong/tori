import { Hono } from "hono";
// other components
import { errorHandler } from "./error.js";
// middlewares
import type { AdapterOptions } from "./middleware/adapter.js";
import { registerApiMiddleware } from "./middleware/stack.js";
import { registerFallbackRoutes, registerModuleRoutes, registerSystemRoutes } from "./routes.js";
import type { ApiApp } from "./types.js";

// import api from "./openapi.json" with { type: "json" };

type CreateAppOptions = {
  app?: ApiApp;
  adapter: AdapterOptions;
};

export const createApp = ({ app = new Hono(), adapter }: CreateAppOptions) => {
  registerApiMiddleware(app, adapter);
  // app.get("/api/openapi.json", (c) => {
  //   return c.json(api);
  // });
  registerSystemRoutes(app);
  registerModuleRoutes(app);
  registerFallbackRoutes(app);
  app.onError(errorHandler);

  return app;
};
