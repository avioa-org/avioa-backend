export const transferProfiles = {
  naio: {
    destination: 'palomino',
    name: 'Taxista asignado · Naio',
    label: 'Palomino · Hotel Naio · Traslados',
    title: 'Tours solicitados',
    sections: [
      {
        title: 'Coordinación del traslado',
        text: 'Confirma con el taxista asignado el aeropuerto, el punto de encuentro y la hora de recogida antes del viaje. Para el regreso, acuerda la recogida en el hotel Naio.',
      },
    ],
    excluded:
      'Tours, alimentación y servicios no especificados en este voucher.',
    contacts: ['Coordinación del traslado · Naio', '+57 323 576 0342'],
  },
  decameronbaru: {
    destination: 'baru',
    name: 'Decameron Explorer',
    label: 'Barú · Decameron Explorer · Traslados',
    title: 'Tours solicitados',
    sections: [
      {
        title: 'Coordinación del traslado',
        text: 'Confirma con Decameron Explorer el punto de encuentro y la hora de recogida para el traslado al hotel Decameron Barú. Coordina también la recogida de regreso con el operador.',
      },
    ],
    excluded:
      'Tours, alimentación y servicios no especificados en este voucher.',
    contacts: [
      'Decameron Explorer · Barú',
      'receptivos.explorerbaru@decameron.com',
    ],
  },
  portofino: {
    destination: 'sanandres',
    name: 'Portofino Caribe',
    label: 'San Andrés · Portofino · Combo de tours y traslado',
    title: 'Combo de tours y traslado',
    sections: [
      {
        title: 'Traslado aeropuerto y hotel',
        text: 'Una vez lleguen al aeropuerto de San Andrés, deben dirigirse a la oficina de Portofino Caribe, el tour operador encargado de prestar el servicio de traslado hasta el hotel. Deben validar también la hora de recogida el día de su regreso.',
      },
      {
        title: 'Programación de los tours',
        text: 'Para los tours, deben acercarse el día del primer tour a la hora indicada al muelle de Portofino (1 cuadra arriba del hotel Sol Caribe Centro) y programan los demás tours.',
      },
      {
        title: 'Acuario',
        text: 'El Acuario de San Andrés es uno de los atractivos turísticos más importantes del archipiélago, donde se puede nadar junto con cientos de peces multicolores. Se trata de un pequeño islote de arena coralina y piedra de coral, que hace algunos años fue mucho más grande, pero que debido al viento se ha ido reduciendo al estado actual. Es un lugar fascinante por los diferentes tonos de azul del mar.',
      },
      {
        title: 'Velero',
        text: 'Nuevamente temprano y desayuno en el hotel salimos hacia el muelle y abordamos un pequeño velero para dar una vuelta en la isla, con recreacionista a bordo estaremos 2 horas mar adentro.',
      },
      {
        title: 'Vuelta a la isla',
        text: 'Este exclusivo tour tiene una duración de dos horas y media de recorrido alrededor de la isla, visitando diferentes sitios emblemáticos y de interés turístico de la Isla.',
      },
      {
        title: 'Importante',
        text: 'los menores de 5 años y adultos mayores no pueden ingresar a Jhonny Cay.',
      },
    ],
    excluded: 'Servicios y alimentación no especificados en el plan.',
    contacts: ['Miryam Usuga · Jefe Operativo Receptivos', '316 832 90 61'],
  },
  transturismo: {
    destination: 'cartagena',
    name: 'Transturismo Cartagena',
    label: 'Cartagena · Transturismo · Islas del Rosario',
    title: 'Tour panorámico Islas del Rosario',
    sections: [
      {
        title: 'Descripción del tour',
        text: 'Tour panorámico por las Islas del Rosario con recogida en el hotel (solo transporte hotel-muelle), llegada al acuario y almuerzo en Playa Blanca, Barú.',
      },
    ],
    excluded:
      'Servicios y actividades no especificados en la descripción del tour en el portafolio de servicios.',
    contacts: [
      'Yusmery Flórez · Transturismo Cartagena',
      '317 717 99 43 · 320 500 88 48',
    ],
  },
  taximarino: {
    destination: 'santamarta',
    name: 'Taximarino SAS',
    label: 'Santa Marta · Taximarino · Orden de servicio',
    title: 'Orden de servicio Taximarino',
    sections: [
      {
        title: 'Reserva del Katamaran Tayrona',
        text: 'Los servicios que se ofrecen para el Katamaran Tayrona, se deben reservar desde un día de anticipación para asegurar el cupo de viaje, ya que solo se cuenta con una salida específica al día. Las reservas se deben hacer efectivas al correo reservas@taximarino.com o por Whatsapp o llamada al 3160100594 – 3165228827.',
      },
      {
        title: 'Transporte a Playa Blanca y Acuario',
        text: 'Los servicios de transporte a playa blanca y el acuario, no requieren de reserva ya que se cuenta con periodicidad constante durante el día.',
      },
      {
        title: 'Horarios de salida y regreso',
        text: 'Se debe tener en cuenta para las salidas al acuario y playa blanca, la primera salida es a las 8:30, luego se sigue una periodicidad de cada 30 minutos y la última 2:00 pm, lo retornos son programados desde playa blanca 1:30, 3:30, 4:00 y 4:30 pm.',
      },
      {
        title: 'Puntos de embarque',
        text: 'Los puntos de embarque autorizados son: Muelle norte del rodadero al pasar el puente turístico y punto abordaje sur frente al hotel tamaca.',
      },
      {
        title: 'Presentación de la orden',
        text: 'Para el uso del servicio, el cliente o beneficiario debe presentar la orden de servicio, bono de descuento o formato respectivo que certifique la empresa que está solicitando el servicio acorde con el convenio firmado.',
      },
    ],
    excluded: '',
    contacts: ['reservas@taximarino.com', '316 010 0594 · 316 522 8827'],
    agency: 'aVioa · NIT 900971740 · Carrera 32 B # 29-35',
  },
} as const;
export type TransferTemplate = keyof typeof transferProfiles;
export function isTransferTemplate(value: unknown): value is TransferTemplate {
  return typeof value === 'string' && Object.hasOwn(transferProfiles, value);
}
