import { api } from "@/api";
import { honoNitroHandler } from "./nitro";
import { Hono } from "hono";

const app = new Hono();

app.route("/api", api);

Bun.cron("* * * * *", () => {
  console.log("example cron");
});

export default honoNitroHandler(app);
