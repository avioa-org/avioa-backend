import { LeaveRequest } from 'generated/prisma/browser';

export function renderAccountantCompensatedApprovedEmail({
  leave,
}: {
  leave: LeaveRequest & {
    user?: { name: string };
    leader?: { name: string };
  };
}) {
  const approvedAt = leave.reviewedAt?.toLocaleDateString('es-CO') ?? '—';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Vacaciones compensadas aprobadas</h2>
      <p>Se ha aprobado una solicitud de vacaciones compensadas que requiere procesamiento en nómina.</p>

      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Colaborador</strong></td><td style="padding:8px;">${leave.user?.name ?? '—'}</td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Líder aprobador</strong></td><td style="padding:8px;">${leave.leader?.name ?? '—'}</td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Días compensados</strong></td><td style="padding:8px;"><strong>${leave.businessDays}</strong></td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Aprobado el</strong></td><td style="padding:8px;">${approvedAt}</td></tr>
      </table>

      <p style="color:#64748b; font-size:12px; margin-top:32px;">
        Este correo fue enviado automáticamente por el portal Avioa. Por favor, procede con el registro en nómina.
      </p>
    </div>
  `;
}
