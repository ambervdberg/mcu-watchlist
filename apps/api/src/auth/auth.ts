/**
 * Barrel re-export: preserves all previously-public names from auth.ts so every
 * existing importer (functions/*, handlers/*, tests) requires no path changes.
 */

export type { AuthenticatedUser } from "./sessionGuard.js";
export {
  createSessionCookie,
  createExpiredSessionCookie,
} from "./sessionCookie.js";
export {
  isAuthenticated,
  getAuthenticatedUser,
  requireAuthenticatedUser,
  requireAuth,
} from "./sessionGuard.js";
export { sanitizeReturnPath } from "./urlSanitizer.js";
