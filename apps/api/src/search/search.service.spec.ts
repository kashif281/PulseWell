import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.module';
import type { JwtPayload } from '@pulseai/types';

describe('SearchService privacy', () => {
  const prisma = {
    employee: { findMany: jest.fn() },
    department: { findMany: jest.fn() },
  };

  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(prisma as unknown as PrismaService);
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.department.findMany.mockResolvedValue([{ id: 'd1' }]);
  });

  it('never returns documents or chats to employees', async () => {
    const result = await service.search(
      { sub: 'u1', email: 'u1@example.com', role: 'EMPLOYEE', companyId: 'c1' } as JwtPayload,
      'jane',
    );

    expect(result.documents).toEqual([]);
    expect(result.chats).toEqual([]);
  });

  it('does not return document metadata or chat content for admins', async () => {
    const result = await service.search(
      {
        sub: 'admin',
        email: 'admin@example.com',
        role: 'COMPANY_ADMIN',
        companyId: 'c1',
      } as JwtPayload,
      'labs',
    );

    expect(result.documents).toEqual([]);
    expect(result.chats).toEqual([]);
  });
});
