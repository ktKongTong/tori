import type { QueueSendBatchOptions, QueueSendOptions } from "@cloudflare/workers-types";
import type { IMQ } from "./dispatcher";
import type { EventEnvelope } from "./message";

export type CFPublishOptions = QueueSendOptions;
export type CFBatchPublishOptions = QueueSendBatchOptions;

type BasePublishOptions = {
  delaySeconds?: number;
  deduplicationId?: string;
};

export type Publisher = "cf-queue" | "upstash-queue" | "aws-sqs" | "aws-sns";

type PublishOptionsByPublisher = {
  "cf-queue": CFPublishOptions;
  "upstash-queue": BasePublishOptions;
  "aws-sqs": BasePublishOptions;
  "aws-sns": BasePublishOptions;
};
export type PublishOptions<K extends Publisher> = PublishOptionsByPublisher[K];

type BatchPublishOptionsByPublisher = {
  "cf-queue": CFBatchPublishOptions;
  "upstash-queue": BasePublishOptions;
  "aws-sqs": BasePublishOptions;
  "aws-sns": BasePublishOptions;
};

export type BatchPublishOptions<K extends Publisher> = BatchPublishOptionsByPublisher[K];

export interface EventDispatcher<T extends Publisher = Publisher> extends IMQ {
  publish<E>(topic: string, event: EventEnvelope<E>, options?: PublishOptions<T>): Promise<void>;
  publishBatch<E>(
    topic: string,
    events: EventEnvelope<E>[],
    options?: BatchPublishOptions<T>,
  ): Promise<void>;
}
