import { describe, expect, test, vi } from "vite-plus/test";
import type { DBOptions } from "@/api/db";
import type { User } from "@/api/domain/infra";
import { ensureDefaultMockBindings } from "./playground-binding";

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function createSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function createInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ensureDefaultMockBindings", () => {
  test("still ensures channel resources when the default playground user identity already exists", async () => {
    const selectChain = createSelectChain([{ id: "binding-1" }]);
    const insertChain = createInsertChain();
    const insert = vi.fn().mockReturnValue(insertChain);
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      insert,
    } as unknown as DBOptions["db"];

    await ensureDefaultMockBindings({ db, provider: "pg" }, createUser());

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "playground-channel-user-1",
        type: "dm",
        createdByUserId: "user-1",
      }),
    );
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "playground-channel-user-1",
        platform: "playground",
        externalChannelId: "tori-dm-user-1",
        namespace: "managed",
        botPluginInstanceId: "00000000-0000-0000-0000-00000000b001",
        status: "active",
      }),
    );
  });

  test("creates stable playground user and channel bindings for the authenticated user", async () => {
    const selectChain = createSelectChain([]);
    const insertChain = createInsertChain();
    const db = {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
    } as unknown as DBOptions["db"];

    await ensureDefaultMockBindings({ db, provider: "pg" }, createUser());

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        platform: "playground",
        externalUserId: "tori-user-user-1",
        externalUserName: "Ada",
        namespace: "managed",
        source: "system-default",
        assurance: "session-authenticated",
      }),
    );
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "playground-channel-user-1",
        type: "dm",
        name: "Ada Trial Channel",
        status: "active",
        createdByUserId: "user-1",
      }),
    );
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "playground-channel-user-1",
        platform: "playground",
        externalChannelId: "tori-dm-user-1",
        externalChannelName: "Ada Trial Channel",
        namespace: "managed",
        botPluginInstanceId: "00000000-0000-0000-0000-00000000b001",
        source: "system-default",
        assurance: "session-authenticated",
        status: "active",
      }),
    );
    expect(insertChain.onConflictDoNothing).toHaveBeenCalledTimes(3);
  });
});
