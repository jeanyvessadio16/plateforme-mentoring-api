import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { REQUIRE_ACTIVE_ACCOUNT_KEY } from '../decorators/require-active-account.decorator.js';
import { AccountStatus, UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireActiveAccount = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_ACCOUNT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasRoles = Boolean(requiredRoles && requiredRoles.length > 0);
    const mustBeActive = requireActiveAccount === true;

    if (!hasRoles && !mustBeActive) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Accès refusé : rôle utilisateur non défini.');
    }

    // L'administrateur a accès à l'ensemble des fonctionnalités
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException(
          `Accès refusé : vous devez avoir l'un des rôles suivants : [${requiredRoles.join(', ')}]`,
        );
      }
    }

    if (mustBeActive && user.statutCompte !== AccountStatus.ACTIVE) {
      throw new ForbiddenException(
        'Accès refusé : votre compte est en attente de validation administrative.',
      );
    }

    return true;
  }
}
