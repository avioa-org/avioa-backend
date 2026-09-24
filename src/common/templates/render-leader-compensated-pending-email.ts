import { LeaveRequest } from 'generated/prisma/browser';

export function renderLeaderCompensatedPendingEmail({
  leave,
  employeeName,
}: {
  leave: LeaveRequest;
  employeeName: string;
}) {
  const portalUrl = `${process.env.FRONTEND_URL}/leaves`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background:#dcfce7; color:#166534; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:16px;">
        ✓ Validado por Gestión Humana el ${leave.hrValidatedAt?.toLocaleDateString('es-CO')}
      </div>

      <h2 style="color: #1e293b;">Aprobación pendiente: vacaciones compensadas</h2>
      <p><strong>${employeeName}</strong> solicitó <strong>${leave.businessDays} día(s)</strong> de vacaciones compensadas.</p>

      <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Días compensados</strong></td><td style="padding:8px;"><strong>${leave.businessDays}</strong></td></tr>
        <tr><td style="padding:8px; background:#f1f5f9;"><strong>Motivo</strong></td><td style="padding:8px;">${leave.reason}</td></tr>
      </table>

      <p style="margin-top: 24px;">
        <a href="${portalUrl}" style="background:#0ea5e9; color:white; padding:12px 20px; border-radius:6px; text-decoration:none;">
          Revisar solicitud
        </a>
      </p>
    </div>
  `;
}
