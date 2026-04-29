import { createRRApp } from "@/app/server";

const app = createRRApp({
  runtime: "vercel",
  api: {
    adapter: {},
  },
});

export default app.fetch;
