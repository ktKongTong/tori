// export { ExampleDO } from ''

import { createRRApp } from "@/app/server";

const app = createRRApp({
  runtime: "workerd",
  api: {
    adapter: {
      // cloudflare
    },
  },
});

export default {
  fetch: app.fetch,
  // queue: cloudflareMQAdapter,
  // scheduled: cloudflareCronAdapter,
};
