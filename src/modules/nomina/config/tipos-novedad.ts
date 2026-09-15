import { LeaveType } from 'generated/prisma/enums';

interface ConfigTipo {
  label: string;
  esRemunerada: boolean;
  afectaNomina: 'SUMA' | 'RESTA' | 'NEUTRO';

  // true = se cuenta en dias habiles; false = dias calendario
  contarHabiles: boolean;
}

export const CONFIG_TIPOS: Record<LeaveType, ConfigTipo> = {
  VACACIONES: {
    label: 'Vacaciones',
    esRemunerada: true,
    afectaNomina: 'NEUTRO',
    contarHabiles: true,
  },
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
    afectaNomina: 'NEUTRO',
    contarHabiles: false,
  },
  LICENCIA_MATRIMONIO: {
    label: 'Licencia de matrimonio',
    esRemunerada: true,
    afectaNomina: 'NEUTRO',
    contarHabiles: true,
  },
  PERMISO_REMUNERADO: {
    label: 'Permiso remunerado',
    esRemunerada: true,
    afectaNomina: 'NEUTRO',
    contarHabiles: true,
  },
  PERMISO_NO_REMUNERADO: {
    label: 'Permiso no remunerado',
    esRemunerada: false,
    afectaNomina: 'RESTA',
    contarHabiles: true,
  },
  CALAMIDAD_DOMESTICA: {
    label: 'Calamidad doméstica',
    esRemunerada: true,
    afectaNomina: 'NEUTRO',
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
    afectaNomina: 'NEUTRO',
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
    afectaNomina: 'NEUTRO',
    contarHabiles: true,
  },
};
