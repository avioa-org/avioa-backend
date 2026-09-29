import { LeaveRequest } from 'generated/prisma/browser';

export function renderEmployeeCompensatedRejectedEmail({
  leave,
  comment,
}: {
  leave: LeaveRequest;
  comment: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #b91c1c;">Solicitud rechazada por Gestión Humana</h2>
      <p>Tu solicitud de vacaciones compensadas fue rechazada.</p>

      <div style="background:#fee2e2; border-left:4px solid #b91c1c; padding:12px; margin:16px 0;">
        <strong>Motivo:</strong> ${comment}
      </div>

      <p>Si crees que es un error, contacta a Gestión Humana o crea una nueva solicitud con la información corregida.</p>
    </div>
  `;
}
