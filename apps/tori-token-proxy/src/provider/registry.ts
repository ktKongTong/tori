import type { Provider } from "./types.ts";
import { SteamProvider } from "./steam.ts";

export class ProviderRegistry {
  private providers = new Map<string, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): Provider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`unknown provider: ${name}`);
    return p;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  all(): Provider[] {
    return [...this.providers.values()];
  }
}

export function createDefaultProviderRegistry() {
  const registry = new ProviderRegistry();
  registry.register(new SteamProvider());
  return registry;
}
