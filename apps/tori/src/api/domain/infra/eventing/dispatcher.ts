import type { EventDispatcher } from "@repo/task/eventing";
import type { EventEnvelope } from "./message.js";

export type IMQ = EventDispatcher<EventEnvelope, unknown, unknown>;
