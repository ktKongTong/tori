import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import babel from "@rolldown/plugin-babel";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
export default defineConfig(() => {
  const runtime = process.env?.RUNTIME ?? "node";

  const plugins = [] as any[];

  switch (runtime) {
    case "workerd":
      plugins.push(
        cloudflare({
          viteEnvironment: { name: "ssr" },
        }),
      );
      break;
    case "deno":
    case "bun":
    case "node":
      plugins.push(
        reactRouterHonoServer({
          serverEntryPoint: `./entry/${runtime}.ts`,
          runtime,
        }),
      );
      break;
  }

  return {
    plugins: [
      ...plugins,
      tailwindcss(),
      reactRouter(),
      viteReact(),
      babel({
        presets: [reactCompilerPreset()],
      }),
    ],
    resolve: {
      tsconfigPaths: true,
    },
  };
});
