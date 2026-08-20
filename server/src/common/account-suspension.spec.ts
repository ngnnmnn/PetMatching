import { getAccountSuspensionMessage } from './account-suspension';

describe('getAccountSuspensionMessage', () => {
  it('explains that an account was blocked for abusing reports', async () => {
    const db = {
      auditLog: {
        findFirst: jest.fn().mockResolvedValue({
          action: 'ADMIN_BLOCK_REPORT_ABUSE',
          createdAt: new Date('2026-08-20T07:00:00Z'),
        }),
      },
      petReport: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    const message = await getAccountSuspensionMessage(db as any, 'user-1');

    expect(message).toBe(
      'Tài khoản của bạn đã bị khóa do lạm dụng tính năng phản ánh. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.',
    );
  });

  it('keeps the matching-report violation reason when that action is newer', async () => {
    const db = {
      auditLog: {
        findFirst: jest.fn().mockResolvedValue({
          action: 'ADMIN_BLOCK_REPORT_ABUSE',
          createdAt: new Date('2026-08-18T07:00:00Z'),
        }),
      },
      petReport: {
        findFirst: jest.fn().mockResolvedValue({
          reason: 'HARASSMENT',
          resolvedAt: new Date('2026-08-20T07:00:00Z'),
          createdAt: new Date('2026-08-19T07:00:00Z'),
        }),
      },
    };

    const message = await getAccountSuspensionMessage(db as any, 'user-1');

    expect(message).toContain('quấy rối người dùng khác');
  });
});
