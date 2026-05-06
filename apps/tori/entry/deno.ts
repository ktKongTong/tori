import { honoNitroHandler } from "./nitro";
import { Hono } from "hono";
import { createApp, registerApiV2Runtime } from "@/api";
import { nodeServerAdapter } from "../adapter/node/server";

const app = new Hono();

registerApiV2Runtime();
app.route("/api", createApp({ adapter: nodeServerAdapter }));

let registered = false;
if (!registered) {
  console.log("register deno cron");
  registered = true;
  void Deno.cron("example", "* * * * *", () => {
    console.log("example cron");
  });
}

export default honoNitroHandler(app);
