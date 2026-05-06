import type { Env, Hono } from "hono";
import type { Auth, Session, User } from "@/api/domain/infra/auth.ts";
import type { DB } from "@/api/domain/infra/db.ts";
import type { ENV } from "@/api/domain/infra/env.ts";
import type { IMQ } from "@/api/domain/infra/eventing/dispatcher.ts";
import type { IKV } from "@/api/domain/infra/kv.ts";
import type { AppLogger } from "@/api/domain/infra/logger.ts";
import type { ServiceContext } from "@/api/domain/infra/service-context.ts";

export interface ApiEnv extends Env {
  Variables: {
    appEnv: ENV;
    auth: Auth;
    db: DB;
    kv: IKV;
    logger?: AppLogger;
    mq: IMQ;
    role?: string;
    serviceContext: ServiceContext;
    session: Session | null;
    user: User | null;
  };
}

export type ApiApp = Hono<ApiEnv>;
