import type { IKV } from "./kv.ts";

export type CloudflareKVPutOptions = {
  expirationTtl?: number;
};

export interface CloudflareKVNamespace {
  delete(key: string): Promise<void>;
  get(key: string, type: "text"): Promise<string | null>;
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: CloudflareKVPutOptions): Promise<void>;
}

export class CloudflareKV implements IKV {
  constructor(private readonly kv: CloudflareKVNamespace) {}

  async del(key: string): Promise<void> {
    await this.kv.delete(key);
  }

  async incr(key: string, num: number = 1, ttl?: number): Promise<number> {
    const value = await this.kv.get(key, "text");
    const current = Number.parseInt(value ?? "", 10);
    const next = Number.isNaN(current) ? num : Math.max(0, current + num);
    await this.kv.put(key, String(next), this.resolvePutOptions(ttl));
    return next;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<"OK" | T | null> {
    await this.kv.put(key, JSON.stringify({ [key]: value }), this.resolvePutOptions(ttl));
    return "OK";
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.kv.get<Record<string, T>>(key, "json");
    return value?.[key] ?? null;
  }

  async mget<TData extends unknown[]>(...args: string[] | [string[]]): Promise<TData> {
    const keys = args.length === 1 && Array.isArray(args[0]) ? args[0] : (args as string[]);
    const values = await Promise.all(keys.map((key) => this.get(key)));
    return values as TData;
  }

  async sadd(setKey: string, member: string, ttl?: number): Promise<void> {
    const members = (await this.get<string[]>(setKey)) ?? [];
    if (members.includes(member)) return;
    await this.set(setKey, [...members, member], ttl);
  }

  async smembers(setKey: string): Promise<string[]> {
    return (await this.get<string[]>(setKey)) ?? [];
  }

  private resolvePutOptions(ttl?: number): CloudflareKVPutOptions | undefined {
    return ttl ? { expirationTtl: ttl } : undefined;
  }
}
