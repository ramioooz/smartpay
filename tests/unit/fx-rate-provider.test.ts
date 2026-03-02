type MockProvider = {
  name: string;
  isAvailable: jest.Mock<Promise<boolean>, []>;
  fetchRates: jest.Mock<Promise<Array<{ pair: string; mid: number }>>, [string[]]>;
};

describe('fx rate-provider service', () => {
  const register = jest.fn();
  const resolve = jest.fn();

  const loadService = () => {
    jest.resetModules();

    jest.doMock('../../packages/fx-srv/src/providers/provider-registry', () => ({
      providerRegistry: {
        register,
        resolve,
      },
    }));

    return require('../../packages/fx-srv/src/services/rate-provider').rateProviderService as {
      initialize: () => Promise<void>;
      fetchRates: (pairs: string[]) => Promise<Array<{ pair: string; mid: number }>>;
      getActiveProviderName: () => string;
    };
  };

  beforeEach(() => {
    register.mockReset();
    resolve.mockReset();
  });

  it('switches to fallback provider when primary is unavailable at initialization', async () => {
    const primary: MockProvider = {
      name: 'frankfurter',
      isAvailable: jest.fn().mockResolvedValue(false),
      fetchRates: jest.fn(),
    };
    const fallback: MockProvider = {
      name: 'simulated',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchRates: jest.fn().mockResolvedValue([{ pair: 'USD-EUR', mid: 0.92 }]),
    };

    resolve.mockImplementation((name: string) => {
      if (name === 'frankfurter') {
        return primary;
      }
      if (name === 'simulated') {
        return fallback;
      }
      return undefined;
    });

    const service = loadService();
    await service.initialize();

    expect(service.getActiveProviderName()).toBe('simulated');
  });

  it('uses fallback rates when primary fetch fails', async () => {
    const primary: MockProvider = {
      name: 'frankfurter',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchRates: jest.fn().mockRejectedValue(new Error('network down')),
    };
    const fallbackRates = [{ pair: 'USD-EUR', mid: 0.921 }];
    const fallback: MockProvider = {
      name: 'simulated',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchRates: jest.fn().mockResolvedValue(fallbackRates),
    };

    resolve.mockImplementation((name: string) => {
      if (name === 'frankfurter') {
        return primary;
      }
      if (name === 'simulated') {
        return fallback;
      }
      return undefined;
    });

    const service = loadService();
    const rates = await service.fetchRates(['USD-EUR']);

    expect(rates).toEqual(fallbackRates);
    expect(service.getActiveProviderName()).toBe('simulated');
    expect(fallback.fetchRates).toHaveBeenCalledWith(['USD-EUR']);
  });

  it('switches back to primary provider after recovery', async () => {
    const primaryRates = [{ pair: 'USD-EUR', mid: 0.93 }];
    const primary: MockProvider = {
      name: 'frankfurter',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchRates: jest.fn().mockResolvedValue(primaryRates),
    };
    const fallback: MockProvider = {
      name: 'simulated',
      isAvailable: jest.fn().mockResolvedValue(true),
      fetchRates: jest.fn().mockResolvedValue([{ pair: 'USD-EUR', mid: 0.91 }]),
    };

    resolve.mockImplementation((name: string) => {
      if (name === 'frankfurter') {
        return primary;
      }
      if (name === 'simulated') {
        return fallback;
      }
      return undefined;
    });

    const service = loadService();
    await service.initialize();
    const rates = await service.fetchRates(['USD-EUR']);

    expect(rates).toEqual(primaryRates);
    expect(service.getActiveProviderName()).toBe('frankfurter');
  });
});
