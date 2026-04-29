import { api } from "@/api";
import { honoNitroHandler } from "./nitro";
import { Hono } from "hono";

const app = new Hono();

app.route("/api", api);

export default honoNitroHandler(app);
