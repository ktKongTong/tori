import { describe, expect, it } from "vite-plus/test";
import { adminRole, authStatement, hasRole, userRole } from "../src/access-control.ts";
import { createAppAuthClient } from "../src/client/react.ts";
import { baseAuthConfig } from "../src/server/config.ts";
import { createAuthOptions } from "../src/server/factory.ts";

describe("better-auth foundations", () => {
  it("defines stable access-control roles", () => {
    expect(authStatement.user).toContain("list");
    expect(authStatement.role).toEqual(["user", "admin"]);
    expect(userRole).toBeDefined();
    expect(adminRole).toBeDefined();
    expect(hasRole("user,admin", "admin")).toBe(true);
    expect(hasRole("user", "admin")).toBe(false);
  });

  it("builds base options without binding env or runtime", () => {
    expect(baseAuthConfig.plugins?.length).toBeGreaterThan(0);
    const options = createAuthOptions({
      database: { provider: "sqlite", url: "file:test.db" },
      basePath: "/api/auth",
      trustedOrigins: ["http://localhost:3000"],
      emailAndPassword: { enabled: true },
      socialProviders: {
        github: { clientId: "github-id", clientSecret: "github-secret" },
      },
    });

    expect(options.basePath).toBe("/api/auth");
    expect(options.trustedOrigins).toEqual(["http://localhost:3000"]);
    expect(options.emailAndPassword).toEqual({ enabled: true });
    expect(options.socialProviders).toMatchObject({
      github: { clientId: "github-id", clientSecret: "github-secret" },
    });
  });

  it("creates a typed react auth client", () => {
    const client = createAppAuthClient({ baseURL: "http://localhost:3000" });
    expect(typeof client).toBe("function");
  });
});
