import {
  createCorrelationId,
  createSpanId,
  createTraceId,
  formatTraceparent,
  parseTraceparent,
} from "@repo/core/utils/trace";
import type { Auth, User } from "./auth.js";
import {
  type DB,
  type DBType,
  type DefaultDBType,
  isImplicitTxActive,
  type PGDB,
  type SqliteDB,
} from "./db.ts";
import type { ENV } from "./env.ts";
import type { IMQ } from "./eventing/dispatcher.ts";
import type { CausationType } from "./eventing/index.ts";
import type { EventEnvelope } from "./eventing/message.ts";
import type { IKV } from "./kv.ts";
import { type AppLogger, createNoopLoggerFactory, type LoggerFactory } from "./logger.js";
import type { InfraRepositoryContainer, RepositoryFactory } from "./repository";

type InfraComponents<T extends DBType = DefaultDBType> = {
  tx: DB<T>;
  dbType?: T;
  env: ENV;
  kv: IKV;
  auth: Auth;
  queue: IMQ;
  loggerFactory?: LoggerFactory;
};

export type ServiceContextOption<
  TRepositories extends InfraRepositoryContainer = any,
  T extends DBType = DefaultDBType,
> = {
  traceId?: string;
  traceparent?: string | null;
  tracestate?: string | null;
  correlationId?: string;
  causationType: CausationType;
  causationId: string;
  user?: User | null;
  source: string;
  role?: string;
  repositories: TRepositories;
} & InfraComponents<T>;

// context don't know about the db type

export class ServiceContext<
  TRepositories extends InfraRepositoryContainer = any,
  T extends DBType = DefaultDBType,
> {
  readonly traceId: string;
  readonly spanId: string;
  spanLink?: string | null;
  readonly traceparent: string | null;
  readonly tracestate: string | null;
  readonly causationId: string;
  readonly causationType: CausationType;
  correlationId: string;
  businessId?: string | undefined;
  source: string;
  userId?: string | null;
  user?: User | null;
  role?: string;
  readonly env: ENV;
  readonly #tx: DB<T>;
  readonly dbType: T;
  readonly queue: IMQ;
  #allowNested: boolean = true;

  readonly kv: IKV;
  readonly auth: Auth;
  #logger: AppLogger;
  readonly #loggerFactory: LoggerFactory;
  readonly repositories: TRepositories;
  get logger() {
    return this.#logger;
  }

  get allowNestedTx() {
    return this.#allowNested;
  }

  set allowNestedTx(value: boolean) {
    if (isImplicitTxActive()) {
      throw new Error(`Can't modify allowNestedTx flag during tx`);
    }
    this.#allowNested = value;
  }

  constructor({
    traceId: _traceId,
    traceparent,
    tracestate,
    correlationId,
    causationType,
    causationId,
    env,
    tx,
    dbType = "pg" as T,
    repositories,
    kv,
    auth,
    queue,
    source,
    user,
    role,
    loggerFactory = createNoopLoggerFactory,
  }: ServiceContextOption<TRepositories, T>) {
    const traceId = _traceId ?? parseTraceparent(traceparent)?.traceId ?? createTraceId();
    this.traceId = traceId ?? createSpanId();
    this.spanId = createSpanId();
    this.traceparent = formatTraceparent(traceId, this.spanId);
    this.tracestate = tracestate ?? null;
    this.correlationId = correlationId ?? createCorrelationId();
    this.causationType = causationType;
    this.causationId = causationId;
    this.source = source;
    this.#tx = tx;
    this.dbType = dbType;
    this.repositories = repositories;
    this.queue = queue;
    this.env = env;
    this.kv = kv;
    this.auth = auth;
    this.#loggerFactory = loggerFactory;
    this.#logger = this.createLogger();
    this.user = user;
    this.userId = user?.id ?? null;
    this.role = role;
  }

  private createLogger() {
    return this.#loggerFactory({
      traceId: this.traceId,
      spanId: this.spanId,
      correlationId: this.correlationId,
      source: this.source,
    });
  }

  private refreshLogger() {
    this.#logger = this.createLogger();
  }

  updateSourceName(source: string) {
    this.source = source;
    this.refreshLogger();
  }

  updateBizId(bizId: string) {
    this.businessId = bizId;
  }

  isAdmin() {
    return this.role === "admin";
  }

  createRepository<TRepository>(factory: RepositoryFactory<TRepository>): TRepository {
    if (this.dbType === "sqlite") {
      return factory.sqlite(this.#tx as SqliteDB);
    }
    return factory.pg(this.#tx as PGDB);
  }

  async sendEvent<T = unknown>(events: EventEnvelope<T> | EventEnvelope<T>[]) {
    if (Array.isArray(events)) {
      return this.repositories.outbox.batchInsertEvent(events);
    } else {
      return this.repositories.outbox.insertEvent(events);
    }
  }

  clone(overrides: Partial<ServiceContextOption<TRepositories, T>> & { bizId?: string }) {
    const ctx = new ServiceContext<TRepositories, T>({
      traceId: this.traceId,
      traceparent: this.traceparent,
      tracestate: this.tracestate,
      correlationId: this.correlationId,
      causationType: this.causationType,
      causationId: this.causationId,
      env: this.env,
      tx: this.#tx,
      dbType: this.dbType,
      repositories: overrides.repositories ?? this.repositories,
      kv: this.kv,
      auth: this.auth,
      queue: this.queue,
      source: this.source,
      user: this.user,
      role: this.role,
      loggerFactory: this.#loggerFactory,
      ...overrides,
    });
    ctx.businessId = overrides?.bizId;
    return ctx;
  }
}
