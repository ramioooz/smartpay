const deleteCachedQuoteMock = jest.fn();

jest.mock('../../packages/fx-srv/src/services/rate-cache', () => ({
  deleteCachedQuote: deleteCachedQuoteMock,
  getCachedRate: jest.fn(),
  setCachedQuote: jest.fn(),
  setCachedRate: jest.fn(),
}));

jest.mock('../../packages/fx-srv/src/services/rate-provider', () => ({
  rateProviderService: {
    fetchRates: jest.fn(),
  },
}));

import { releaseQuote } from '../../packages/fx-srv/src/services/fx.service';

describe('fx quote release', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns released=true when quote key was deleted', async () => {
    deleteCachedQuoteMock.mockResolvedValue(1);

    const result = await releaseQuote('quote-1');

    expect(result).toEqual({
      quoteId: 'quote-1',
      released: true,
    });
  });

  it('returns released=false when quote was already missing', async () => {
    deleteCachedQuoteMock.mockResolvedValue(0);

    const result = await releaseQuote('quote-missing');

    expect(result).toEqual({
      quoteId: 'quote-missing',
      released: false,
    });
  });
});
