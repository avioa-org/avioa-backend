import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, UserStatus } from 'generated/prisma/enums';

export interface ICurrentUser {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: Role;
  status: UserStatus;
  area: string | null;
  department: string | null;
  leaderId: string | null;
  managerId: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof ICurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as ICurrentUser;
    return data ? user?.[data] : user;
  },
);
