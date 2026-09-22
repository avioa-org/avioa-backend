export const ROLE_DEFAULT_MODULES: Record<string, string[]> = {
  ADMIN: [],

  MANAGER: [
    'FEED',
    'LEAVES',
    'OVERTIME',
    'MAINTENANCE',
    'EQUIPMENT_LOANS',
    'FORMS',
    'POINTS',
    'POINTS_APPROVE',
    'KNOWLEDGE',
    'PASSWORD_VAULT',
    'COTIZADOR',
  ],

  LEADER: [
    'FEED',
    'LEAVES',
    'OVERTIME',
    'MAINTENANCE',
    'EQUIPMENT_LOANS',
    'FORMS',
    'POINTS_APPROVE', // solo aprobar, no crear recompensas
    'KNOWLEDGE',
    'PASSWORD_VAULT',
    'USERS_ADMIN_VACATIONS',
  ],

  RRHH: [
    'USERS_ADMIN',
    'NOMINA',
    'LEAVES',
    'LEAVES_ADMIN',
    'FORMS',
    'FEED',
    'KNOWLEDGE',
    'PASSWORD_VAULT',
    'MAINTENANCE',
    'EQUIPMENT_LOANS',
    'USERS_ADMIN_VACATIONS',
  ],

  ACCOUNTING: [
    'NOMINA',
    'FEED',
    'KNOWLEDGE',
    'PASSWORD_VAULT',
    'EQUIPMENT_LOANS',
    'USERS_ADMIN_VACATIONS',
  ],

  EMPLOYEE: [],
};
