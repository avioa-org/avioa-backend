import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { verify } from 'jsonwebtoken';
import { envs } from 'src/config/env.config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const token = request.headers['authorization'] as string;

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    if (!token.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      const newToken = token.replace('Bearer ', '').trim();
      const decoded = verify(newToken, envs.JWT_SECRET);
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
