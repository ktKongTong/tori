import type { Auth } from "@/api/domain/infra/auth";
import type { DB } from "@/api/domain/infra/db";
import type { ENV } from "@/api/domain/infra/env";
import type { IMQ } from "@/api/domain/infra/eventing/dispatcher";
import type { IKV } from "@/api/domain/infra/kv";
import { createServiceContext } from "@/api/support/service-context";

export function createMockServiceContext(overrides: Record<string, unknown> = {}) {
  const tx = (overrides.tx ?? ({} as DB)) as DB;
  const env = (overrides.env ??
    ({
      ENVIRONMENT: "test",
      BETTER_AUTH_SECRET: "test",
      RESEND_TOKEN: "test",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_NAME: "Admin",
      CREDENTIAL_SECRET: "secret",
    } as ENV)) as ENV;
  const kv = (overrides.kv ?? ({} as IKV)) as IKV;
  const auth = (overrides.auth ?? ({ api: {} } as Auth)) as Auth;
  const queue = (overrides.queue ??
    ({ publish: async () => {}, publishBatch: async () => {} } as IMQ)) as IMQ;

  const options: any = {
    tx,
    env,
    kv,
    auth,
    queue,
    causationId: "test-cause",
    causationType: "req",
    correlationId: "test-correlation",
    source: "test",
    user:
      overrides.user ??
      ({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        banned: false,
        role: "admin",
      } as never),
    role: overrides.role ?? "admin",
    ...overrides,
  };

  return createServiceContext(options);
}
