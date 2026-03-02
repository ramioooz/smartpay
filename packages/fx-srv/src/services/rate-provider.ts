import { FXRate, createLogger } from '@smartpay/shared';
import { config } from '../config';
import { FrankfurterProvider } from '../providers/frankfurter.provider';
import { providerRegistry } from '../providers/provider-registry';
import { SimulatedProvider } from '../providers/simulated.provider';

const logger = createLogger({ service: 'fx-srv', component: 'rate-provider' });

class RateProviderService {
  private activeProviderName: string = config.FX_PRIMARY_PROVIDER;

  constructor() {
    providerRegistry.register(new FrankfurterProvider());
    providerRegistry.register(new SimulatedProvider());
  }

  async initialize(): Promise<void> {
    const primary = providerRegistry.resolve(config.FX_PRIMARY_PROVIDER);
    if (primary && (await primary.isAvailable())) {
      this.activeProviderName = primary.name;
      logger.info({ provider: primary.name }, 'Using primary FX provider');
      return;
    }

    const fallback = providerRegistry.resolve(config.FX_FALLBACK_PROVIDER);
    if (fallback) {
      this.activeProviderName = fallback.name;
      logger.warn({ provider: fallback.name }, 'Primary FX provider unavailable, using fallback');
    }
  }

  getActiveProviderName(): string {
    return this.activeProviderName;
  }

  async fetchRates(pairs: string[]): Promise<FXRate[]> {
    const primary = providerRegistry.resolve(config.FX_PRIMARY_PROVIDER);
    const fallback = providerRegistry.resolve(config.FX_FALLBACK_PROVIDER);

    if (!primary) {
      throw new Error(`Primary FX provider ${config.FX_PRIMARY_PROVIDER} is not registered`);
    }

    try {
      const rates = await primary.fetchRates(pairs);
      if (this.activeProviderName !== primary.name) {
        logger.info({ provider: primary.name }, 'Primary FX provider recovered, switching back');
      }
      this.activeProviderName = primary.name;
      return rates;
    } catch (error) {
      if (!fallback) {
        throw error;
      }

      logger.warn(
        { error, primary: primary.name, fallback: fallback.name },
        'Frankfurter API unreachable, using simulated rates',
      );
      this.activeProviderName = fallback.name;
      return fallback.fetchRates(pairs);
    }
  }
}

export const rateProviderService = new RateProviderService();
