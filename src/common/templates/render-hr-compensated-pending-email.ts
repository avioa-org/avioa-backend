import { LeaveRequest } from 'generated/prisma/browser';

export function renderHRCompensatedPendingEmail({
  leave,
  employeeName,
  businessDays,
}: {
  leave: LeaveRequest;
  employeeName: string;
  businessDays: number;
}) {
  const start = leave.startDate.toLocaleDateString('es-CO');
  const end = leave.endDate.toLocaleDateString('es-CO');
  const portalUrl = `${process.env.FRONTEND_URL}/leaves/hr-validation`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Validación pendiente: vacaciones compensadas</h2>
      <p><strong>${employeeName}</strong> solicitó <strong>${businessDays} día(s)</strong> de vacaciones compensadas.</p>

      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Fechas</strong></td><td style="padding:8px;">${start} → ${end}</td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Radicado externo</strong></td><td style="padding:8px;">${leave.externalApprovalRef ?? '—'}</td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Motivo</strong></td><td style="padding:8px;">${leave.reason}</td></tr>
      </table>

      ${leave.attachmentUrl ? `<p><a href="${leave.attachmentUrl}">Ver soporte adjunto</a></p>` : ''}

      <p style="margin-top: 24px;">
        <a href="${portalUrl}" style="background:#0ea5e9; color:white; padding:12px 20px; border-radius:6px; text-decoration:none;">
          Revisar y validar
        </a>
      </p>

      <p style="color:#64748b; font-size:12px; margin-top:32px;">
        Este correo fue enviado automáticamente por el portal Avioa.
      </p>
    </div>
  `;
}
