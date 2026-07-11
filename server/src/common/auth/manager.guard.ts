import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class ManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: UserRole | string };
    }>();

    if (
      request.user?.role !== UserRole.STORE_MANAGER &&
      request.user?.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Store Manager or Admin access required.');
    }

    return true;
  }
}
