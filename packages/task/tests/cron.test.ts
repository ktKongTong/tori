import { describe, expect, it } from "vite-plus/test";
import { CronRouter, createCronHandler, isCronDueAt, normalizeCronDate } from "../src/cron.ts";

describe("cron", () => {
  it("normalizes dates to minute precision", () => {
    expect(normalizeCronDate(new Date("2026-01-01T00:00:59.999Z")).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("matches due cron expressions", () => {
    expect(isCronDueAt("* * * * *", new Date("2026-01-01T00:00:30.000Z"))).toBe(true);
    expect(isCronDueAt("5 * * * *", new Date("2026-01-01T00:04:59.999Z"))).toBe(false);
  });

  it("dispatches due handlers once", async () => {
    const handled: string[] = [];
    const router = new CronRouter<{ cron: string }, { cron: string; handlerId: string }>({
      now: () => new Date("2026-01-01T00:00:30.000Z"),
      createContext: ({ ctx, handler }) => ({ cron: ctx.cron, handlerId: handler.id }),
    });

    router.register(
      "* * * * *",
      createCronHandler("due", (ctx) => {
        handled.push(`${ctx.cron}:${ctx.handlerId}`);
      }),
    );
    router.register(
      "5 * * * *",
      createCronHandler("not-due", (ctx) => {
        handled.push(`${ctx.cron}:${ctx.handlerId}`);
      }),
    );

    await router.handle({ cron: "* * * * *" });

    expect(handled).toEqual(["* * * * *:due"]);
  });
});
