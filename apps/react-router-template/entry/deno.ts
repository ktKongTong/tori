import { createRRApp } from "@/app/server";
import { createHonoServer } from "react-router-hono-server/deno";

const app = createRRApp({
  runtime: "deno",
  api: {
    adapter: {},
  },
});

let registered = false;
// hmr
if (!registered) {
  console.log("register deno cron");
  registered = true;
  void Deno.cron("example", "* * * * *", () => {
    console.log("example cron");
  });
}

export default createHonoServer({
  app,
});
