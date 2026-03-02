import { PSPAdapter } from '@smartpay/shared';
import { getRedisClient } from '../services/redis';
import { CheckoutAdapter } from './checkout.adapter';
import { CryptoRailAdapter } from './crypto-rail.adapter';
import { StripeAdapter } from './stripe.adapter';
import { WiseAdapter } from './wise.adapter';

class PSPAdapterRegistry {
  private adapters: Map<string, PSPAdapter> = new Map();

  registerAdapter(adapter: PSPAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  resolveAdapter(name: string): PSPAdapter | undefined {
    return this.adapters.get(name);
  }

  getAllAdapters(): PSPAdapter[] {
    return [...this.adapters.values()];
  }

  initialize(): void {
    const redis = getRedisClient();

    this.registerAdapter(new StripeAdapter(redis));
    this.registerAdapter(new WiseAdapter(redis));
    this.registerAdapter(new CheckoutAdapter(redis));
    this.registerAdapter(new CryptoRailAdapter(redis));
  }
}

export const pspAdapterRegistry = new PSPAdapterRegistry();
