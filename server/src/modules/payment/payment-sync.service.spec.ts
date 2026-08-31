import { PaymentSyncService } from './payment-sync.service';

describe('PaymentSyncService lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('clears its polling timer when the application closes', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const prisma = {
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PaymentSyncService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.onApplicationBootstrap();
    expect(jest.getTimerCount()).toBe(1);

    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
