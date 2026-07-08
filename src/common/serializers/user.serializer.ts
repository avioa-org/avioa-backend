/**
 * Esto filtra qué columnas de un usuario puede ver quien pregunta. Se aplica
 * al SALIR (serializacion), como ultima barrera antes de devolver la respuesta.
 *
 * Regla central:
 *  - Datos sensibles (salario, cédula, cuenta bancaria, EPS/AFP/ARL) -> solo ADMIN/RRHH, o el propio dueño de sus datos
 *  - Un LEADER ve a su equipo, pero NUNCA sus salarios.
 *
 * uso: cuando se definan esos campos en el modelo de prisma al ampliar la ficha del empleado
 * mientras no existan la función simplemente los ignora
 */

import { ICurrentUser } from '../decorator/current-user.decorator';

/** Campos que solo el dueño o ADMIN pueden leer */
const SENSITIVE_FIELDS = [
  'salary',
  'documentNumber',
  'banckAccount',
  'eps',
  'afp',
  'arl',
  'emergencyContact',
] as const;

/** Campos internos que nunca deben salir al cliente, para nadie */
const NEVER_EXPOSE = [
  'password',
  'refreshToken',
  'inviteToken',
  'inviteExpires',
  'resetToken',
  'resetTokenExpires',
] as const;

type AnyUser = Record<string, unknown> & { userId?: string };

/**
 * Devuelve una copia del usuario con los campos que 'viewer' NO puede ver
 * eliminado. No muta solo el objeto original
 */
export function serializeUser<T extends AnyUser>(
  user: T,
  viewer: ICurrentUser,
): Partial<T> {
  const clone: AnyUser = { ...user };

  for (const field of NEVER_EXPOSE) {
    delete clone[field];
  }

  const isOwner = viewer.userId === user.userId;
  const isAdmin = viewer.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    for (const field of SENSITIVE_FIELDS) {
      delete clone[field];
    }
  }

  return clone as Partial<T>;
}

/** Versión para listas */
export function serializeUsers<T extends AnyUser>(
  users: T[],
  viewer: ICurrentUser,
): Partial<T>[] {
  return users.map((u) => serializeUser(u, viewer));
}
