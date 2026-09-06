import {
  buildDashboardBuckets,
  resolveDashboardRange,
} from './dashboard-range.utils';

describe('admin dashboard range utils', () => {
  const now = new Date('2026-09-06T03:00:00.000Z');

  it('defaults to 30 Vietnam calendar days', () => {
    const range = resolveDashboardRange({}, now);

    expect(range.key).toBe('30d');
    expect(range.granularity).toBe('day');
    expect(range.from.toISOString()).toBe('2026-08-07T17:00:00.000Z');
    expect(range.toExclusive.toISOString()).toBe('2026-09-06T17:00:00.000Z');
    expect(buildDashboardBuckets(range)).toHaveLength(30);
  });

  it('groups a 90 day range into weekly buckets', () => {
    const range = resolveDashboardRange({ range: '90d' }, now);
    const buckets = buildDashboardBuckets(range);

    expect(range.granularity).toBe('week');
    expect(buckets).toHaveLength(13);
    expect(buckets[0].from).toEqual(range.from);
    expect(buckets.at(-1)?.toExclusive).toEqual(range.toExclusive);
  });

  it('accepts a custom inclusive date range', () => {
    const range = resolveDashboardRange(
      { range: 'custom', from: '2026-08-01', to: '2026-08-05' },
      now,
    );

    expect(range.key).toBe('custom');
    expect(range.from.toISOString()).toBe('2026-07-31T17:00:00.000Z');
    expect(range.toExclusive.toISOString()).toBe('2026-08-05T17:00:00.000Z');
    expect(range.previousFrom.toISOString()).toBe('2026-07-26T17:00:00.000Z');
    expect(buildDashboardBuckets(range)).toHaveLength(5);
  });

  it('falls back to 30 days for an invalid custom range', () => {
    const range = resolveDashboardRange(
      { range: 'custom', from: '2026-09-10', to: '2026-09-01' },
      now,
    );

    expect(range.key).toBe('30d');
  });
});
