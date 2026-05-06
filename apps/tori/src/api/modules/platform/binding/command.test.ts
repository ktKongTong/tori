import { createMockServiceContext } from "@test/utils/service.ts";
import { describe, expect, it, vi } from "vite-plus/test";
import { subscriptions } from "@/api/db/schema/index.ts";

import {
  assertBindingGrantCanBeConsumed,
  assertBindingGrantIssueInput,
  consumeAnonymousClaim,
} from "./command.js";

describe("binding grant issuance rules", () => {
  it("allows claim-user tokens only for web", () => {
    expect(() =>
      assertBindingGrantIssueInput({
        purpose: "claim-user",
        subjectType: "user",
        subjectId: "user-1",
        issuedToSurface: "web",
      }),
    ).not.toThrow();
  });

  it("rejects claim-user tokens issued for bot", () => {
    expect(() =>
      assertBindingGrantIssueInput({
        purpose: "claim-user",
        subjectType: "user",
        subjectId: "user-1",
        issuedToSurface: "bot",
      }),
    ).toThrow("Token purpose claim-user can only be issued for web");
  });
});

describe("binding grant consumption rules", () => {
  it("rejects consuming claim-user tokens in bot", () => {
    expect(() =>
      assertBindingGrantCanBeConsumed(
        {
          purpose: "claim-user",
          subjectType: "user",
          issuedToSurface: "web",
        },
        {
          consumeSurface: "bot",
          allowedSubjectTypes: ["user"],
        },
      ),
    ).toThrow("This token can only be used on web.");
  });

  it("rejects consuming bot bind tokens on web", () => {
    expect(() =>
      assertBindingGrantCanBeConsumed(
        {
          purpose: "bind-user",
          subjectType: "user",
          issuedToSurface: "bot",
        },
        {
          consumeSurface: "web",
        },
      ),
    ).toThrow("This token can only be used in bot.");
  });

  it("rejects non-user tokens in current bot flow", () => {
    expect(() =>
      assertBindingGrantCanBeConsumed(
        {
          purpose: "bind-channel",
          subjectType: "channel",
          issuedToSurface: "bot",
        },
        {
          consumeSurface: "bot",
          allowedSubjectTypes: ["user"],
        },
      ),
    ).toThrow("Bot currently only supports user binding tokens.");
  });

  it("moves subscription ownership from anonymous user to authenticated user after claim", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockReturnValueOnce({
          limit: vi.fn().mockResolvedValue([
            {
              id: "grant-1",
              purpose: "claim-user",
              subjectType: "user",
              issuedToSurface: "web",
              status: "pending",
            },
          ]),
        })
        .mockReturnValueOnce({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "claim-1", anonymousUserId: "anonymous-user-1", grantId: "grant-1" },
            ]),
        })
        .mockReturnValueOnce({
          limit: vi
            .fn()
            .mockResolvedValue([
              { id: "anonymous-user-1", name: "Pending Alice", isAnonymous: true },
            ]),
        }),
    };

    const createSimpleUpdateChain = () => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const subscriptionUpdateSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const createReturningUpdateChain = () => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "claim-1", status: "resolved" }]),
        }),
      }),
    });

    const mockDb = {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi
        .fn()
        .mockReturnValueOnce(createSimpleUpdateChain())
        .mockReturnValueOnce(createSimpleUpdateChain())
        .mockReturnValueOnce({ set: subscriptionUpdateSet })
        .mockReturnValueOnce(createSimpleUpdateChain())
        .mockReturnValueOnce(createReturningUpdateChain()),
    };

    const ctx = createMockServiceContext({
      tx: mockDb,
      user: {
        id: "user-2",
        email: "user-2@example.com",
        name: "Alice",
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
        banned: false,
        role: "user",
      },
      role: "user",
    });

    const result = await consumeAnonymousClaim(ctx, { token: "invalid-sha-source" });

    expect(result.authenticatedUserId).toBe("user-2");
    expect(mockDb.update).toHaveBeenCalledTimes(5);
    expect(mockDb.update.mock.calls[2]?.[0]).toBe(subscriptions);
    expect(subscriptionUpdateSet.mock.calls[0]?.[0]).toMatchObject({
      ownerId: "user-2",
    });
  });
});
