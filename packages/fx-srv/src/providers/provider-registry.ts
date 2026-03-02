import { FXRateProvider } from './fx-rate-provider.interface';

export class ProviderRegistry {
  private readonly providers = new Map<string, FXRateProvider>();

  register(provider: FXRateProvider): void {
    this.providers.set(provider.name, provider);
  }

  resolve(name: string): FXRateProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): FXRateProvider[] {
    return [...this.providers.values()];
  }
}

export const providerRegistry = new ProviderRegistry();
