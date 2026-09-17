import * as XLSX from 'xlsx';
import { buildAdminReportExcel } from './admin-report.excel';

function cellValue(worksheet: XLSX.WorkSheet, address: string) {
  return (worksheet[address] as XLSX.CellObject | undefined)?.v;
}

describe('admin Excel report', () => {
  it('exports revenue, users and pets with typed values and filters', () => {
    const generatedAt = new Date('2026-09-17T03:30:00.000Z');
    const buffer = buildAdminReportExcel({
      generatedAt,
      range: {
        label: '30 ngày gần nhất',
        from: '2026-08-19T00:00:00.000Z',
        to: '2026-09-17T23:59:59.999Z',
      },
      revenue: {
        store: 1_500_000,
        spa: 500_000,
        total: 2_000_000,
        previousTotal: 1_000_000,
        changePercent: 100,
      },
      revenueSeries: [
        {
          label: '17/09',
          storeRevenue: 1_500_000,
          spaRevenue: 500_000,
          totalRevenue: 2_000_000,
          transactions: 3,
        },
      ],
      users: [
        {
          id: 'user-1',
          name: 'Nguyễn Văn A',
          email: 'a@example.com',
          phone: '0900000000',
          role: 'USER',
          accountStatus: 'ACTIVE',
          isVerified: true,
          createdAt: generatedAt,
          _count: { pets: 1, orders: 2 },
        },
      ],
      pets: [
        {
          id: 'pet-1',
          name: 'Milo',
          species: 'DOG',
          breed: 'Poodle',
          gender: 'MALE',
          birthday: new Date('2024-01-01T00:00:00.000Z'),
          weight: 4.5,
          status: 'ACTIVE',
          verificationBadge: 'VERIFIED',
          createdAt: generatedAt,
          owner: {
            name: 'Nguyễn Văn A',
            email: 'a@example.com',
            accountStatus: 'ACTIVE',
          },
          _count: {
            documents: 2,
            sentMatchingRequests: 3,
            receivedMatchingRequests: 4,
          },
        },
      ],
    });

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellStyles: true,
    });

    expect(workbook.SheetNames).toEqual([
      'Tổng quan doanh thu',
      'Người dùng',
      'Thú cưng',
    ]);

    const revenue = workbook.Sheets['Tổng quan doanh thu'];
    expect(cellValue(revenue, 'A1')).toBe('BÁO CÁO DOANH THU PETMATCHING');
    expect(cellValue(revenue, 'B7')).toBe(1_500_000);
    expect(cellValue(revenue, 'B11')).toBe(1);
    expect(revenue['!autofilter']).toEqual({ ref: 'A14:E15' });

    const users = workbook.Sheets['Người dùng'];
    expect(cellValue(users, 'B5')).toBe('user-1');
    expect(cellValue(users, 'C5')).toBe('Nguyễn Văn A');
    expect(cellValue(users, 'F5')).toBe('Người dùng');
    expect(cellValue(users, 'K5')).toBeInstanceOf(Date);
    expect(users['!autofilter']).toEqual({ ref: 'A4:K5' });

    const pets = workbook.Sheets['Thú cưng'];
    expect(cellValue(pets, 'D5')).toBe('Chó');
    expect(cellValue(pets, 'F5')).toBe('Đực');
    expect(cellValue(pets, 'H5')).toBe(4.5);
    expect(cellValue(pets, 'M5')).toBe('Đã xác minh');
    expect(pets['!autofilter']).toEqual({ ref: 'A4:Q5' });
  });
});
