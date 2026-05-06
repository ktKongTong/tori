export interface IKV {
  incr(key: string, num?: number, ttl?: number): Promise<number>;
  set<T>(key: string, value: T, ttl?: number): Promise<T | "OK" | null>;
  mget<TData extends unknown[]>(...args: string[] | [string[]]): Promise<TData>;
  get<T>(key: string): Promise<T | null>;
  sadd(setKey: string, member: string, ttl?: number): Promise<void>;
  smembers(setKey: string): Promise<string[]>;
  del(key: string): Promise<void>;
}

type Entry<T = unknown> = {
  value: T;
  expiresAt?: number;
};

export class MemoryKV implements IKV {
  private store = new Map<string, Entry>();

  async sadd(setKey: string, member: string, ttl?: number): Promise<void> {
    const set = this.read<Set<string>>(setKey) ?? new Set<string>();
    set.add(member);
    this.write(setKey, set, ttl);
  }

  async smembers(setKey: string): Promise<string[]> {
    const set = this.read<Set<string>>(setKey);
    if (!set) return [];
    return Array.from(set);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  private isExpired(entry: Entry): boolean {
    return typeof entry.expiresAt === "number" && entry.expiresAt <= Date.now();
  }

  private read<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private write<T>(key: string, value: T, ttl?: number) {
    const expiresAt = typeof ttl === "number" && ttl > 0 ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async incr(key: string, num: number = 1, ttl?: number): Promise<number> {
    const prev = Number(this.read<number>(key) ?? 0);
    const next = Number.isFinite(prev) ? Math.max(0, prev + num) : Math.max(0, num);
    this.write(key, next, ttl);
    return next;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<"OK" | T | null> {
    this.write(key, value, ttl);
    return "OK";
  }

  async get<T>(key: string): Promise<T | null> {
    return this.read<T>(key);
  }

  async mget<TData extends unknown[]>(...args: string[] | [string[]]): Promise<TData> {
    const keys = args.length === 1 && Array.isArray(args[0]) ? args[0] : (args as string[]);
    const values = keys.map((key) => this.read(key));
    return values as TData;
  }
}

export class NoopKV implements IKV {
  sadd(_setKey: string, _member: string, _ttl?: number): Promise<void> {
    return Promise.resolve();
  }

  async smembers(_setKey: string): Promise<string[]> {
    return [];
  }

  del(_key: string): Promise<void> {
    return Promise.resolve();
  }

  async incr(_key: string, _num: number = 1, _ttl?: number): Promise<number> {
    return 0;
  }

  async set<T>(_key: string, _value: T, _ttl?: number): Promise<"OK" | T | null> {
    return "OK";
  }

  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async mget<TData extends unknown[]>(...args: string[] | [string[]]): Promise<TData> {
    const keys = args.length === 1 && Array.isArray(args[0]) ? args[0] : (args as string[]);
    const values = keys.map(() => null);
    return values as TData;
  }
}

export const memoryKV = new MemoryKV();
export const noopKV = new NoopKV();
