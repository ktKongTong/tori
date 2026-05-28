import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import mdx from "fumadocs-mdx/vite";
import type { Plugin } from "vite-plus";
import { dirname, resolve } from "node:path";
import { copyFile, mkdir, stat } from "node:fs/promises";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    mdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index.html",
          crawlLinks: true,
          retryCount: 0,
        },
      },

      pages: [
        {
          path: "/docs",
        },
        {
          path: "/api/search",
        },
        {
          path: "llms-full.txt",
        },
        {
          path: "llms.txt",
        },
      ],
    }),
    react(),
    // please see https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nitro for guides on hosting
    // nitro({
    //   preset: "node_server",
    // }),
    copyShellToIndex(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});

function copyShellToIndex(): Plugin {
  let root = process.cwd();

  return {
    name: "copy-shell-to-index",
    apply: "build",
    enforce: "post",

    configResolved(config) {
      root = config.root;
    },

    async closeBundle() {
      const from = resolve(root, ".output/public/_shell.html");
      const to = resolve(root, ".output/public/index.html");

      try {
        await stat(from);
      } catch {
        console.warn(`[copy-shell-to-index] _shell.html not found: ${from}`);
        return;
      }

      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);

      console.log(`[copy-shell-to-index] copied ${from} -> ${to}`);
    },
  };
}
