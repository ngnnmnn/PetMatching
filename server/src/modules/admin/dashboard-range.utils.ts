const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardRangeKey = '7d' | '30d' | '90d' | '12m' | 'custom';
export type DashboardGranularity = 'day' | 'week' | 'month';

export type DashboardRange = {
  key: DashboardRangeKey;
  label: string;
  from: Date;
  toExclusive: Date;
  previousFrom: Date;
  previousToExclusive: Date;
  granularity: DashboardGranularity;
};

export type DashboardBucket = {
  key: string;
  label: string;
  from: Date;
  toExclusive: Date;
};

type DashboardRangeInput = {
  range?: string;
  from?: string;
  to?: string;
};

function startOfVietnamDay(value: Date) {
  const shifted = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - VIETNAM_OFFSET_MS);
}

function startOfVietnamMonth(value: Date) {
  const shifted = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) -
      VIETNAM_OFFSET_MS,
  );
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function addMonths(value: Date, months: number) {
  const shifted = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + months, 1) -
      VIETNAM_OFFSET_MS,
  );
}

function parseVietnamDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}

export function resolveDashboardRange(
  input: DashboardRangeInput = {},
  now = new Date(),
): DashboardRange {
  const requestedKey = input.range as DashboardRangeKey | undefined;
  const customFrom = parseVietnamDate(input.from);
  const customTo = parseVietnamDate(input.to);

  if (
    requestedKey === 'custom' &&
    customFrom &&
    customTo &&
    customFrom <= customTo
  ) {
    const toExclusive = addDays(customTo, 1);
    const durationDays = Math.ceil(
      (toExclusive.getTime() - customFrom.getTime()) / DAY_MS,
    );
    const previousFrom = addDays(customFrom, -durationDays);
    const granularity: DashboardGranularity =
      durationDays > 120 ? 'month' : durationDays > 31 ? 'week' : 'day';

    return {
      key: 'custom',
      label: `${formatDay(customFrom)} - ${formatDay(customTo)}`,
      from: customFrom,
      toExclusive,
      previousFrom,
      previousToExclusive: customFrom,
      granularity,
    };
  }

  if (requestedKey === '12m') {
    const currentMonth = startOfVietnamMonth(now);
    const from = addMonths(currentMonth, -11);
    const toExclusive = addMonths(currentMonth, 1);
    return {
      key: '12m',
      label: '12 tháng qua',
      from,
      toExclusive,
      previousFrom: addMonths(from, -12),
      previousToExclusive: from,
      granularity: 'month',
    };
  }

  const validPreset = requestedKey === '7d' || requestedKey === '90d';
  const key: '7d' | '30d' | '90d' = validPreset ? requestedKey : '30d';
  const days = key === '7d' ? 7 : key === '90d' ? 90 : 30;
  const today = startOfVietnamDay(now);
  const from = addDays(today, -(days - 1));
  const toExclusive = addDays(today, 1);

  return {
    key,
    label:
      key === '7d'
        ? '7 ngày qua'
        : key === '90d'
          ? '90 ngày qua'
          : '30 ngày qua',
    from,
    toExclusive,
    previousFrom: addDays(from, -days),
    previousToExclusive: from,
    granularity: key === '90d' ? 'week' : 'day',
  };
}

export function buildDashboardBuckets(
  range: DashboardRange,
): DashboardBucket[] {
  const buckets: DashboardBucket[] = [];

  if (range.granularity === 'month') {
    let cursor = startOfVietnamMonth(range.from);
    while (cursor < range.toExclusive) {
      const next = addMonths(cursor, 1);
      buckets.push({
        key: cursor.toISOString(),
        label: formatMonth(cursor),
        from: cursor,
        toExclusive: next,
      });
      cursor = next;
    }
    return buckets;
  }

  const step = range.granularity === 'week' ? 7 : 1;
  let cursor = range.from;
  while (cursor < range.toExclusive) {
    const next = new Date(
      Math.min(addDays(cursor, step).getTime(), range.toExclusive.getTime()),
    );
    buckets.push({
      key: cursor.toISOString(),
      label:
        range.granularity === 'week'
          ? `${formatDay(cursor)} - ${formatDay(addDays(next, -1))}`
          : formatDay(cursor),
      from: cursor,
      toExclusive: next,
    });
    cursor = next;
  }

  return buckets;
}
