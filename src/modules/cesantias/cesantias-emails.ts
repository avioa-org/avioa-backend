export function correoConfirmacionColaborador(
  nombre: string,
  radicado: string,
) {
  return {
    subject: `Recibimos tu solicitud de cesantías — ${radicado}`,
    html: `
      <p>Hola ${nombre},</p>
      <p>Recibimos tu solicitud de retiro de cesantías con el radicado <strong>${radicado}</strong>.</p>
      <p>Gestión Humana la revisará en los próximos días. Te notificaremos por este medio cualquier
      novedad o si necesitamos documentos adicionales.</p>
      <p>Si tu solicitud requiere soportes que no pudiste adjuntar en el portal, puedes enviarlos
      respondiendo este correo con el radicado <strong>${radicado}</strong> en el asunto.</p>
    `,
  };
}

export function correoNotificacionGH(
  radicado: string,
  nombreColaborador: string,
  motivo: string,
) {
  return {
    subject: `Nueva solicitud de cesantías — ${radicado}`,
    html: `
      <p>Se recibió una nueva solicitud de retiro de cesantías.</p>
      <ul>
        <li><strong>Radicado:</strong> ${radicado}</li>
        <li><strong>Colaborador:</strong> ${nombreColaborador}</li>
        <li><strong>Motivo:</strong> ${motivo}</li>
      </ul>
      <p>Ingresa al portal para revisarla.</p>
    `,
  };
}

export function correoCambioEstado(
  nombre: string,
  radicado: string,
  estado: string,
  comentario?: string,
) {
  const mensajesPorEstado: Record<string, string> = {
    EN_REVISION: 'Tu solicitud está siendo revisada por Gestión Humana.',
    PENDIENTE_DOCUMENTOS:
      'Tu solicitud requiere información o documentos adicionales.',
    APROBADA: '¡Tu solicitud fue aprobada!',
    RECHAZADA: 'Tu solicitud fue rechazada.',
    ENVIADA_AL_FONDO:
      'Tu solicitud fue enviada al fondo de cesantías para el trámite de pago.',
    PAGADA_FINALIZADA: 'El fondo confirmó el pago de tu solicitud.',
    CERRADA: 'Tu solicitud ha sido cerrada.',
  };

  return {
    subject: `Actualización de tu solicitud de cesantías — ${radicado}`,
    html: `
      <p>Hola ${nombre},</p>
      <p>${mensajesPorEstado[estado] ?? 'Tu solicitud tuvo una actualización de estado.'}</p>
      ${comentario ? `<p><strong>Comentario de Gestión Humana:</strong> ${comentario}</p>` : ''}
      <p>Radicado: <strong>${radicado}</strong></p>
    `,
  };
}
