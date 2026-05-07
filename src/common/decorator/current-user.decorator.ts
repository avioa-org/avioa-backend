import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface ICurrentUser {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  area: string;
  leaderId: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as ICurrentUser;
  },
);
