// Session store: who is signed in (or not), plus the sign-in/sign-out actions.
//
// Built as a factory (`createSessionStore`) rather than a bare module-level store so
// tests can construct an isolated instance wired to `FakeSessionGateway` (src/lib/api/
// fakes.ts), while production uses the `sessionStore` singleton below, wired to the real
// `HttpSessionGateway`. The gateway is a constructor-style parameter (dependency
// injection) per the Dependency Inversion rule in the spec's layering section.
//
// Neutral-state rule: the factory only sets `currentUser` to `null` (anonymous), doing
// no I/O. The real session is only known once `init()` resolves, which the session-owning
// island calls from `onMount` (client-only), so prerendered HTML never bakes in a specific
// visitor's identity.

import { atom, computed, type ReadableAtom } from 'nanostores';
import { FakeSessionGateway } from '../api/fakes';
import { HttpSessionGateway } from '../api/http-gateways';
import type { SessionGateway } from '../api/ports';

/** The currently signed-in user, or null for an anonymous visitor. */
export interface CurrentUser {
	id: string;
	email: string;
}

/** The store shape returned by `createSessionStore`: state atoms plus the session actions. */
export interface SessionStore {
	/** The signed-in user, or null when anonymous. Starts null; see module doc for why. */
	currentUser: ReturnType<typeof atom<CurrentUser | null>>;

	/**
	 * Whether the sign-in panel should currently be shown. Toggled by `openSignIn`/
	 * `closeSignIn`; the progress store also opens this when an anonymous visitor tries
	 * to toggle watched/skipped, since marking progress requires a session.
	 */
	signInOpen: ReturnType<typeof atom<boolean>>;

	/** True once `currentUser` is known to be signed in. Convenience over the raw atom. */
	isAuthenticated: ReadableAtom<boolean>;

	/**
	 * Loads the current session from the server. Called once by the session-owning island
	 * on client mount (never during prerender), so the real signed-in state only ever
	 * reaches the DOM after hydration. A `{ authenticated: false }` response (the normal
	 * anonymous case) simply leaves `currentUser` at null; this never throws for that case.
	 */
	init(): Promise<void>;

	/**
	 * Requests a magic sign-in link for `email`, to redirect to `returnPath` once the
	 * visitor clicks it and the server consumes the token. Does not change local state;
	 * the signed-in state only updates after the visitor follows the emailed link and the
	 * page reloads (at which point `init()` runs again and picks up the new cookie).
	 */
	signIn(email: string, returnPath: string): Promise<void>;

	/**
	 * Clears the session server-side and locally. Per the spec, this only clears local
	 * state; any cloud-stored progress is left untouched so a later sign-in sees it again.
	 */
	logout(): Promise<void>;

	/** Opens the sign-in panel. Called directly by UI, or by the progress store on an anonymous toggle attempt. */
	openSignIn(): void;

	/** Closes the sign-in panel, e.g. after a successful `signIn()` call or an explicit dismiss. */
	closeSignIn(): void;
}

/** Builds a SessionStore wired to `gateway`. Production uses the `sessionStore` singleton below; tests build their own. */
export function createSessionStore(gateway: SessionGateway): SessionStore {
	const currentUser = atom<CurrentUser | null>(null);
	const signInOpen = atom(false);
	const isAuthenticated = computed(currentUser, (user) => user !== null);

	async function init(): Promise<void> {
		const session = await gateway.me();
		currentUser.set(session.authenticated ? session.user : null);
	}

	async function signIn(email: string, returnPath: string): Promise<void> {
		await gateway.requestLink({ email, returnPath });
	}

	async function logout(): Promise<void> {
		await gateway.logout();
		currentUser.set(null);
	}

	function openSignIn(): void {
		signInOpen.set(true);
	}

	function closeSignIn(): void {
		signInOpen.set(false);
	}

	return { currentUser, signInOpen, isAuthenticated, init, signIn, logout, openSignIn, closeSignIn };
}

/**
 * Picks the session gateway for the production singleton below. Real auth needs a `Secure`
 * cookie (see CLAUDE.md), so it only works over HTTPS against a deployed SWA, never against
 * the local `astro dev` server. Setting `PUBLIC_FAKE_LOGIN=true` (e.g. in an untracked
 * `apps/web/.env`) swaps in a FakeSessionGateway pre-seeded as signed-in, so the logged-in UI
 * can be exercised locally. Gated on `DEV` too so this can never affect a production build.
 */
function buildSessionGateway(): SessionGateway {
	if (import.meta.env.DEV && import.meta.env.PUBLIC_FAKE_LOGIN === 'true') {
		const fake = new FakeSessionGateway();
		fake.currentUser = { id: 'dev-user', email: 'dev@local.test' };
		return fake;
	}

	return new HttpSessionGateway();
}

/** The production session store, wired to the real HTTP gateway (or a fake one, see buildSessionGateway). Islands import this directly. */
export const sessionStore = createSessionStore(buildSessionGateway());
