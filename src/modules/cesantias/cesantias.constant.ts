export const CATALOGO_TIPO_DOCUMENTO = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'CE', label: 'Cédula de extranjeria' },
  { value: 'PPT', label: 'Permiso por protección temporal' },
];

export const CATALOGO_RAZON_SOCIAL = [
  { value: 'inversiones_avioa', label: 'Inversiones Avioa S.A.S.' },
  { value: 'gestion_turismo', label: 'Gestión Turismo S.A.S' },
  { value: 'hoteles_montana', label: 'Hoteles de la Montaña' },
  { value: 'avioa_mayorista', label: 'Avioa Mayorista S.A.S.' },
];

export const CATALOGO_FONDO = [
  { value: 'porvenir', label: 'Porvenir' },
  { value: 'proteccion', label: 'Protección' },
  { value: 'colfondos', label: 'Confondos' },
  { value: 'fna', label: 'Fondo Nacional del Ahorro' },
  { value: 'skandia', label: 'Skandia' },
  { value: 'otro', label: 'Otro' },
];

export const CATALOGO_MOTIVO = [
  { value: 'EDUCACION', label: 'Educación' },
  { value: 'COMPRA_VIVIENDA', label: 'Compra de vivienda' },
  { value: 'MEJORA_VIVIENDA', label: 'Mejora de vivienda' },
  { value: 'IMPUESTO_PREDIAL', label: 'Pago del impuesto predial' },
  {
    value: 'TERMINACION_CONTRATO',
    label: 'Terminación del contrato laboral',
  },
];

export const CATALOGO_ESTADO: Record<string, { label: string; color: string }> =
  {
    RECIBIDA: { label: 'Recibida', color: 'bg-blue-100 text-blue-700' },
    EN_REVISION: { label: 'En revisión', color: 'bg-amber-100 text-amber-700' },
    PENDIENTE_DOCUMENTOS: {
      label: 'Pendiente de documentos',
      color: 'bg-orange-100 text-orange-700',
    },
    CORREGIDA: {
      label: 'Corregida por el colaborador',
      color: 'bg-cyan-100 text-cyan-700',
    },
    APROBADA: { label: 'Aprobada', color: 'bg-green-100 text-green-700' },
    RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-700' },
    ENVIADA_AL_FONDO: {
      label: 'Enviada al fondo',
      color: 'bg-purple-100 text-purple-700',
    },
    PAGADA_FINALIZADA: {
      label: 'Pagada/finalizada',
      color: 'bg-emerald-100 text-emerald-700',
    },
    DESISTIDA: { label: 'Desistida', color: 'bg-gray-100 text-gray-700' },
    CERRADA: { label: 'Cerrada', color: 'bg-slate-200 text-slate-700' },
  };

// Beneficiarios educación, tipo inmueble, titular inmueble, tipo terminación:
export const CATALOGO_BENEFICIARIO_EDUCACION = [
  { value: 'colaborador', label: 'El colaborador' },
  { value: 'hijo', label: 'Hijo(a)' },
  { value: 'conyuge', label: 'Cónyuge' },
  { value: 'companero', label: 'Compañero(a) permanente' },
];

export const CATALOGO_TIPO_INMUEBLE = [
  { value: 'casa', label: 'Casa' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'lote', label: 'Lote' },
  { value: 'otro', label: 'Otro' },
];

export const CATALOGO_TITULAR_INMUEBLE = [
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'conyuge', label: 'Cónyuge o compañero(a)' },
  { value: 'ambos', label: 'Ambos' },
];

export const CATALOGO_TIPO_TERMINACION = [
  { value: 'renuncia', label: 'Renuncia' },
  { value: 'mutuo_acuerdo', label: 'Terminación por mutuo acuerdo' },
  { value: 'vencimiento_termino', label: 'Vencimiento del término' },
  { value: 'terminacion_empleador', label: 'Terminación por el empleador' },
  { value: 'otra', label: 'Otra' },
];
