import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  const service = new ShippingService();

  it('returns the 126 local Hanoi wards with unique official codes', () => {
    const wards = service.getWards(1);

    expect(wards).toHaveLength(126);
    expect(new Set(wards.map(({ wardCode }) => wardCode)).size).toBe(126);
    expect(wards).toContainEqual({
      wardCode: '70',
      wardName: 'Phường Hoàn Kiếm',
    });
  });

  it('does not return Hanoi wards for another province code', () => {
    expect(service.getWards(79)).toEqual([]);
  });
});
