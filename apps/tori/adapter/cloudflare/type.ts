export type CloudflareWorkerBinding = {
  QProducer: Queue;
  KVNamespace: KVNamespace;
  DB?: D1Database;
  HYPERDRIVE: Hyperdrive;
};
