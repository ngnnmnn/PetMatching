import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ComplaintAction, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService matching reports', () => {
  let prisma: any;
  let tx: any;
  let service: AdminService;
  const notifications = { create: jest.fn() };

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      petReport: {
        findUnique: jest.fn().mockResolvedValue({ id: 'report-1', userId: 'reporter-1', reportedUserId: 'reported-1', isResolved: false }),
        update: jest.fn().mockResolvedValue({ id: 'report-1', isResolved: true }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    prisma = {
      petReport: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((callback: (client: any) => unknown) => callback(tx)),
    };
    notifications.create.mockReset().mockResolvedValue({ id: 'notification-1' });
    service = new AdminService(prisma as PrismaService, notifications as any);
  });

  it('returns report context with messages ordered from oldest to newest', async () => {
    const newer = { id: 'message-2', createdAt: new Date('2026-08-08T02:00:00Z') };
    const older = { id: 'message-1', createdAt: new Date('2026-08-08T01:00:00Z') };
    prisma.petReport.findUnique.mockResolvedValue({
      id: 'report-1',
      match: { messages: [newer, older] },
    });

    const report = await service.getMatchingReport('report-1');

    expect(report.match?.messages).toEqual([older, newer]);
    expect(prisma.petReport.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report-1' },
      include: expect.any(Object),
    }));
  });

  it('rejects a missing report', async () => {
    prisma.petReport.findUnique.mockResolvedValue(null);
    await expect(service.getMatchingReport('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves and audits a report in one transaction', async () => {
    await service.resolveMatchingReport({ id: 'admin-1' }, 'report-1');

    expect(tx.petReport.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'report-1' },
      data: expect.objectContaining({ isResolved: true, resolvedById: 'admin-1' }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'ADMIN_RESOLVE_MATCHING_REPORT' }),
    }));
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reporter-1' }),
      tx,
    );
    expect(notifications.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'reported-1' }),
      expect.anything(),
    );
  });

  it('does not resolve the same report twice', async () => {
    tx.petReport.findUnique.mockResolvedValue({ id: 'report-1', isResolved: true });

    await expect(
      service.resolveMatchingReport({ id: 'admin-1' }, 'report-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.petReport.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('AdminService pet document review', () => {
  let prisma: any;
  let service: AdminService;
  const notifications = { create: jest.fn() };

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
    service = new AdminService(prisma as PrismaService, notifications as any);
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
    const service = new AdminService(prisma as unknown as PrismaService, notifications as any);

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
