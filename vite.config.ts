import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const toriSrcPath = fileURLToPath(new URL("./apps/tori/src", import.meta.url));
const toriTestPath = fileURLToPath(new URL("./apps/tori/src/api/test", import.meta.url));
const packagesPath = fileURLToPath(new URL("./packages", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": toriSrcPath,
      "@test": toriTestPath,
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
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "apps/tori/src/routeTree.gen.ts",
      "apps/tori-token-proxy/app/routeTree.gen.ts",
    ],
  },
  lint: {
    ignorePatterns: [
      "apps/tori/src/routeTree.gen.ts",
      "apps/tori-token-proxy/app/routeTree.gen.ts",
    ],
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
