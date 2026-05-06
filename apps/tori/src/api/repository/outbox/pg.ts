import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import * as schema from "@/api/db/schema/pg";
import type { EventEnvelope, PGDB } from "@/api/domain/infra";
import type { IOutboxRepository } from "@/api/domain/infra/repository/ports/eventing.ts";
import { uniqueId } from "@repo/utils/id";

export class OutboxPgRepository implements IOutboxRepository {
  constructor(private db: PGDB) {}
  async markProcessingTimeoutToPending(staleCutoff: Date) {
    await this.db
      .update(schema.outbox)
      .set({
        status: "PENDING",
        leaseToken: null,
        processingAt: null,
      })
      .where(
        and(
          eq(schema.outbox.status, "PROCESSING"),
          or(isNull(schema.outbox.processingAt), lt(schema.outbox.processingAt, staleCutoff)),
        ),
      );
  }

  async markPendingAsProcessing(limit: number) {
    const { leaseToken, rows } = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(schema.outbox)
        .where(eq(schema.outbox.status, "PENDING"))
        .for("update", { skipLocked: true })
        .limit(limit);

      if (rows.length <= 0) {
        return { leaseToken: null as string | null, rows: [] as EventEnvelope[] };
      }

      const leaseToken = uniqueId();
      const ids = rows.map((r) => r.id);
      await tx
        .update(schema.outbox)
        .set({
          status: "PROCESSING",
          leaseToken,
          processingAt: new Date(),
        })
        .where(inArray(schema.outbox.id, ids));
      return { leaseToken, rows };
    });
    return {
      leaseToken,
      rows,
    };
  }

  async markProcessingAsSent(leaseToken: string, ids: string[]) {
    const updated = await this.db
      .update(schema.outbox)
      .set({
        status: "SENT",
        leaseToken: null,
        processingAt: null,
      })
      .where(
        and(
          inArray(schema.outbox.id, ids),
          eq(schema.outbox.status, "PROCESSING"),
          eq(schema.outbox.leaseToken, leaseToken),
        ),
      )
      .returning({ id: schema.outbox.id });
    return updated;
  }

  async insertEvent(event: EventEnvelope<unknown>) {
    await this.db.insert(schema.outbox).values(event);
  }

  async batchInsertEvent(events: EventEnvelope<unknown>[]) {
    await this.db.insert(schema.outbox).values(events);
  }
}
