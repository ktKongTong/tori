import { api } from "@/api";
import { honoNitroHandler } from "./nitro";
import { Hono } from "hono";

const app = new Hono();

app.route("/api", api);

let registered = false;
if (!registered) {
  console.log("register deno cron");
  registered = true;
  void Deno.cron("example", "* * * * *", () => {
    console.log("example cron");
  });
}

export default honoNitroHandler(app);
