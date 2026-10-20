import { ForbiddenException } from '@nestjs/common';
import { tool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { LeavesService } from 'src/modules/leaves/leaves.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { LeaveStatus, LeaveType, Role } from 'generated/prisma/enums';
import type { CreateLeaveDto } from 'src/modules/leaves/dto/create-leave.dto';
import { ProposeAssistantAction } from '../assistant-action.types';

const requestFilters = z.object({
  year: z.number().int().min(2000).max(2100).optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
  type: z.nativeEnum(LeaveType).optional(),
});

export function createLeaveTools(
  leaveService: LeavesService,
  prisma: PrismaService,
  userId: string,
  role: Role,
  isLeader: boolean,
  threadId: string,
  proposeAction: ProposeAssistantAction,
) {
  const assertTeamAccess = async () => {
    if (role === Role.ADMIN || role === Role.LEADER || isLeader) return;
    const permission = await prisma.modulePermission.findFirst({
      where: { userId, module: 'LEAVES', canAccess: true },
      select: { modulePermissionId: true },
    });
    if (!permission) {
      throw new ForbiddenException('No tienes permiso para consultar el módulo de ausencias.');
    }
  };

  const getMyBalance = tool(async () => leaveService.getMyBalance(userId), {
    name: 'get_my_leave_balance',
    description: 'Consulta el saldo de vacaciones del usuario autenticado.',
    schema: z.object({}),
  });

  const getMyRequests = tool(
    async ({ year, status, type }) => {
      const requests = await leaveService.findMyRequests(userId, {
        year: year?.toString(),
        status,
        type,
      });
      return requests.map((r) => ({
        id: r.leaveRequestId,
        startDate: r.startDate,
        endDate: r.endDate,
        businessDays: r.businessDays,
        status: r.status,
        type: r.type,
        reason: r.reason,
        esCompensada: r.esCompensada,
      }));
    },
    {
      name: 'get_my_leave_requests',
      description: 'Consulta las solicitudes propias, con filtros opcionales.',
      schema: requestFilters,
    },
  );

  const createLeaveRequest = tool(
    async (input) => {
      const isCompensatedVacation =
        input.type === LeaveType.VACACIONES && input.esCompensada === true;
      if (input.esCompensada && input.type !== LeaveType.VACACIONES) {
        throw new Error('Solo las vacaciones pueden ser compensadas.');
      }
      if (isCompensatedVacation && !input.compensatedDays) {
        throw new Error('Indica cuántos días deseas compensar antes de continuar.');
      }
      if (
        !isCompensatedVacation &&
        (!input.startDate || !input.endDate ||
          !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))
      ) {
        throw new Error('Indica las fechas de inicio y fin en formato YYYY-MM-DD.');
      }
      const dates = isCompensatedVacation
        ? `${input.compensatedDays} día(s) compensados`
        : `${input.startDate} al ${input.endDate}`;
      const action = await proposeAction(
        userId,
        threadId,
        { kind: 'CREATE_LEAVE', input: input as CreateLeaveDto },
        `Crear solicitud de ${input.type} para ${dates}. Motivo: ${input.reason}`,
      );
      return {
        requiresConfirmation: true,
        actionId: action.actionId,
        summary: action.summary,
        expiresAt: new Date(action.expiresAt).toISOString(),
      };
    },
    {
      name: 'create_leave_request',
      description: 'Prepara una solicitud propia. No la crea hasta que el usuario confirme el actionId en la ruta de confirmación.',
      schema: z.object({
        type: z.nativeEnum(LeaveType),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        reason: z.string().min(1).max(500),
        esCompensada: z.boolean().optional(),
        compensatedDays: z.number().int().min(1).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
      }),
    },
  );

  const cancelLeaveRequest = tool(
    async ({ requestId }) => {
      const request = await leaveService.findOne(requestId, userId);
      if (request.userId !== userId || request.status !== LeaveStatus.PENDING) {
        throw new ForbiddenException('Solo puedes cancelar tus propias solicitudes pendientes.');
      }
      const action = await proposeAction(
        userId,
        threadId,
        { kind: 'CANCEL_LEAVE', requestId },
        `Cancelar solicitud ${requestId} (${request.type}, ${request.startDate.toISOString().slice(0, 10)} al ${request.endDate.toISOString().slice(0, 10)}).`,
      );
      return { requiresConfirmation: true, actionId: action.actionId, summary: action.summary };
    },
    {
      name: 'cancel_leave_request',
      description: 'Prepara la cancelación de una solicitud propia pendiente; requiere confirmación explícita.',
      schema: z.object({ requestId: z.string().min(1) }),
    },
  );

  const reviewLeaveRequest = (status: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>) => tool(
    async ({ requestId, comment }) => {
      const request = await prisma.leaveRequest.findUnique({ where: { leaveRequestId: requestId } });
      if (!request) throw new Error('Solicitud no encontrada.');
      if (role !== Role.ADMIN && request.leaderId !== userId) {
        throw new ForbiddenException('Solo el líder asignado o ADMIN puede revisar esta solicitud.');
      }
      await assertTeamAccess();
      if (request.status !== LeaveStatus.PENDING) {
        throw new ForbiddenException('La solicitud ya no está pendiente.');
      }
      const action = await proposeAction(
        userId,
        threadId,
        { kind: 'REVIEW_LEAVE', requestId, status, comment },
        `${status === LeaveStatus.APPROVED ? 'Aprobar' : 'Rechazar'} solicitud ${requestId} de ${request.type} (${request.startDate.toISOString().slice(0, 10)} al ${request.endDate.toISOString().slice(0, 10)}).${comment ? ` Comentario: ${comment}` : ''}`,
      );
      return { requiresConfirmation: true, actionId: action.actionId, summary: action.summary };
    },
    {
      name: status === LeaveStatus.APPROVED ? 'approve_leave_request' : 'reject_leave_request',
      description: `Prepara la revisión de una solicitud pendiente con estado ${status}; requiere confirmación explícita.`,
      schema: z.object({ requestId: z.string().min(1), comment: z.string().max(500).optional() }),
    },
  );

  const getTeam = tool(
    async () => {
      await assertTeamAccess();
      const members = await prisma.user.findMany({
        where: { leaderId: userId, status: 'ACTIVE' },
        select: { userId: true, name: true, position: true, department: true },
        orderBy: { name: 'asc' },
      });
      return members;
    },
    {
      name: 'get_my_team',
      description:
        'Lista los colaboradores asignados directamente al líder autenticado.',
      schema: z.object({}),
    },
  );

  const getTeamRequests = tool(
    async ({ year, status, type }) => {
      await assertTeamAccess();
      const requests = await leaveService.findTeamRequests(userId, {
        year: year?.toString(),
        status,
        type,
      });
      return requests.map((r) => ({
        id: r.leaveRequestId,
        employeeName: r.user?.name,
        employeeId: r.userId,
        startDate: r.startDate,
        endDate: r.endDate,
        businessDays: r.businessDays,
        status: r.status,
        type: r.type,
      }));
    },
    {
      name: 'get_team_leave_requests',
      description: 'Consulta solicitudes asociadas al líder autenticado.',
      schema: requestFilters,
    },
  );

  const getTeamAbsences = tool(
    async ({ from, to }) => {
      await assertTeamAccess();
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T23:59:59.999`);
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end < start
      ) {
        throw new Error('El rango de fechas no es válido.');
      }
      const rows = await prisma.leaveRequest.findMany({
        where: {
          leaderId: userId,
          status: LeaveStatus.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          leaveRequestId: true,
          user: { select: { name: true } },
          startDate: true,
          endDate: true,
          type: true,
        },
        orderBy: { startDate: 'asc' },
      });
      return rows;
    },
    {
      name: 'get_team_absences',
      description:
        'Consulta ausencias aprobadas del equipo en un rango de fechas.',
      schema: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
  );

  const getTeamBalances = tool(
    async () => {
      await assertTeamAccess();
      const members = await prisma.user.findMany({
        where: { leaderId: userId, status: 'ACTIVE' },
        select: {
          userId: true,
          name: true,
          startDate: true,
          vacationDaysAdjustment: true,
        },
        orderBy: { name: 'asc' },
      });
      return Promise.all(
        members.map(async (member) => ({
          employeeName: member.name,
          balance: await leaveService.getMyBalance(member.userId),
        })),
      );
    },
    {
      name: 'get_team_leave_balances',
      description:
        'Consulta los saldos de vacaciones de colaboradores asignados directamente al líder.',
      schema: z.object({}),
    },
  );

  const getTeamStatistics = tool(
    async ({ year }) => {
      await assertTeamAccess();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      const [members, grouped] = await Promise.all([
        prisma.user.count({ where: { leaderId: userId, status: 'ACTIVE' } }),
        prisma.leaveRequest.groupBy({
          by: ['status'],
          where: {
            leaderId: userId,
            startDate: { gte: yearStart, lt: yearEnd },
          },
          _count: { _all: true },
          _sum: { businessDays: true },
        }),
      ]);
      return {
        year,
        teamSize: members,
        requestsByStatus: grouped.map((row) => ({
          status: row.status,
          requests: row._count._all,
          businessDays: row._sum.businessDays ?? 0,
        })),
      };
    },
    {
      name: 'get_team_leave_statistics',
      description:
        'Resume cantidad de solicitudes y días por estado para el equipo del líder.',
      schema: z.object({ year: z.number().int().min(2000).max(2100) }),
    },
  );

  const tools: StructuredToolInterface[] = [
    getMyBalance,
    getMyRequests,
    createLeaveRequest,
    cancelLeaveRequest,
  ];

  if (
    role === Role.LEADER ||
    role === Role.MANAGER ||
    role === Role.ADMIN ||
    isLeader
  ) {
    tools.push(
      getTeam,
      getTeamRequests,
      getTeamAbsences,
      getTeamBalances,
      getTeamStatistics,
    );
  }
  if (role === Role.LEADER || role === Role.ADMIN || isLeader) {
    tools.push(
      reviewLeaveRequest(LeaveStatus.APPROVED),
      reviewLeaveRequest(LeaveStatus.REJECTED),
    );
  }
  return tools;
}
