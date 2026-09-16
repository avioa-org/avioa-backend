import { LeaveType } from 'generated/prisma/enums';

interface ConfigTipo {
  label: string;
  esRemunerada: boolean;
  afectaNomina: 'SUMA' | 'RESTA';
  contarHabiles: boolean;
}

export const CONFIG_TIPOS: Record<
  Exclude<LeaveType, 'VACACIONES'>,
  ConfigTipo
> = {
  INCAPACIDAD_EPS: {
    label: 'Incapacidad EPS',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: false,
  },
  INCAPACIDAD_ARL: {
    label: 'Incapacidad ARL',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: false,
  },
  LICENCIA_MATERNIDAD: {
    label: 'Licencia de maternidad',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: false,
  },
  LICENCIA_PATERNIDAD: {
    label: 'Licencia de paternidad',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: false,
  },
  LICENCIA_LUTO: {
    label: 'Licencia de luto',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: false,
  },
  LICENCIA_MATRIMONIO: {
    label: 'Licencia de matrimonio',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  PERMISO_REMUNERADO: {
    label: 'Licencia remunerada',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  PERMISO_NO_REMUNERADO: {
    label: 'Licencia no remunerada',
    esRemunerada: false,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  CALAMIDAD_DOMESTICA: {
    label: 'Calamidad doméstica',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  DILIGENCIA_PERSONAL: {
    label: 'Diligencia personal',
    esRemunerada: false,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  OBLIGACION_COMO_ACUDIENTE: {
    label: 'Obligación como acudiente',
    esRemunerada: true,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  CITA_MEDICA_PARTICULAR: {
    label: 'Cita médica particular',
    esRemunerada: false,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  OTRO: {
    label: 'Otro',
    esRemunerada: false,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
};

export function resolverConfigVacaciones(esCompensada: boolean): ConfigTipo {
  return esCompensada
    ? {
        label: 'Vacaciones compensadas (dinero)',
        esRemunerada: true,
        afectaNomina: 'SUMA', // pago adicional, el colaborador sigue trabajando
        contarHabiles: true,
      }
    : {
        label: 'Vacaciones disfrutadas (tiempo)',
        esRemunerada: true,
        afectaNomina: 'RESTA', // el colaborador no trabaja esos días
        contarHabiles: true,
      };
}
