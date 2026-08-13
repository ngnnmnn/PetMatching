import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService matching reports', () => {
  let prisma: any;
  let tx: any;
  let service: AdminService;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      petReport: {
        findUnique: jest.fn().mockResolvedValue({ id: 'report-1', isResolved: false }),
        update: jest.fn().mockResolvedValue({ id: 'report-1', isResolved: true }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    prisma = {
      petReport: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((callback: (client: any) => unknown) => callback(tx)),
    };
    service = new AdminService(prisma as PrismaService);
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

  beforeEach(() => {
    prisma = {
      petDocument: {
        update: jest.fn().mockResolvedValue({ id: 'document-1', petId: 'pet-1' }),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ id: 'document-1' }),
      },
      pet: { update: jest.fn().mockResolvedValue({ id: 'pet-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    service = new AdminService(prisma as PrismaService);
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
