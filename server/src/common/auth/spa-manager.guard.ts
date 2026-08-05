import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class SpaManagerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: UserRole | string };
    }>();

    if (
      request.user?.role !== UserRole.SPA_MANAGER &&
      request.user?.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Quyền truy cập Spa Manager hoặc Admin là bắt buộc.',
      );
    }

    return true;
  }
}
