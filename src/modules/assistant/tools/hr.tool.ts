import { ForbiddenException } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { Role } from 'generated/prisma/enums';

/** HR reporting tools return aggregate values only; no employee identifiers or PII. */
export function createHRTools(prisma: PrismaService, userId: string, role: Role) {
  if (role !== Role.ADMIN && role !== Role.RRHH) return [];

  const assertHRAccess = async (module: 'USERS_ADMIN' | 'LEAVES') => {
    if (role === Role.ADMIN) return;
    if (role !== Role.RRHH) {
      throw new ForbiddenException('Esta consulta está disponible solo para RRHH.');
    }

    const permission = await prisma.modulePermission.findFirst({
      where: { userId, module, canAccess: true },
      select: { modulePermissionId: true },
    });
    if (!permission) {
      throw new ForbiddenException('No tienes permiso para consultar este reporte.');
    }
  };

  const employeeAnalytics = tool(
    async () => {
      // User-scoped permission is checked by the wrapper factory below.
      await assertHRAccess('USERS_ADMIN');
      const [total, grouped] = await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE', isUserTest: false } }),
        prisma.user.groupBy({
          by: ['department', 'area'],
          where: { status: 'ACTIVE', isUserTest: false },
          _count: { _all: true },
          orderBy: [{ department: 'asc' }, { area: 'asc' }],
        }),
      ]);
      return {
        activeEmployees: total,
        byDepartmentAndArea: grouped.map((row) => ({
          department: row.department ?? 'Sin departamento',
          area: row.area ?? 'Sin área',
          employees: row._count._all,
        })),
      };
    },
    {
      name: 'get_hr_employee_analytics',
      description: 'Devuelve el total de colaboradores activos y su distribución agregada por departamento y área, sin datos personales.',
      schema: z.object({}),
    },
  );

  const absenceAnalytics = tool(
    async ({ year }) => {
      await assertHRAccess('LEAVES');
      const grouped = await prisma.leaveRequest.groupBy({
        by: ['type', 'status'],
        where: {
          startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          user: { status: 'ACTIVE', isUserTest: false },
        },
        _count: { _all: true },
        _sum: { businessDays: true },
        orderBy: [{ type: 'asc' }, { status: 'asc' }],
      });
      return {
        year,
        byTypeAndStatus: grouped.map((row) => ({
          type: row.type,
          status: row.status,
          requests: row._count._all,
          businessDays: row._sum.businessDays ?? 0,
        })),
      };
    },
    {
      name: 'get_hr_absence_analytics',
      description: 'Resume solicitudes de ausencia y días hábiles por tipo y estado para un año; no muestra quién las solicitó ni el motivo.',
      schema: z.object({ year: z.number().int().min(2000).max(2100) }),
    },
  );

  const vacationAnalytics = tool(
    async ({ year }) => {
      await assertHRAccess('LEAVES');
      const grouped = await prisma.leaveRequest.groupBy({
        by: ['status', 'esCompensada'],
        where: {
          type: 'VACACIONES',
          startDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          user: { status: 'ACTIVE', isUserTest: false },
        },
        _count: { _all: true },
        _sum: { businessDays: true },
        orderBy: [{ status: 'asc' }, { esCompensada: 'asc' }],
      });
      return {
        year,
        byStatusAndCompensation: grouped.map((row) => ({
          status: row.status,
          compensated: row.esCompensada,
          requests: row._count._all,
          businessDays: row._sum.businessDays ?? 0,
        })),
      };
    },
    {
      name: 'get_hr_vacation_analytics',
      description: 'Resume solicitudes de vacaciones y días hábiles por estado y si fueron compensadas, sin datos individuales.',
      schema: z.object({ year: z.number().int().min(2000).max(2100) }),
    },
  );

  return [employeeAnalytics, absenceAnalytics, vacationAnalytics];
}
