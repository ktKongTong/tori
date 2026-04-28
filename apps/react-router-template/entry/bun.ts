import { createRRApp } from "@/app/server";
import { createHonoServer } from "react-router-hono-server/bun";

const app = createRRApp({
  runtime: "bun",
  api: {
    adapter: {},
  },
});

console.log(process.versions.bun);

let registered = false;

// hmr
if (!registered) {
  registered = true;
  Bun.cron("* * * * *", () => {
    console.log("example cron");
  });
}

export default createHonoServer({
  app,
});
