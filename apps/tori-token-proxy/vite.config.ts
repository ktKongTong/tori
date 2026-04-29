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
  if (runtime === "workerd") {
    plugins.push(cloudflare({ viteEnvironment: { name: "ssr" } }));
  } else {
    let preset;

    switch (runtime) {
      case "deno":
        preset = "deno_server";
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
      tanstackStart(),
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
