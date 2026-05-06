export interface EventDispatcher<
  TEvent = unknown,
  TPublishOptions = unknown,
  TBatchOptions = unknown,
> {
  publish(topic: string, event: TEvent, options?: TPublishOptions): Promise<void>;
  publishBatch(topic: string, events: TEvent[], options?: TBatchOptions): Promise<void>;
}

export class NoopMQ implements EventDispatcher {
  async publish(_topic: string, _event: unknown, _options?: unknown): Promise<void> {}

  async publishBatch(_topic: string, _events: unknown[], _options?: unknown): Promise<void> {}
}

export const noopMQ = new NoopMQ();
