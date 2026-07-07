import { SetMetadata } from '@nestjs/common';

export const LAB_ACCESS_KEY = 'labAccess';

/**
 * Marks a route (or controller) as reachable by LAB_TECH users. LAB_TECH is a
 * whitelist-only role: the global LabTechGuard rejects any authenticated
 * LAB_TECH request whose route lacks this decorator (see lab-tech.guard.ts).
 * Routes for other roles are unaffected.
 */
export const LabAccess = () => SetMetadata(LAB_ACCESS_KEY, true);
