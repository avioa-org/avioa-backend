import { SetMetadata } from '@nestjs/common';

/**
 * Marca una ruta como pública (sin requerir rol).
 *
 * Este decorador va en login, aceptar invitacion, forgot-pasword, health check
 *
 * Ejemplo:
 *  @Public()
 *  @Post('login')
 *  login(...) {}
 */

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
