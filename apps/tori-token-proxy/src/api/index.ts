import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";

const app = new Hono();

export { app as api };

app.get("/", (c) => {
  return c.json({
    runtime: getRuntimeKey(),
  });
});

app.get("/400", (c) => {
  return c.json(
    {
      error: "Bad Request",
    },
    400,
  );
});

app.get("/401", (c) => {
  return c.json(
    {
      error: "Unauthorized",
    },
    401,
  );
});
app.get("/402", (c) => {
  return c.json(
    {
      error: "Payment Required",
    },
    402,
  );
});
app.get("/403", (c) => {
  return c.json(
    {
      error: "Forbidden",
    },
    403,
  );
});

app.get("/404", (c) => {
  return c.json(
    {
      error: "Not Found",
    },
    404,
  );
});
app.get("/405", (c) => {
  return c.json(
    {
      error: "Method Not Allowed",
    },
    405,
  );
});
app.get("/406", (c) => {
  return c.json(
    {
      error: "Not Acceptable",
    },
    406,
  );
});
app.get("/407", (c) => {
  return c.json(
    {
      error: "Proxy Authentication Required",
    },
    407,
  );
});
app.get("/429", (c) => {
  return c.json(
    {
      error: "Too Many Requests",
    },
    429,
  );
});

app.get("/500", (c) => {
  return c.json(
    {
      error: "Internal Server Error",
    },
    500,
  );
});
app.get("/501", (c) => {
  return c.json(
    {
      error: "Not Implemented",
    },
    501,
  );
});
app.get("/502", (c) => {
  return c.json(
    {
      error: "Bad Gateway",
    },
    502,
  );
});
app.get("/503", (c) => {
  return c.json(
    {
      error: "Service Unavailable",
    },
    503,
  );
});
app.get("/504", (c) => {
  return c.json(
    {
      error: "Gateway Timeout",
    },
    504,
  );
});
