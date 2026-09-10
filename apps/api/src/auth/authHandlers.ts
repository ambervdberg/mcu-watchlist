/**
 * Barrel re-export: keeps all existing importers in functions/ and tests stable
 * while the actual handler logic lives in per-handler files under ./handlers/.
 */
export { handleRequestLink } from "./handlers/requestLink.js";
export { handleConsumeLink } from "./handlers/consumeLink.js";
export { handleMe } from "./handlers/me.js";
export { handleLogout } from "./handlers/logout.js";
