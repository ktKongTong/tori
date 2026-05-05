import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { getNodeTokenProxyApp } from "./node-app.ts";
import { isApiRequestPath } from "./web-app.ts";

export default createServerEntry({
  async fetch(request) {
    const pathname = new URL(request.url).pathname;

    if (isApiRequestPath(pathname)) {
      return getNodeTokenProxyApp().fetch(request);
    }

    return handler.fetch(request);
  },
});
