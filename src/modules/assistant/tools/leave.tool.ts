import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { LeavesService } from 'src/modules/leaves/leaves.service';
import { LeaveStatus, LeaveType } from 'generated/prisma/enums';

export function createLeaveTools(
  leaveService: LeavesService,
  userId: string,
  isLeader: boolean,
) {
  // CONSULTAS PROPIAS
  const getMyBalance = tool(
    async () => {
      return leaveService.getMyBalance(userId);
    },
    {
      name: 'get_my_vacation_balance',
      description:
        'Obtiene el saldo actual de vacaciones del usuario: días acumulados (accrued), tomados (taken), pendientes (pending), disponibles (available) y proyectados (projectedAvailable).',
      schema: z.object({}),
    },
  );

  const explainMyBalance = tool(
    async () => {
      const balance = await leaveService.getMyBalance(userId);

      return {
        ...balance,
        explanationHint:
          'El saldo se calcula así: días acumulados (proporcional a los días trabajados desde la fecha de ingreso) - días ya tomados (aprobados). ' +
          'El saldo proyectado resta además las solicitudes pendientes.',
      };
    },
    {
      name: 'explain_my_vacation_balance',
      description:
        'Devuelve el saldo de vacaciones junto con la lógica de cálculo para que puedas explicarle al usuario por qué tiene ese saldo.',
      schema: z.object({}),
    },
  );

  const getMyRequests = tool(
    async ({
      year,
      status,
      type,
    }: {
      year?: number;
      status?: LeaveStatus;
      type?: LeaveType;
    }) => {
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
      description:
        'Obtiene las solicitudes de vacaciones/permisos del usuario autenticado. Filtra por año, estado o tipo.',
      schema: z.object({
        year: z.number().optional().describe('Año a consultar (ej: 2025)'),
        status: z
          .enum([
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED',
            'PENDING_HR_VALIDATION',
          ])
          .optional()
          .describe('Estado de la solicitud'),
        type: z
          .enum(['VACACIONES', 'PERMISO', 'ENFERMEDAD', 'OTRO']) // ajusta a tus LeaveType
          .optional()
          .describe('Tipo de solicitud'),
      }),
    },
  );

  const getRequestStatus = tool(
    async ({ requestId }: { requestId: string }) => {
      const request = await leaveService.findOne(requestId, userId);
      return {
        id: request.leaveRequestId,
        startDate: request.startDate,
        endDate: request.endDate,
        businessDays: request.businessDays,
        status: request.status,
        type: request.type,
        reason: request.reason,
        esCompensada: request.esCompensada,
        leader: request.leader?.name,
      };
    },
    {
      name: 'get_request_status',
      description:
        'Consulta el detalle y estado de una solicitud específica por su ID.',
      schema: z.object({
        requestId: z.string().describe('ID de la solicitud (leaveRequestId)'),
      }),
    },
  );

  // Estimación de cuándo podría tomar vacaciones
  const estimateWhenICanTakeVacation = tool(
    async ({ desiredDays }: { desiredDays: number }) => {
      const balance = await leaveService.getMyBalance(userId);

      const available = balance.projectedAvailable ?? balance.available;

      if (available >= desiredDays) {
        return {
          canTakeNow: true,
          available,
          message: `Tienes ${available} días disponibles. Puedes solicitar ${desiredDays} días ahora mismo.`,
        };
      }

      // Estimación muy simple: asumimos ~1.25 días hábiles por mes (15/12)
      const daysNeeded = desiredDays - available;
      const monthsNeeded = Math.ceil(daysNeeded / 1.25);

      return {
        canTakeNow: false,
        available,
        daysNeeded,
        estimatedMonths: monthsNeeded,
        message:
          `Actualmente tienes ${available} días. Te faltan aproximadamente ${daysNeeded} días. ` +
          `Si no tomas más vacaciones, podrías acumularlos en unos ${monthsNeeded} meses.`,
      };
    },
    {
      name: 'estimate_when_i_can_take_vacation',
      description:
        'Estima aproximadamente cuándo el usuario podría tomar cierta cantidad de días de vacaciones según su saldo actual y la acumulación mensual.',
      schema: z.object({
        desiredDays: z
          .number()
          .min(1)
          .describe('Cantidad de días que el usuario quiere tomar'),
      }),
    },
  );

  // Crear y cancelar

  const createVacationRequest = tool(
    async (input: {
      startDate: string;
      endDate: string;
      type?: string;
      reason?: string;
      esCompensada?: boolean;
      compensatedDays?: number;
      leaderId?: string;
    }) => {
      try {
        const leave = await leaveService.create(userId, {
          startDate: input.startDate,
          endDate: input.endDate,
          type: (input.type as any) ?? 'VACACIONES',
          reason: input.reason ?? '',
          esCompensada: input.esCompensada ?? false,
          compensatedDays: input.compensatedDays,
          leaderId: input.leaderId,
        });

        return {
          success: true,
          requestId: leave.leaveRequestId,
          status: leave.status,
          businessDays: leave.businessDays,
          message: `Solicitud creada correctamente (${leave.businessDays} días hábiles). Estado: ${leave.status}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'Error al crear la solicitud',
        };
      }
    },
    {
      name: 'create_vacation_request',
      description:
        'Crea una solicitud de vacaciones o permiso. ' +
        'Requiere startDate y endDate en formato YYYY-MM-DD. ' +
        'Para vacaciones compensadas usa esCompensada=true y compensatedDays.',
      schema: z.object({
        startDate: z.string().describe('Fecha inicio YYYY-MM-DD'),
        endDate: z.string().describe('Fecha fin YYYY-MM-DD'),
        type: z
          .enum(['VACACIONES', 'PERMISO', 'ENFERMEDAD', 'OTRO'])
          .optional()
          .describe('Tipo de solicitud (por defecto VACACIONES)'),
        reason: z.string().optional().describe('Motivo'),
        esCompensada: z
          .boolean()
          .optional()
          .describe('Si es vacación compensada'),
        compensatedDays: z
          .number()
          .optional()
          .describe('Días a compensar (solo si esCompensada=true)'),
        leaderId: z
          .string()
          .optional()
          .describe('ID del líder (opcional, se toma el asignado por defecto)'),
      }),
    },
  );

  const cancelVacationRequest = tool(
    async ({ requestId }: { requestId: string }) => {
      try {
        const result = await leaveService.cancel(requestId, userId);
        return {
          success: true,
          requestId: result.leaveRequestId,
          status: result.status,
          message: 'Solicitud cancelada correctamente',
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || 'No se pudo cancelar la solicitud',
        };
      }
    },
    {
      name: 'cancel_vacation_request',
      description:
        'Cancela una solicitud propia que esté en estado PENDING. Solo se pueden cancelar solicitudes pendientes.',
      schema: z.object({
        requestId: z.string().describe('ID de la solicitud a cancelar'),
      }),
    },
  );

  // Tools exclusivas de líder
  const getTeamRequests = tool(
    async ({
      year,
      status,
      employeeId,
    }: {
      year?: number;
      status?: LeaveStatus;
      employeeId?: string;
    }) => {
      if (!isLeader) {
        return {
          error: 'No tienes permisos de líder para consultar el equipo.',
        };
      }

      const requests = await leaveService.findTeamRequests(userId, {
        year: year?.toString(),
        status,
        employeeId,
      });

      return requests.map((r) => ({
        id: r.leaveRequestId ?? r.userId,
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
      description:
        'SOLO líderes. Obtiene las solicitudes de vacaciones del equipo. Útil para ver quién está de vacaciones, solapamientos, solicitudes pendientes del equipo, etc.',
      schema: z.object({
        year: z.number().optional().describe('Año'),
        status: z
          .enum([
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED',
            'PENDING_HR_VALIDATION',
          ])
          .optional(),
        employeeId: z
          .string()
          .optional()
          .describe('Filtrar por un empleado específico'),
      }),
    },
  );

  const tools: any[] = [
    getMyBalance,
    explainMyBalance,
    getMyRequests,
    getRequestStatus,
    estimateWhenICanTakeVacation,
    createVacationRequest,
    cancelVacationRequest,
  ];

  if (isLeader) {
    tools.push(getTeamRequests);
  }

  return tools;
}
