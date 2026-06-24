import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or controller) as publicly accessible, bypassing the global
 * JwtAuthGuard. Use sparingly — only for endpoints that must work without a
 * logged-in user (login, external webhooks, patient onboarding).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
