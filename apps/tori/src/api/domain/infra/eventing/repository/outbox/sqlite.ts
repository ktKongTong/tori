import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import * as schema from "@/api/db/schema/d1";
import type { EventEnvelope, SqliteDB } from "@/api/domain/infra";
import type { IOutboxRepository } from "@/api/domain/infra/eventing/repository/repository.ts";
import { uniqueId } from "@repo/utils/id";

export class OutboxSqliteRepository implements IOutboxRepository {
  constructor(private db: SqliteDB) {}

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
    const rows = await this.db
      .select()
      .from(schema.outbox)
      .where(eq(schema.outbox.status, "PENDING"))
      .limit(limit);

    if (rows.length <= 0) {
      return { leaseToken: null, rows: [] as EventEnvelope<unknown>[] };
    }

    const leaseToken = uniqueId();
    const ids = rows.map((row) => row.id);
    await this.db
      .update(schema.outbox)
      .set({
        status: "PROCESSING",
        leaseToken,
        processingAt: new Date(),
      })
      .where(and(inArray(schema.outbox.id, ids), eq(schema.outbox.status, "PENDING")));

    return { leaseToken, rows: rows.map(toEventEnvelope) };
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
    await this.db.insert(schema.outbox).values(toSqliteOutbox(event));
  }

  async batchInsertEvent(events: EventEnvelope<unknown>[]) {
    if (events.length <= 0) return;
    await this.db.insert(schema.outbox).values(events.map(toSqliteOutbox));
  }
}

type SqliteOutboxRow = typeof schema.outbox.$inferSelect;

function toEventEnvelope(row: SqliteOutboxRow): EventEnvelope<unknown> {
  return { ...row, timestamp: BigInt(row.timestamp) };
}

function toSqliteOutbox(event: EventEnvelope<unknown>): typeof schema.outbox.$inferInsert {
  return { ...event, timestamp: Number(event.timestamp) };
}
