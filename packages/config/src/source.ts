export type ConfigValue = string | undefined;

export type ConfigSource = {
  get(key: string): ConfigValue;
};

export type ConfigRecord = Record<string, ConfigValue>;

export function createRecordConfigSource(values: ConfigRecord): ConfigSource {
  return {
    get(key) {
      return values[key];
    },
  };
}

export function createEnvConfigSource(env: Record<string, unknown>): ConfigSource {
  return {
    get(key) {
      const value = env[key];
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
      }
      return undefined;
    },
  };
}

export function createMergedConfigSource(...sources: ConfigSource[]): ConfigSource {
  return {
    get(key) {
      for (const source of sources) {
        const value = source.get(key);
        if (value !== undefined) return value;
      }
      return undefined;
    },
  };
}

export function readConfigKeys(source: ConfigSource, keys: readonly string[]): ConfigRecord {
  return Object.fromEntries(keys.map((key) => [key, source.get(key)]));
}
