import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { randomCode } from "@repo/utils/random";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SEC,
  createAdminSessionCookieValue,
} from "../admin-session.ts";
import { encrypt } from "../crypto/index.ts";
import { adminSessionAuth } from "../middleware/auth.ts";
import type { ProviderRegistry } from "../provider/registry.ts";
import type { Repository } from "../repository/types.ts";
import {
  ensureDefaultSystemTasks,
  runAllSystemTasks,
  runDueSystemTasks,
  runSystemTaskById,
} from "../system-tasks/index.ts";

const loginSchema = z.object({
  adminKey: z.string().min(1),
});

const updateConnectionSchema = z.object({
  displayName: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  permissions: z.array(z.string().min(1)).optional(),
  status: z.enum(["active", "revoked"]).optional(),
});

const createConnectionSchema = z.object({
  provider: z.string().min(1),
  label: z.string().nullable().optional(),
  permissions: z.array(z.string().min(1)).optional(),
});

const externalConnectQuerySchema = z.object({
  provider: z.string().min(1),
  state: z.string().min(16),
  callback: z.string().url(),
  label: z.string().nullable().optional(),
  permissions: z.string().optional(),
});

const externalConnectConfirmSchema = z.object({
  state: z.string().min(16),
});

const externalConnectExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(16),
});

const connectionViewSchema = z.object({
  id: z.string(),
  provider: z.string(),
  providerUid: z.string(),
  displayName: z.string(),
  label: z.string().nullable().optional(),
  tokenInject: z.string(),
  permissions: z.array(z.string()),
  apiKey: z.string(),
  apiKeyPreview: z.string().optional(),
  status: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().nullable().optional(),
  lastUsedAt: z.number().nullable().optional(),
});

const authFlowSessionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  status: z.enum(["pending", "completed", "failed", "expired"]),
  verificationUri: z.string().nullable(),
  pollIntervalSeconds: z.string(),
  expiresAt: z.number(),
  providerUid: z.string().nullable(),
  displayName: z.string().nullable(),
  apiKey: z.string().nullable().optional(),
  connection: connectionViewSchema.nullable().optional(),
  errorMessage: z.string().nullable(),
});

const providerInfoSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  flow: z.enum(["poll", "redirect", "direct"]),
  tokenInjectMethod: z.string(),
  refreshIntervalSec: z.number().nullable(),
});

const systemTaskDefinitionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  provider: z.string(),
  enabled: z.boolean(),
  intervalSec: z.number(),
  payload: z.record(z.string(), z.unknown()),
  nextRunAt: z.number(),
  lastTriggeredAt: z.number().nullable(),
  lastRunAt: z.number().nullable(),
  lastRunStatus: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const systemTaskRunSchema = z.object({
  id: z.string(),
  taskDefinitionId: z.string(),
  kind: z.string(),
  status: z.string(),
  summary: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  scheduledFor: z.number().nullable().optional(),
  startedAt: z.number().nullable().optional(),
  finishedAt: z.number().nullable().optional(),
  createdAt: z.number(),
});

const tokenRefreshLogSchema = z.object({
  id: z.number(),
  taskRunId: z.string().nullable().optional(),
  connectionId: z.string(),
  provider: z.string(),
  status: z.string(),
  message: z.string().nullable().optional(),
  createdAt: z.number(),
});

function zodHook(result: any, c: any) {
  if (!result.success) {
    const first = result.error.issues[0];
    return c.json(
      {
        error: "invalid_request",
        error_description: `${first.path.join(".")}: ${first.message}`,
      },
      400,
    );
  }
}

interface AdminDeps {
  repo: Repository;
  secret: string;
  adminKey: string;
  registry: ProviderRegistry;
}

function serializeConnection(connection: {
  id: string;
  provider: string;
  providerUid: string;
  displayName: string;
  label?: string | null;
  tokenInject: string;
  permissions?: string[];
  apiKey: string;
  status: string;
  createdAt: number;
  updatedAt?: number | null;
  lastUsedAt?: number | null;
}) {
  return connectionViewSchema.parse({
    ...connection,
    permissions: connection.permissions ?? [],
    apiKeyPreview: connection.apiKey.slice(0, 12),
  });
}

