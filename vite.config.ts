import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const toriSrcPath = fileURLToPath(new URL("./apps/tori/src", import.meta.url));
const toriTestPath = fileURLToPath(new URL("./apps/tori/src/api/test", import.meta.url));
const packagesPath = fileURLToPath(new URL("./packages", import.meta.url));

export default defineConfig({
  run: {
    cache: false,
    tasks: {
      build: {
        command: "vp build",
        env: ["RUNTIME"],
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["**/*.gen.ts"],
  },
  lint: {
    ignorePatterns: ["**/*.gen.ts"],
    options: { typeAware: true, typeCheck: true },
  },
});
