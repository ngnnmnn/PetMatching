import { ComplaintAction, ComplaintStatus, Prisma } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { buildAccountSuspensionMessage } from './matching-report-reason';

type SuspensionDb = PrismaService | Prisma.TransactionClient;

export const REPORT_ABUSE_BLOCK_MESSAGE =
  'Tài khoản của bạn đã bị khóa do lạm dụng tính năng phản ánh. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.';

export async function getAccountSuspensionMessage(
  db: SuspensionDb,
  userId: string,
) {
  const [latestAccountAction, matchingReportAction] = await Promise.all([
    db.auditLog.findFirst({
      where: {
        action: {
          in: ['ADMIN_BLOCK_REPORT_ABUSE', 'ADMIN_UPDATE_ACCOUNT_STATUS'],
        },
        targetType: 'User',
        targetId: userId,
      },
      orderBy: { createdAt: 'desc' },
      select: { action: true, createdAt: true },
    }),
    db.petReport.findFirst({
      where: {
        reportedUserId: userId,
        status: ComplaintStatus.RESOLVED,
        actionTaken: ComplaintAction.SUSPEND_ACCOUNT,
      },
      orderBy: [{ resolvedAt: 'desc' }, { createdAt: 'desc' }],
      select: { reason: true, resolvedAt: true, createdAt: true },
    }),
  ]);

  const accountActionAt = latestAccountAction?.createdAt?.getTime() ?? 0;
  const reportCreatedAt =
    (
      matchingReportAction?.resolvedAt ?? matchingReportAction?.createdAt
    )?.getTime() ?? 0;

  if (
    latestAccountAction?.action === 'ADMIN_BLOCK_REPORT_ABUSE' &&
    accountActionAt >= reportCreatedAt
  ) {
    return REPORT_ABUSE_BLOCK_MESSAGE;
  }

  if (matchingReportAction && reportCreatedAt >= accountActionAt) {
    return buildAccountSuspensionMessage(matchingReportAction.reason);
  }

  return 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên nếu cần hỗ trợ.';
}
