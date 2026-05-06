import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

export default defineConfig(() => {
  const isTest = process.env.VITEST === "true";
  const srcPath = fileURLToPath(new URL("./src", import.meta.url));
  const testPath = fileURLToPath(new URL("./src/api/test", import.meta.url));
  const packagesPath = fileURLToPath(new URL("../../packages", import.meta.url));

  if (isTest) {
    return {
      resolve: {
        alias: {
          "@": srcPath,
          "@test": testPath,
          "@repo/api-kit": `${packagesPath}/api-kit/src/index.ts`,
          "@repo/auth": `${packagesPath}/auth/src`,
          "@repo/core": `${packagesPath}/core/src`,
          "@repo/observability": `${packagesPath}/observability/src`,
          "@repo/protocol": `${packagesPath}/protocol/src`,
          "@repo/request": `${packagesPath}/request/src/index.ts`,
          "@repo/storage": `${packagesPath}/storage/src`,
          "@repo/task": `${packagesPath}/task/src`,
        },
        tsconfigPaths: true,
      },
    };
  }

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
      alias: {
        "@": srcPath,
        "@test": testPath,
        "@repo/api-kit": `${packagesPath}/api-kit/src/index.ts`,
        "@repo/auth": `${packagesPath}/auth/src`,
        "@repo/core": `${packagesPath}/core/src`,
        "@repo/observability": `${packagesPath}/observability/src`,
        "@repo/protocol": `${packagesPath}/protocol/src`,
        "@repo/request": `${packagesPath}/request/src/index.ts`,
        "@repo/storage": `${packagesPath}/storage/src`,
        "@repo/task": `${packagesPath}/task/src`,
      },
      tsconfigPaths: true,
    },
  };
});
