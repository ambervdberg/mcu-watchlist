import type {
  ConsumedLoginToken,
  CreateLoginTokenRequest,
  CreatedLoginToken,
  UserAccount,
} from "../userAuth.js";

// Structural-typing ports for the stores the handlers depend on. Each handler
// accepts these narrow shapes (rather than the concrete LoginTokenStore /
// UserStore classes) so tests can inject in-memory fakes via dependency
// injection without constructing the real Table Storage clients.

/** The slice of the token store that consume-link depends on. */
export type TokenStoreLike = {
  consumeLoginToken(rawToken: string): Promise<ConsumedLoginToken | null>;
};

/** The slice of the token store that request-link depends on. */
export type TokenIssuerLike = {
  createLoginToken(
    request: CreateLoginTokenRequest,
  ): Promise<CreatedLoginToken>;
};

/** The slice of the user store that consume-link and me depend on. */
export type UserStoreLike = {
  getOrCreateUserByEmail(email: string): Promise<UserAccount>;
  getUserById(userId: string): Promise<UserAccount | null>;
};
