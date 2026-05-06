import { and, eq } from "drizzle-orm";
import * as schema from "@/api/db/schema/pg";
import type { EventEnvelope, PGDB } from "@/api/domain/infra";
import type {
  IInboxRepository,
  InboxHandleRequest,
  InboxHandleResult,
} from "@/api/domain/infra/repository/ports/eventing.ts";

type InboxInsert = typeof schema.inbox.$inferInsert;

export class InboxPgRepository implements IInboxRepository {
  constructor(private db: PGDB) {}
  async insertInbox(inbox: InboxInsert) {
    const [evtLog] = await this.db
      .insert(schema.inbox)
      .values(inbox)
      .onConflictDoNothing({
        target: [schema.inbox.eventId, schema.inbox.handlerId],
      })
      .returning({ status: schema.inbox.status });
    return evtLog;
  }

  batchInsertInbox(_events: EventEnvelope<unknown>[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async markFailedInboxAsProcessing(inbox: InboxHandleRequest) {
    const [res] = await this.db
      .update(schema.inbox)
      .set({
        status: "PROCESSING",
        processedAt: new Date(),
        finishedAt: null,
        reason: null,
        spanId: inbox.spanId,
        traceparent: inbox.traceparent,
        tracestate: inbox.tracestate,
      })
      .where(
        and(
          eq(schema.inbox.eventId, inbox.eventId),
          eq(schema.inbox.handlerId, inbox.handlerId),
          eq(schema.inbox.status, "FAIL"),
        ),
      )
      .returning({ status: schema.inbox.status });
    return res;
  }

  async markProcessingInboxAsCompleted(result: InboxHandleResult) {
    await this.db
      .update(schema.inbox)
      .set({
        status: result.status,
        finishedAt: new Date(),
        reason: result.reason,
      })
      .where(
        and(
          eq(schema.inbox.eventId, result.eventId),
          eq(schema.inbox.handlerId, result.handlerId),
          eq(schema.inbox.status, "PROCESSING"),
        ),
      );
  }

  async getHandlerResult(evtId: string, handlerId: string) {
    const [existing] = await this.db
      .select({
        status: schema.inbox.status,
        reason: schema.inbox.reason,
      })
      .from(schema.inbox)
      .where(and(eq(schema.inbox.eventId, evtId), eq(schema.inbox.handlerId, handlerId)))
      .limit(1);
    return existing;
  }
}
