import { describe, expect, it } from "vite-plus/test";
import { decrypt, encrypt } from "../src/crypto/index.ts";
import { ProviderRegistry } from "../src/provider/registry.ts";
import type { PollResult, Provider } from "../src/provider/types.ts";
import { ensureDefaultSystemTasks, runDueSystemTasks } from "../src/system-tasks/index.ts";
import type { AuthResult, AuthSessionState } from "../src/types.ts";
import { MemoryRepository } from "./memory-repo.ts";

const SECRET = "system-task-secret-32chars!!!!";

class MockRefreshProvider implements Provider {
  name = "mock-refresh";
  displayName = "Mock Refresh";
  flow = "poll" as const;
  tokenInjectMethod = "bearer";
  refreshPolicy = {
    intervalSec: 60,
  };

  async beginAuth() {
    return {
      challengeData: {
        qrUrl: "https://mock.example.com/refresh",
        interval: 1,
      },
    };
  }

  async pollAuth(_session: AuthSessionState): Promise<PollResult> {
    return {};
  }

  async callbackAuth(): Promise<AuthResult> {
    throw new Error("not supported");
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: `${refreshToken}-access-next`,
      refreshToken: `${refreshToken}-refresh-next`,
    };
  }
}

describe("system refresh tasks", () => {
  it("refreshes provider credentials and records task runs plus refresh logs", async () => {
    const repo = new MemoryRepository();
    const registry = new ProviderRegistry();
    registry.register(new MockRefreshProvider());

    const connection = await repo.createConnection({
      provider: "mock-refresh",
      providerUid: "mock-refresh-user",
      displayName: "Mock Refresh User",
      label: "scheduled",
      tokenInject: "bearer",
      permissions: ["proxy"],
      credentials: {
        accessToken: await encrypt("initial-access", SECRET),
        refreshToken: await encrypt("initial-refresh", SECRET),
      },
    });

    await ensureDefaultSystemTasks({ repo, registry, secret: SECRET });
    const [definition] = await repo.listSystemTaskDefinitions();
    expect(definition.provider).toBe("mock-refresh");

    await repo.updateSystemTaskDefinition(definition.id, {
      nextRunAt: 0,
    });

    const runs = await runDueSystemTasks({ repo, registry, secret: SECRET });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("DONE");

    const credentials = await repo.getCredentials(connection.id);
    expect(credentials).not.toBeNull();
    expect(await decrypt(credentials!.accessToken, SECRET)).toBe("initial-refresh-access-next");
    expect(await decrypt(credentials!.refreshToken, SECRET)).toBe("initial-refresh-refresh-next");

    const refreshLogs = await repo.listTokenRefreshLogs();
    expect(refreshLogs).toHaveLength(1);
    expect(refreshLogs[0].status).toBe("SUCCESS");
    expect(refreshLogs[0].connectionId).toBe(connection.id);

    const taskRuns = await repo.listSystemTaskRuns();
    expect(taskRuns).toHaveLength(1);
    expect(taskRuns[0].summary).toMatchObject({
      provider: "mock-refresh",
      scanned: 1,
      refreshed: 1,
      failed: 0,
      skipped: 0,
    });
  });
});
