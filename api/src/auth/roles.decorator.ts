import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route (or controller) to the listed roles. Requires the global
 * JwtAuthGuard to have populated req.user, plus RolesGuard to be applied.
 *
 * @example
 * @Roles(Role.ADMIN)
 * @UseGuards(RolesGuard)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