function createAuthFlowSessionView(
  connectionId: string | null,
  provider: string,
  session: {
    id: string;
    challengeData?: Record<string, unknown>;
    expiresAt: number;
    result?: { providerUid: string; displayName: string } | null;
    connection?: ReturnType<typeof serializeConnection> | null;
    apiKey?: string | null;
    error?: string | null;
  },
  status: "pending" | "completed" | "failed" | "expired",
) {
  const pollInterval =
    typeof session.challengeData?.interval === "number" ||
    typeof session.challengeData?.interval === "string"
      ? session.challengeData.interval
      : 5;

  return authFlowSessionSchema.parse({
    id: session.id,
    provider,
    status,
    verificationUri:
      typeof session.challengeData?.qrUrl === "string" ? session.challengeData.qrUrl : null,
    pollIntervalSeconds: String(pollInterval),
    expiresAt: session.expiresAt,
    providerUid: session.result?.providerUid ?? null,
    displayName: session.result?.displayName ?? null,
    connection: session.connection ?? null,
    apiKey: session.apiKey ?? null,
    errorMessage: session.error ?? null,
    connectionId,
  });
}

function jsonForScript(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function parsePermissions(value: string | undefined, provider: string) {
  if (!value) {
    return provider === "steam" ? ["proxy", "account", "steam-family"] : ["proxy", "account"];
  }

  const permissions = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return permissions.length
    ? permissions
    : provider === "steam"
      ? ["proxy", "account", "steam-family"]
      : ["proxy", "account"];
}

function createExternalConnectPage(config: {
  sessionId: string;
  provider: string;
  state: string;
  callbackUrl: string;
  verificationUri: string | null;
  pollIntervalSeconds: string;
  expiresAt: number;
}) {
  const serialized = jsonForScript(config);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect ${config.provider}</title>
    <style>
      :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
      main { width: min(560px, calc(100vw - 32px)); border: 1px solid color-mix(in srgb, CanvasText 16%, transparent); padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { color: color-mix(in srgb, CanvasText 70%, transparent); line-height: 1.5; }
      a, button { font: inherit; }
      button { width: 100%; padding: 10px 12px; margin-top: 12px; }
      code { overflow-wrap: anywhere; }
      .box { border: 1px solid color-mix(in srgb, CanvasText 14%, transparent); padding: 12px; margin: 16px 0; }
      .error { color: #b42318; }
    </style>
  </head>
  <body>
    <main>
      <h1>Connect ${config.provider}</h1>
      <p id="status">Waiting for provider authorization.</p>
      <div class="box">
        <p>Open the provider verification URL and complete authorization.</p>
        <p><a id="verification-link" target="_blank" rel="noreferrer">Open verification page</a></p>
        <code id="verification-uri"></code>
      </div>
      <div id="account" class="box" hidden>
        <p>Authorized account</p>
        <strong id="display-name"></strong>
        <p><code id="provider-uid"></code></p>
        <button id="confirm" type="button">Confirm connection</button>
      </div>
      <p id="error" class="error"></p>
    </main>
    <script>
      const config = ${serialized};
      const statusEl = document.getElementById("status");
      const errorEl = document.getElementById("error");
      const accountEl = document.getElementById("account");
      const displayNameEl = document.getElementById("display-name");
      const providerUidEl = document.getElementById("provider-uid");
      const verificationUriEl = document.getElementById("verification-uri");
      const verificationLinkEl = document.getElementById("verification-link");
      const confirmEl = document.getElementById("confirm");
      let completed = false;

      function setVerificationUri(uri) {
        if (!uri) return;
        verificationUriEl.textContent = uri;
        verificationLinkEl.href = uri;
      }

      async function poll() {
        if (completed) return;
        const response = await fetch("/admin/external-connect/" + encodeURIComponent(config.sessionId));
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error_description || "Polling failed");
        setVerificationUri(payload.verificationUri);

        if (payload.status === "pending") {
          statusEl.textContent = "Waiting for provider authorization.";
          window.setTimeout(poll, Math.max(2000, Number(payload.pollIntervalSeconds || 5) * 1000));
          return;
        }

        if (payload.status === "completed") {
          completed = true;
          statusEl.textContent = "Authorization completed. Confirm the account to continue.";
          accountEl.hidden = false;
          displayNameEl.textContent = payload.displayName || payload.providerUid || config.provider;
          providerUidEl.textContent = payload.providerUid || "";
          return;
        }

        throw new Error(payload.errorMessage || "Authorization failed");
      }

      confirmEl.addEventListener("click", async () => {
        confirmEl.disabled = true;
        statusEl.textContent = "Creating token-proxy connection.";
        const response = await fetch("/admin/external-connect/" + encodeURIComponent(config.sessionId) + "/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: config.state })
        });
        const payload = await response.json();
        if (!response.ok) {
          confirmEl.disabled = false;
          throw new Error(payload.error_description || "Confirm failed");
        }
        window.location.href = payload.redirectUrl;
      });

      setVerificationUri(config.verificationUri);
      poll().catch((error) => {
        errorEl.textContent = error instanceof Error ? error.message : String(error);
        statusEl.textContent = "Connection failed.";
      });
    </script>
  </body>
</html>`;
}

export function adminRoutes(deps: AdminDeps) {
  const { repo, secret, adminKey, registry } = deps;
  const app = new Hono();

  app.post("/auth/login", zValidator("json", loginSchema, zodHook), async (c) => {
    const body = c.req.valid("json");
    if (body.adminKey !== adminKey) {
      return c.json({ error: "unauthorized", error_description: "invalid admin key" }, 401);
    }

    const cookieValue = await createAdminSessionCookieValue(secret, adminKey);
    setCookie(c, ADMIN_SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: ADMIN_SESSION_TTL_SEC,
    });

    return c.json({ authenticated: true });
  });

  app.post("/auth/logout", (c) => {
    deleteCookie(c, ADMIN_SESSION_COOKIE, { path: "/" });
    return c.json({ authenticated: false });
  });

  app.use("/auth/session", adminSessionAuth(secret, adminKey));
  app.get("/auth/session", (c) => {
    return c.json({ authenticated: true });
  });

  app.use("/providers", adminSessionAuth(secret, adminKey));
  app.get("/providers", async (c) => {
    await ensureDefaultSystemTasks({ repo, registry, secret });
    return c.json({
      items: registry.all().map((provider) =>
        providerInfoSchema.parse({
          name: provider.name,
          displayName: provider.displayName ?? provider.name,
          flow: provider.flow,
          tokenInjectMethod: provider.tokenInjectMethod,
          refreshIntervalSec: provider.refreshPolicy?.intervalSec ?? null,
        }),
      ),
    });
  });

  app.get(
    "/external-connect",
    zValidator("query", externalConnectQuerySchema, zodHook),
    async (c) => {
      const query = c.req.valid("query");
      let provider;
      try {
        provider = registry.get(query.provider);
      } catch {
        return c.json(
          {
            error: "invalid_request",
            error_description: `unknown provider: ${query.provider}`,
          },
          400,
        );
      }

      if (provider.flow !== "poll") {
        return c.json(
          {
            error: "invalid_request",
            error_description: `provider ${query.provider} does not support external connect flow`,
          },
          400,
        );
      }

      const begin = await provider.beginAuth({});
      const sessionId = randomCode("external_connect", 12);
      const expiresIn = 300;
      const expiresAt = Date.now() + expiresIn * 1000;
      const permissions = parsePermissions(query.permissions, query.provider);

      await repo.setAuthSession(
        sessionId,
        {
          providerName: query.provider,
          flowType: "poll",
          challengeData: begin.challengeData,
          expiresAt,
          mode: "external-connect",
          externalConnect: {
            state: query.state,
            callbackUrl: query.callback,
            connectionId: null,
          },
          requestedConnection: {
            label: query.label ?? "Tori",
            permissions,
          },
        },
        expiresIn,
      );

      const view = createAuthFlowSessionView(
        null,
        query.provider,
        {
          id: sessionId,
          challengeData: begin.challengeData,
          expiresAt,
        },
        "pending",
      );

      return c.html(
        createExternalConnectPage({
          sessionId,
          provider: query.provider,
          state: query.state,
          callbackUrl: query.callback,
          verificationUri: view.verificationUri,
          pollIntervalSeconds: view.pollIntervalSeconds,
          expiresAt,
        }),
      );
    },
  );

  app.get("/external-connect/:sid", async (c) => {
    const sid = c.req.param("sid");
    const session = await repo.getAuthSession(sid);
    if (!session || session.mode !== "external-connect") {
      return c.json({ error: "not_found", error_description: "connect session not found" }, 404);
    }

    if (session.expiresAt < Date.now()) {
      await repo.deleteAuthSession(sid);
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: "Connect session expired",
          },
          "expired",
        ),
      );
    }

    if (session.error) {
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: session.error,
          },
          "failed",
        ),
      );
    }

    if (session.result) {
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            result: session.result,
          },
          "completed",
        ),
      );
    }

    const provider = registry.get(session.providerName);
    const pollResult = await provider.pollAuth(session);

    if (pollResult.error) {
      await repo.setAuthSession(sid, { ...session, error: pollResult.error }, 300);
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: pollResult.error,
          },
          "failed",
        ),
      );
    }

    if (pollResult.updatedChallenge) {
      const nextSession = {
        ...session,
        challengeData: {
          ...session.challengeData,
          ...pollResult.updatedChallenge,
        },
      };
      await repo.setAuthSession(sid, nextSession, 300);
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: nextSession.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    if (!pollResult.result) {
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: sid,
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    await repo.setAuthSession(sid, { ...session, result: pollResult.result }, 300);
    return c.json(
      createAuthFlowSessionView(
        null,
        session.providerName,
        {
          id: sid,
          challengeData: session.challengeData,
          expiresAt: session.expiresAt,
          result: pollResult.result,
        },
        "completed",
      ),
    );
  });

  app.post(
    "/external-connect/:sid/confirm",
    zValidator("json", externalConnectConfirmSchema, zodHook),
    async (c) => {
      const sid = c.req.param("sid");
      const body = c.req.valid("json");
      const session = await repo.getAuthSession(sid);

      if (!session || session.mode !== "external-connect" || !session.externalConnect) {
        return c.json({ error: "not_found", error_description: "connect session not found" }, 404);
      }

      if (session.externalConnect.state !== body.state) {
        return c.json({ error: "invalid_request", error_description: "state mismatch" }, 400);
      }

      if (session.expiresAt < Date.now()) {
        await repo.deleteAuthSession(sid);
        return c.json({ error: "expired", error_description: "connect session expired" }, 410);
      }

      if (!session.result) {
        return c.json(
          { error: "invalid_request", error_description: "provider authorization is incomplete" },
          409,
        );
      }

      const provider = registry.get(session.providerName);
      const connection = await repo.createConnection({
        provider: session.providerName,
        providerUid: session.result.providerUid,
        displayName: session.result.displayName,
        label: session.requestedConnection?.label ?? null,
        permissions: session.requestedConnection?.permissions,
        tokenInject: provider.tokenInjectMethod,
        credentials: {
          accessToken: await encrypt(session.result.accessToken, secret),
          refreshToken: await encrypt(session.result.refreshToken, secret),
        },
      });
      const codeSecret = randomCode("tp_code", 16);
      const code = `${sid}.${codeSecret}`;
      const callbackUrl = new URL(session.externalConnect.callbackUrl);
      callbackUrl.searchParams.set("state", session.externalConnect.state);
      callbackUrl.searchParams.set("code", code);

      await repo.setAuthSession(
        sid,
        {
          ...session,
          authCode: code,
          externalConnect: {
            ...session.externalConnect,
            connectionId: connection.id,
          },
        },
        300,
      );

      return c.json({
        redirectUrl: callbackUrl.toString(),
      });
    },
  );

  app.post(
    "/external-connect/exchange",
    zValidator("json", externalConnectExchangeSchema, zodHook),
    async (c) => {
      const body = c.req.valid("json");
      const [sid] = body.code.split(".");
      if (!sid) {
        return c.json({ error: "invalid_request", error_description: "invalid code" }, 400);
      }

      const session = await repo.getAuthSession(sid);
      if (
        !session ||
        session.mode !== "external-connect" ||
        !session.externalConnect ||
        !session.externalConnect.connectionId ||
        session.authCode !== body.code
      ) {
        return c.json({ error: "not_found", error_description: "exchange code not found" }, 404);
      }

      if (session.externalConnect.state !== body.state) {
        return c.json({ error: "invalid_request", error_description: "state mismatch" }, 400);
      }

      if (session.expiresAt < Date.now()) {
        await repo.deleteAuthSession(sid);
        return c.json({ error: "expired", error_description: "exchange code expired" }, 410);
      }

      const connection = await repo.getConnectionById(session.externalConnect.connectionId);
      if (!connection) {
        return c.json({ error: "not_found", error_description: "connection not found" }, 404);
      }

      await repo.deleteAuthSession(sid);

      return c.json({
        connection: serializeConnection(connection),
        apiKey: connection.apiKey,
        account: {
          providerAccountId: connection.providerUid,
          providerAccountName: connection.displayName,
          providerAccountAvatar: null,
        },
      });
    },
  );

  app.use("/connections/*", adminSessionAuth(secret, adminKey));
  app.use("/connections", adminSessionAuth(secret, adminKey));
  app.get("/connections", async (c) => {
    const connections = await repo.listConnections();
    return c.json({
      items: connections.map((connection) => serializeConnection(connection)),
    });
  });

  app.post(
    "/connections/connect",
    zValidator("json", createConnectionSchema, zodHook),
    async (c) => {
      const body = c.req.valid("json");

      let provider;
      try {
        provider = registry.get(body.provider);
      } catch {
        return c.json(
          {
            error: "invalid_request",
            error_description: `unknown provider: ${body.provider}`,
          },
          400,
        );
      }

      if (provider.flow !== "poll") {
        return c.json(
          {
            error: "invalid_request",
            error_description: `provider ${body.provider} does not support managed connect flow`,
          },
          400,
        );
      }

      const begin = await provider.beginAuth({});
      const sessionId = generateSessionId("connect");
      const expiresIn = 300;
      const expiresAt = Date.now() + expiresIn * 1000;

      await repo.setAuthSession(
        sessionId,
        {
          providerName: body.provider,
          flowType: "poll",
          challengeData: begin.challengeData,
          expiresAt,
          mode: "connect",
          requestedConnection: {
            label: body.label ?? null,
            permissions: body.permissions,
          },
        },
        expiresIn,
      );

      return c.json(
        createAuthFlowSessionView(
          null,
          body.provider,
          {
            id: sessionId,
            challengeData: begin.challengeData,
            expiresAt,
          },
          "pending",
        ),
      );
    },
  );

  app.get("/connections/connect/:sid", async (c) => {
    const session = await repo.getAuthSession(c.req.param("sid"));
    if (!session || session.mode !== "connect") {
      return c.json({ error: "not_found", error_description: "connect session not found" }, 404);
    }

    if (session.expiresAt < Date.now()) {
      await repo.deleteAuthSession(c.req.param("sid"));
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: "Connect session expired",
          },
          "expired",
        ),
      );
    }

    if (session.error) {
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: session.error,
          },
          "failed",
        ),
      );
    }

    const provider = registry.get(session.providerName);
    const pollResult = await provider.pollAuth(session);

    if (pollResult.error) {
      await repo.setAuthSession(
        c.req.param("sid"),
        {
          ...session,
          error: pollResult.error,
        },
        300,
      );
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: pollResult.error,
          },
          "failed",
        ),
      );
    }

    if (pollResult.updatedChallenge) {
      const nextSession = {
        ...session,
        challengeData: {
          ...session.challengeData,
          ...pollResult.updatedChallenge,
        },
      };
      await repo.setAuthSession(c.req.param("sid"), nextSession, 300);
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: c.req.param("sid"),
            challengeData: nextSession.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    if (!pollResult.result) {
      return c.json(
        createAuthFlowSessionView(
          null,
          session.providerName,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    const connection = await repo.createConnection({
      provider: session.providerName,
      providerUid: pollResult.result.providerUid,
      displayName: pollResult.result.displayName,
      label: session.requestedConnection?.label ?? null,
      permissions: session.requestedConnection?.permissions,
      tokenInject: provider.tokenInjectMethod,
      credentials: {
        accessToken: await encrypt(pollResult.result.accessToken, secret),
        refreshToken: await encrypt(pollResult.result.refreshToken, secret),
      },
    });
    await repo.deleteAuthSession(c.req.param("sid"));

    return c.json(
      createAuthFlowSessionView(
        connection.id,
        connection.provider,
        {
          id: c.req.param("sid"),
          challengeData: session.challengeData,
          expiresAt: session.expiresAt,
          result: {
            providerUid: connection.providerUid,
            displayName: connection.displayName,
          },
          connection: serializeConnection(connection),
          apiKey: connection.apiKey,
        },
        "completed",
      ),
    );
  });

  app.patch("/connections/:id", zValidator("json", updateConnectionSchema, zodHook), async (c) => {
    const body = c.req.valid("json");
    const connection = await repo.updateConnection(c.req.param("id"), {
      displayName: body.displayName ?? undefined,
      label: body.label,
      permissions: body.permissions,
      status: body.status,
      updatedAt: Math.floor(Date.now() / 1000),
    });

    if (!connection) {
      return c.json({ error: "not_found", error_description: "connection not found" }, 404);
    }

    return c.json(serializeConnection(connection));
  });

  app.post("/connections/:id/revoke", async (c) => {
    const connection = await repo.getConnectionById(c.req.param("id"));
    if (!connection) {
      return c.json({ error: "not_found", error_description: "connection not found" }, 404);
    }

    await repo.updateConnection(connection.id, {
      status: "revoked",
      updatedAt: Math.floor(Date.now() / 1000),
    });

    return c.json({ revoked: true });
  });

  app.post("/connections/:id/reconnect", async (c) => {
    const connection = await repo.getConnectionById(c.req.param("id"));
    if (!connection) {
      return c.json({ error: "not_found", error_description: "connection not found" }, 404);
    }

    const provider = registry.get(connection.provider);
    if (provider.flow !== "poll") {
      return c.json(
        {
          error: "invalid_request",
          error_description: `provider ${connection.provider} does not support reconnect flow`,
        },
        400,
      );
    }

    const begin = await provider.beginAuth({});
    const sessionId = generateSessionId("reconnect");
    const expiresIn = 300;
    const expiresAt = Date.now() + expiresIn * 1000;
    await repo.setAuthSession(
      sessionId,
      {
        providerName: connection.provider,
        flowType: "poll",
        challengeData: begin.challengeData,
        expiresAt,
        mode: "reconnect",
        reconnectConnectionId: connection.id,
      },
      expiresIn,
    );

    return c.json(
      createAuthFlowSessionView(
        connection.id,
        connection.provider,
        {
          id: sessionId,
          challengeData: begin.challengeData,
          expiresAt,
        },
        "pending",
      ),
    );
  });

  app.get("/connections/:id/reconnect/:sid", async (c) => {
    const connection = await repo.getConnectionById(c.req.param("id"));
    if (!connection) {
      return c.json({ error: "not_found", error_description: "connection not found" }, 404);
    }

    const session = await repo.getAuthSession(c.req.param("sid"));
    if (
      !session ||
      session.mode !== "reconnect" ||
      session.reconnectConnectionId !== connection.id
    ) {
      return c.json({ error: "not_found", error_description: "reconnect session not found" }, 404);
    }

    if (session.expiresAt < Date.now()) {
      await repo.deleteAuthSession(c.req.param("sid"));
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: "Reconnect session expired",
          },
          "expired",
        ),
      );
    }

    if (session.error) {
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: session.error,
          },
          "failed",
        ),
      );
    }

    const provider = registry.get(session.providerName);
    const pollResult = await provider.pollAuth(session);

    if (pollResult.error) {
      await repo.setAuthSession(
        c.req.param("sid"),
        {
          ...session,
          error: pollResult.error,
        },
        300,
      );
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error: pollResult.error,
          },
          "failed",
        ),
      );
    }

    if (pollResult.updatedChallenge) {
      const nextSession = {
        ...session,
        challengeData: {
          ...session.challengeData,
          ...pollResult.updatedChallenge,
        },
      };
      await repo.setAuthSession(c.req.param("sid"), nextSession, 300);
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: nextSession.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    if (!pollResult.result) {
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
          },
          "pending",
        ),
      );
    }

    if (pollResult.result.providerUid !== connection.providerUid) {
      const error = "Connected account does not match the existing connection.";
      await repo.setAuthSession(
        c.req.param("sid"),
        {
          ...session,
          error,
        },
        300,
      );
      return c.json(
        createAuthFlowSessionView(
          connection.id,
          connection.provider,
          {
            id: c.req.param("sid"),
            challengeData: session.challengeData,
            expiresAt: session.expiresAt,
            error,
          },
          "failed",
        ),
      );
    }

    await repo.updateCredentials(connection.id, {
      accessToken: await encrypt(pollResult.result.accessToken, secret),
      refreshToken: await encrypt(pollResult.result.refreshToken, secret),
    });
    const nextConnection = await repo.updateConnection(connection.id, {
      displayName: pollResult.result.displayName,
      status: "active",
      updatedAt: Math.floor(Date.now() / 1000),
    });
    await repo.deleteAuthSession(c.req.param("sid"));

    return c.json(
      createAuthFlowSessionView(
        connection.id,
        connection.provider,
        {
          id: c.req.param("sid"),
          challengeData: session.challengeData,
          expiresAt: session.expiresAt,
          result: {
            providerUid: pollResult.result.providerUid,
            displayName: pollResult.result.displayName,
          },
          connection: nextConnection ? serializeConnection(nextConnection) : null,
        },
        "completed",
      ),
    );
  });

  app.use("/request-logs", adminSessionAuth(secret, adminKey));
  app.get("/request-logs", async (c) => {
    const connectionId = c.req.query("connectionId") || undefined;
    const limit = Number.parseInt(c.req.query("limit") || "100", 10);
    const logs = await repo.listRequestLogs({
      connectionId,
      limit: Number.isFinite(limit) ? limit : 100,
    });

    return c.json({ items: logs });
  });

  app.use("/refresh-logs", adminSessionAuth(secret, adminKey));
  app.get("/refresh-logs", async (c) => {
    const connectionId = c.req.query("connectionId") || undefined;
    const limit = Number.parseInt(c.req.query("limit") || "100", 10);
    const logs = await repo.listTokenRefreshLogs({
      connectionId,
      limit: Number.isFinite(limit) ? limit : 100,
    });

    return c.json({
      items: logs.map((log) => tokenRefreshLogSchema.parse(log)),
    });
  });

  app.use("/system/*", adminSessionAuth(secret, adminKey));
  app.use("/system", adminSessionAuth(secret, adminKey));
  app.get("/system/tasks", async (c) => {
    await ensureDefaultSystemTasks({ repo, registry, secret });
    const definitions = await repo.listSystemTaskDefinitions();
    return c.json({
      items: definitions.map((definition) => systemTaskDefinitionSchema.parse(definition)),
    });
  });

  app.get("/system/task-runs", async (c) => {
    const taskDefinitionId = c.req.query("taskDefinitionId") || undefined;
    const limit = Number.parseInt(c.req.query("limit") || "100", 10);
    const runs = await repo.listSystemTaskRuns({
      taskDefinitionId,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    return c.json({
      items: runs.map((run) => systemTaskRunSchema.parse(run)),
    });
  });

  app.post("/system/run-due", async (c) => {
    const runs = await runDueSystemTasks({ repo, registry, secret });
    return c.json({
      items: runs.map((run) => systemTaskRunSchema.parse(run)),
    });
  });

  app.post("/system/run-all", async (c) => {
    const runs = await runAllSystemTasks({ repo, registry, secret });
    return c.json({
      items: runs.map((run) => systemTaskRunSchema.parse(run)),
    });
  });

  app.post("/system/tasks/:id/run", async (c) => {
    const run = await runSystemTaskById({ repo, registry, secret }, c.req.param("id"));
    return c.json({
      item: systemTaskRunSchema.parse(run),
    });
  });

  return app;
}

function generateSessionId(prefix: string) {
  return randomCode(prefix, 16);
}
