import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/oauth/envelope.ts", "src/oauth/schema.ts"],
    dts: {
      tsgo: true,
    },
    exports: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
