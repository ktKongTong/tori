import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig(() => {
  let plugins = [] as any[];

  let runtime = process.env?.RUNTIME ?? "node";
  console.log("build for:", runtime);
  if (runtime === "workerd") {
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  } else {
    let preset;

    switch (runtime) {
      case "deno":
        preset = "node-server";
        break;
      case "bun":
        preset = "bun";
        break;
    }

    plugins.push(
      nitro({
        preset: preset,
        serverEntry: `./entry/${runtime}.ts`,
      }),
    );
  }

  return {
    plugins: [
      ...plugins,
      tanstackStart({
        prerender: {
          enabled: false,
          filter: () => false,
        },
        router: {
          routesDirectory: "../app/routes",
          generatedRouteTree: "../app/routeTree.gen.ts",
        },
      }),
      tailwindcss(),
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
