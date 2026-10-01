import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { LeavesService } from '../../leaves/leaves.service';

export function createLeaveTools(leaveService: LeavesService, userId: string) {
  const getMyLeaveRequests = tool(
    async ({
      year,
      status,
      type,
    }: {
      year: number | undefined;
      status;
      type;
    }) => {
      const requests = await leaveService.findMyRequests(userId, {
        year: year?.toString(),
        status,
        type,
      });

      return requests.map((request) => ({
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status,
        type: request.type,
      }));
    },
    {
      name: 'get_my_leave_requests',

      description:
        'Obtiene las solicitudes de vacaciones del usuario autenticado. ' +
        'Úsala cuando el usuario pregunte por sus solicitudes de vacaciones, ' +
        'vacaciones pendientes, aprobadas o rechazadas.',

      schema: z.object({
        year: z.number().optional().describe('Año que se desea consultar'),

        status: z.string().optional().describe('Estado de la solicitud'),

        type: z.string().optional().describe('Tipo de solicitud'),
      }),
    },
  );

  return [getMyLeaveRequests];
}
