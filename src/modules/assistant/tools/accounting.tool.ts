import { ForbiddenException } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { NominaService } from 'src/modules/nomina/nomina.service';
import { colombianHolidays } from 'src/modules/leaves/helpers/business-days.helper';
import { Role } from 'generated/prisma/enums';

const periodSchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function createAccountingTools(
  prisma: PrismaService,
  nominaService: NominaService,
  userId: string,
  role: Role,
) {
  if (role !== Role.ADMIN && role !== Role.ACCOUNTING) return [];

  const assertPayrollAccess = async () => {
    if (role === Role.ADMIN) return;
    const permission = await prisma.modulePermission.findFirst({
      where: { userId, module: 'NOMINA', canAccess: true },
      select: { modulePermissionId: true },
    });
    if (!permission) {
      throw new ForbiddenException('No tienes permiso para consultar información de nómina.');
    }
  };

  const getPayrollPeriodSummary = tool(
    async ({ desde, hasta }) => {
      await assertPayrollAccess();
      if (desde > hasta) throw new Error('La fecha inicial debe ser anterior a la fecha final.');

      return {
        desde,
        hasta,
        ...await nominaService.totalesPeriodo({ desde, hasta }),
        note: 'Son totales de novedades registradas; no representan un cálculo monetario de nómina.',
      };
    },
    {
      name: 'get_accounting_payroll_period_summary',
      description: 'Consulta totales agregados de novedades de nómina en un período, sin nombres ni salarios. Requiere fechas completas.',
      schema: periodSchema,
    },
  );

  const getApprovedOvertimeDayBreakdown = tool(
    async ({ desde, hasta }) => {
      await assertPayrollAccess();
      if (desde > hasta) throw new Error('La fecha inicial debe ser anterior a la fecha final.');

      const rows = await prisma.overtimeRequest.findMany({
        where: {
          status: 'APPROVED',
          date: {
            gte: new Date(`${desde}T00:00:00-05:00`),
            lte: new Date(`${hasta}T23:59:59.999-05:00`),
          },
          user: { status: 'ACTIVE', isUserTest: false },
        },
        select: { date: true, totalHours: true },
      });

      const buckets = {
        ordinaryDate: { requests: 0, hours: 0 },
        sunday: { requests: 0, hours: 0 },
        colombianHoliday: { requests: 0, hours: 0 },
        sundayAndHoliday: { requests: 0, hours: 0 },
      };
      const holidaysByYear = new Map<number, Set<string>>();
      for (const row of rows) {
        const dateKey = row.date.toISOString().slice(0, 10);
        const [year, month, day] = dateKey.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        let holidays = holidaysByYear.get(year);
        if (!holidays) {
          holidays = colombianHolidays(year);
          holidaysByYear.set(year, holidays);
        }
        const sunday = localDate.getDay() === 0;
        const holiday = holidays.has(dateKey);
        const bucket = sunday && holiday
          ? buckets.sundayAndHoliday
          : sunday
            ? buckets.sunday
            : holiday
              ? buckets.colombianHoliday
              : buckets.ordinaryDate;
        bucket.requests += 1;
        bucket.hours = Math.round((bucket.hours + row.totalHours) * 100) / 100;
      }

      return {
        desde,
        hasta,
        approvedRequests: rows.length,
        approvedHours: Math.round(rows.reduce((sum, row) => sum + row.totalHours, 0) * 100) / 100,
        byRequestDate: buckets,
        note: 'Clasificación por fecha registrada de la solicitud. No identifica jornada ordinaria, horas nocturnas ni calcula recargos o valores monetarios. Las solicitudes que cruzan medianoche requieren revisión.',
      };
    },
    {
      name: 'get_approved_overtime_day_breakdown',
      description: 'Resume horas extra aprobadas por fecha ordinaria, domingo o festivo colombiano. No calcula dinero ni recargos.',
      schema: periodSchema,
    },
  );

  return [getPayrollPeriodSummary, getApprovedOvertimeDayBreakdown];
}
