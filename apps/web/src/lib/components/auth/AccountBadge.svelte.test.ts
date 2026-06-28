// Component tests for AccountBadge, the header's reflection of auth state. Named
// *.svelte.test.ts so it runs under vitest.config.ts's browser ("client") vitest project,
// the same convention the state layer's session.test.ts already uses, since rendering a
// real component (rather than just exercising store factories in plain TS) needs a DOM.
//
// AccountBadge imports the `sessionStore` singleton directly (no props, no context seam --
// see lib/state/session.ts), which is wired to the real HttpSessionGateway. Module mocking
// (vi.mock) of '$lib/state/session' did not intercept the component's own import of that
// same specifier under this project's browser-mode test runner, so this file instead stubs
// global `fetch` (the same technique http-gateways.test.ts already uses for gateway-level
// tests) and drives the real singleton through it, resetting its atoms in beforeEach for
// per-test isolation -- there is only one `sessionStore` instance for the whole test file.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { sessionStore } from '$lib/state/session';
import AccountBadge from './AccountBadge.svelte';

/**
 * Stubs global fetch for every request AccountBadge's mount can trigger: `/api/me` (the
 * onMount-driven sessionStore.init()) echoes back whatever `sessionStore.currentUser`
 * already holds at call time, `/api/progress` (the chained progressStore.load()) resolves
 * 401 -- its own documented "anonymous, not an error" signal -- and anything else (e.g.
 * `/api/logout`) resolves 200 with an empty body.
 *
 * `/api/me` must echo the pre-set test state rather than always answering anonymous:
 * AccountBadge's onMount calls the real sessionStore.init(), which would otherwise
 * overwrite a test's `sessionStore.currentUser.set({...})` back to null the moment the
 * component mounts, before the test ever gets to assert on the signed-in view.
 */
function stubLogoutSucceeds(): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (path: string) => {
			if (path === '/api/me') {
				const user = sessionStore.currentUser.get();
				const body = user === null ? { authenticated: false } : { authenticated: true, user };
				return { ok: true, status: 200, json: async () => body };
			}

			if (path.startsWith('/api/progress')) {
				return { ok: false, status: 401, json: async () => ({}) };
			}

			return { ok: true, status: 200, json: async () => ({}) };
		})
	);
}

/**
 * Stubs global fetch so `/api/logout` rejects (simulating a network failure), while `/api/
 * me` and `/api/progress` still resolve like stubLogoutSucceeds (echoing the pre-set
 * currentUser). This stub is installed before render in the logout-failure test, so
 * AccountBadge's onMount-driven sessionStore.init()/progressStore.load() calls -- which
 * happen before the visitor ever clicks Log out -- must keep succeeding; only the explicit
 * logout() call under test should fail.
 */
function stubFetchFails(): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (path: string) => {
			if (path === '/api/me') {
				const user = sessionStore.currentUser.get();
				const body = user === null ? { authenticated: false } : { authenticated: true, user };
				return { ok: true, status: 200, json: async () => body };
			}

			if (path.startsWith('/api/progress')) {
				return { ok: false, status: 401, json: async () => ({}) };
			}

			throw new Error('network down');
		})
	);
}

beforeEach(() => {
	// Resets the singleton back to its neutral anonymous/closed state before each test, since
	// sessionStore is one shared instance for the whole file (no per-test construction).
	sessionStore.currentUser.set(null);
	sessionStore.signInOpen.set(false);
	stubLogoutSucceeds();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AccountBadge', () => {
	it('shows a Sign in button for an anonymous visitor', async () => {
		const screen = render(AccountBadge);

		await expect.element(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
	});

	it('clicking Sign in opens the shared sign-in panel via the session store', async () => {
		const screen = render(AccountBadge);

		await screen.getByRole('button', { name: 'Sign in' }).click();

		expect(sessionStore.signInOpen.get()).toBe(true);
	});

	it('shows the signed-in user email and a Log out button once authenticated', async () => {
		sessionStore.currentUser.set({ id: 'u1', email: 'fan@example.com' });

		const screen = render(AccountBadge);

		await expect.element(screen.getByText('fan@example.com')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
	});

	it('clicking Log out clears the session via the store', async () => {
		sessionStore.currentUser.set({ id: 'u1', email: 'fan@example.com' });

		const screen = render(AccountBadge);
		await screen.getByRole('button', { name: 'Log out' }).click();

		await expect.element(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
		expect(sessionStore.currentUser.get()).toBeNull();
	});

	it('shows an inline error and keeps the signed-in view if logout() rejects', async () => {
		sessionStore.currentUser.set({ id: 'u1', email: 'fan@example.com' });
		// A failing fetch simulates a network failure on the real HttpSessionGateway's
		// logout() call, matching SessionStore.logout()'s documented "no partial logout" contract.
		stubFetchFails();

		const screen = render(AccountBadge);
		await screen.getByRole('button', { name: 'Log out' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not log out. Try again.');
		// The store's own logout() left currentUser untouched because the gateway call
		// rejected before it could clear local state -- the badge still shows signed-in.
		await expect.element(screen.getByText('fan@example.com')).toBeVisible();
	});
});
