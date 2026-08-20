import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  ComplaintAction,
  ComplaintStatus,
  DocumentStatus,
  DocumentType,
  PetStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService matching reports', () => {
  let prisma: any;
  let tx: any;
  let service: AdminService;
  const notifications = { create: jest.fn() };
  const cloudinary = { destroyByUrl: jest.fn() };
  const reportCreatedAt = new Date('2026-08-08T03:00:00Z');

  const openReport = () => ({
    id: 'report-1',
    userId: 'reporter-1',
    reportedUserId: 'reported-1',
    petId: 'pet-1',
    matchId: 'match-1',
    targetType: 'USER',
    reason: 'HARASSMENT',
    status: ComplaintStatus.REVIEWING,
    resolvedById: 'admin-1',
    reviewStartedAt: new Date('2026-08-08T03:05:00Z'),
    createdAt: reportCreatedAt,
    pet: { name: 'Milo', status: PetStatus.ACTIVE, ownerId: 'reported-1' },
  });

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      petReport: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(openReport())),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({
          id: 'report-1',
          status: ComplaintStatus.RESOLVED,
        }),
      },
      pet: { update: jest.fn().mockResolvedValue({ id: 'pet-1' }) },
      petDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { update: jest.fn().mockResolvedValue({ id: 'reported-1' }) },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    prisma = {
      petReport: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      message: { findMany: jest.fn() },
      auditLog: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback: (client: any) => unknown) => callback(tx)),
    };
    notifications.create.mockReset().mockResolvedValue({ id: 'notification-1' });
    cloudinary.destroyByUrl.mockReset().mockResolvedValue(undefined);
    service = new AdminService(prisma as PrismaService, notifications as any, cloudinary as any);
  });

  it('returns report context with messages ordered from oldest to newest', async () => {
    const newer = { id: 'message-2', createdAt: new Date('2026-08-08T02:00:00Z') };
    const older = { id: 'message-1', createdAt: new Date('2026-08-08T01:00:00Z') };
    prisma.petReport.findUnique.mockResolvedValue({
      id: 'report-1',
      targetType: 'USER',
      matchId: 'match-1',
      createdAt: reportCreatedAt,
      reporter: {
        id: 'reporter-1',
      },
    });
    prisma.message.findMany.mockResolvedValue([newer, older]);

    const report = await service.getMatchingReport('report-1');

    expect(report.match?.messages).toEqual([older, newer]);
    expect(prisma.petReport.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report-1' },
      include: expect.any(Object),
    }));
    expect(prisma.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        matchId: 'match-1',
        createdAt: { lte: reportCreatedAt },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }));
    expect(report.resolutionMessageTemplates.RESOLVED.WARNING).toContain(
      'đã được xác minh',
    );
    expect(report.resolutionMessageTemplates.RESOLVED.SUSPEND_ACCOUNT).toContain(
      'tạm khóa tài khoản',
    );
    expect(report.resolutionMessageTemplates.RESOLVED.HIDE_CONTENT).toContain(
      'ngừng khả năng tham gia ghép đôi',
    );
    expect(report.reporterActivity.level).toBe('NORMAL');
  });

  it('rejects a missing report', async () => {
    prisma.petReport.findUnique.mockResolvedValue(null);
    await expect(service.getMatchingReport('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks a pending report as under review by the current admin', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      status: ComplaintStatus.PENDING,
      resolvedById: null,
    });

    await service.startMatchingReportReview({ id: 'admin-1' }, 'report-1');

    expect(tx.petReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: expect.objectContaining({
        status: ComplaintStatus.REVIEWING,
        resolvedById: 'admin-1',
        reviewStartedAt: expect.any(Date),
      }),
    });
  });

  it('resolves, audits and sends the editable result to the reporter', async () => {
    const resolutionMessage =
      'Phản ánh của bạn đã được xác minh và PetMatch đã xử lý.';

    await service.resolveMatchingReport({ id: 'admin-1' }, 'report-1', {
      status: ComplaintStatus.RESOLVED,
      action: ComplaintAction.WARNING,
      adminNote: '  Đã kiểm tra nội dung cuộc trò chuyện.  ',
      resolutionMessage: `  ${resolutionMessage}  `,
    });

    expect(tx.petReport.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report-1' },
      data: expect.objectContaining({
        status: ComplaintStatus.RESOLVED,
        actionTaken: ComplaintAction.WARNING,
        adminNote: 'Đã kiểm tra nội dung cuộc trò chuyện.',
        resolutionMessage,
        resolvedById: 'admin-1',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'ADMIN_RESOLVE_MATCHING_REPORT' }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reporter-1',
        content: resolutionMessage,
        targetUrl: '/notifications',
        entityId: 'report-1',
      }),
      tx,
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reported-1',
        title: 'Cảnh báo về hoạt động ghép đôi',
        content: expect.stringContaining('quấy rối người dùng khác'),
      }),
      tx,
    );
  });

  it('does not resolve the same report twice', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      status: ComplaintStatus.RESOLVED,
    });

    await expect(
      service.resolveMatchingReport({ id: 'admin-1' }, 'report-1', {
        status: ComplaintStatus.RESOLVED,
        action: ComplaintAction.WARNING,
        adminNote: 'Đã kiểm tra.',
        resolutionMessage: 'Đã có kết quả.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.petReport.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an action that does not match the reported target', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      targetType: 'PET',
    });

    await expect(
      service.resolveMatchingReport({ id: 'admin-1' }, 'report-1', {
        status: ComplaintStatus.RESOLVED,
        action: ComplaintAction.SUSPEND_ACCOUNT,
        adminNote: 'Đã kiểm tra.',
        resolutionMessage: 'Đã có kết quả.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.petReport.update).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('hides a reported pet and notifies its owner without exposing the reporter', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      targetType: 'PET',
    });

    await service.resolveMatchingReport({ id: 'admin-1' }, 'report-1', {
      status: ComplaintStatus.RESOLVED,
      action: ComplaintAction.HIDE_CONTENT,
      adminNote: 'Hồ sơ có thông tin vi phạm.',
      resolutionMessage: 'Phản ánh đã được xác minh.',
    });

    expect(tx.pet.update).toHaveBeenCalledWith({
      where: { id: 'pet-1' },
      data: { status: PetStatus.HIDDEN, isAvailableForMatching: false },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reported-1',
        content: expect.not.stringContaining('reporter-1'),
      }),
      tx,
    );
  });

  it('requests new pet documents, disables matching and removes old images', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      targetType: 'PET',
    });
    tx.petDocument.findMany.mockResolvedValue([
      { imageUrls: ['https://res.cloudinary.com/demo/image/upload/old.jpg'] },
    ]);

    await service.resolveMatchingReport({ id: 'admin-1', name: 'Admin' }, 'report-1', {
      status: ComplaintStatus.INSUFFICIENT_EVIDENCE,
      action: ComplaintAction.RESOLVE,
      adminNote: 'Cần xác minh lại giấy tờ.',
      resolutionMessage: 'Chủ sở hữu đã được yêu cầu tải lại giấy tờ.',
      documentTypes: [DocumentType.VACCINE_RECORD],
    });

    expect(tx.petDocument.deleteMany).toHaveBeenCalledWith({
      where: { petId: 'pet-1', type: { in: [DocumentType.VACCINE_RECORD] } },
    });
    expect(tx.petDocument.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        petId: 'pet-1',
        type: DocumentType.VACCINE_RECORD,
        imageUrls: [],
        status: DocumentStatus.NEED_MORE_INFO,
      })],
    });
    expect(tx.pet.update).toHaveBeenCalledWith({
      where: { id: 'pet-1' },
      data: expect.objectContaining({
        isAvailableForMatching: false,
        vaccineVerified: false,
      }),
    });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reported-1',
        targetUrl: '/my-pets?editPet=pet-1',
      }),
      tx,
    );
    expect(cloudinary.destroyByUrl).toHaveBeenCalledWith(
      'https://res.cloudinary.com/demo/image/upload/old.jpg',
    );
  });

  it('requires a document type when requesting pet document reupload', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      targetType: 'PET',
    });

    await expect(
      service.resolveMatchingReport({ id: 'admin-1' }, 'report-1', {
        status: ComplaintStatus.INSUFFICIENT_EVIDENCE,
        action: ComplaintAction.RESOLVE,
        adminNote: 'Cần xác minh lại giấy tờ.',
        resolutionMessage: 'Chủ sở hữu cần tải lại giấy tờ.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.petDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.petReport.update).not.toHaveBeenCalled();
  });

  it('warns a reporter when their activity reaches the yellow threshold', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      reporter: {
        role: 'USER',
        accountStatus: 'ACTIVE',
      },
    });
    tx.petReport.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3);

    await service.moderateMatchingReportReporter(
      { id: 'admin-1' },
      'report-1',
      { action: 'WARNING' },
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_WARN_REPORT_ABUSE',
          targetId: 'reporter-1',
        }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reporter-1',
        title: 'Cảnh báo về việc sử dụng tính năng phản ánh',
      }),
      tx,
    );
  });

  it('blocks a reporter when their activity reaches the red threshold', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      reporter: {
        role: 'USER',
        accountStatus: 'ACTIVE',
      },
    });
    tx.petReport.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);

    await service.moderateMatchingReportReporter(
      { id: 'admin-1' },
      'report-1',
      { action: 'BLOCK' },
    );

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'reporter-1' },
      data: { accountStatus: 'SUSPENDED' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_BLOCK_REPORT_ABUSE',
          metadata: expect.objectContaining({
            reason: 'Lạm dụng tính năng phản ánh',
          }),
        }),
      }),
    );
  });

  it('does not let admin punish a reporter below the spam threshold', async () => {
    tx.petReport.findUnique.mockResolvedValue({
      ...openReport(),
      reporter: {
        role: 'USER',
        accountStatus: 'ACTIVE',
      },
    });
    tx.petReport.count.mockResolvedValue(0);

    await expect(
      service.moderateMatchingReportReporter(
        { id: 'admin-1' },
        'report-1',
        { action: 'WARNING' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('AdminService pet document review', () => {
  let prisma: any;
  let service: AdminService;
  const notifications = { create: jest.fn() };
  const cloudinary = { destroyByUrl: jest.fn() };

  beforeEach(() => {
    prisma = {
      petDocument: {
        update: jest.fn().mockResolvedValue({
          id: 'document-1',
          petId: 'pet-1',
          pet: { id: 'pet-1', name: 'Milo', ownerId: 'owner-1' },
        }),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'document-1' }),
      },
      pet: { update: jest.fn().mockResolvedValue({ id: 'pet-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    notifications.create.mockReset().mockResolvedValue({ id: 'notification-1' });
    service = new AdminService(prisma as PrismaService, notifications as any, cloudinary as any);
  });

  it.each([DocumentStatus.REJECTED, DocumentStatus.NEED_MORE_INFO])(
    'requires a meaningful review note for %s',
    async (status) => {
      await expect(
        service.reviewPetDocument(
          { id: 'admin-1', name: 'Admin' },
          'document-1',
          { status, reviewNote: '   ' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.petDocument.update).not.toHaveBeenCalled();
    },
  );

  it('trims and persists the rejection reason', async () => {
    await service.reviewPetDocument(
      { id: 'admin-1', name: 'Admin' },
      'document-1',
      { status: DocumentStatus.REJECTED, reviewNote: '  Ảnh giấy tờ bị mờ.  ' },
    );

    expect(prisma.petDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'document-1' },
      data: expect.objectContaining({
        status: DocumentStatus.REJECTED,
        reviewNote: 'Ảnh giấy tờ bị mờ.',
        reviewerId: 'admin-1',
      }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'ADMIN_REVIEW_PET_DOCUMENT',
        metadata: expect.objectContaining({ reviewNote: 'Ảnh giấy tờ bị mờ.' }),
      }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner-1', entityId: 'document-1' }),
    );
  });

  it('allows approval without a review note', async () => {
    await expect(
      service.reviewPetDocument(
        { id: 'admin-1', name: 'Admin' },
        'document-1',
        { status: DocumentStatus.APPROVED },
      ),
    ).resolves.toEqual({ id: 'document-1' });
  });
});

describe('AdminService complaints', () => {
  it('notifies only the complaint reporter', async () => {
    const complaint = {
      id: 'complaint-1',
      reporterId: 'reporter-1',
      targetId: 'reported-1',
    };
    const tx = {
      complaint: { update: jest.fn().mockResolvedValue(complaint) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'reporter-1' }) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const notifications = { create: jest.fn().mockResolvedValue({}) };
    const service = new AdminService(
      prisma as unknown as PrismaService,
      notifications as any,
      { destroyByUrl: jest.fn() } as any,
    );

    await service.resolveComplaint(
      { id: 'admin-1' },
      complaint.id,
      { action: ComplaintAction.DISMISS },
    );

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reporter-1' }),
      tx,
    );
    expect(notifications.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reported-1' }),
      expect.anything(),
    );
  });
});
