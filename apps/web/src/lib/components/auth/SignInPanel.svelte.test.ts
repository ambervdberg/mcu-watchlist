// Component tests for SignInPanel, the magic-link request form.
// Named *.svelte.test.ts so it runs under vitest.config.ts's browser ("client") vitest
// project, matching the state layer's session.test.ts convention -- a real DOM is needed
// to render the component and dispatch form events.
//
// SignInPanel imports the `sessionStore` singleton directly (no props, no context seam --
// see lib/state/session.ts), which is wired to the real HttpSessionGateway. Module mocking
// (vi.mock) of '$lib/state/session' did not intercept the component's own import of that
// same specifier under this project's browser-mode test runner, so this file instead stubs
// global `fetch` (the same technique http-gateways.test.ts already uses for gateway-level
// tests) and drives the real singleton through it, resetting its atoms in beforeEach for
// per-test isolation -- there is only one `sessionStore` instance for the whole test file.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { sessionStore } from '$lib/state/session';
import SignInPanel from './SignInPanel.svelte';

const SUCCESS_BODY = { message: 'Check your email for a sign-in link.' };

/** Stubs global fetch so every request resolves successfully with SUCCESS_BODY. */
function stubRequestLinkSucceeds(): void {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, status: 200, json: async () => SUCCESS_BODY }))
	);
}

beforeEach(() => {
	// Resets the singleton back to a neutral signed-out state before each test, since
	// sessionStore is one shared instance for the whole file (no per-test construction).
	// signInOpen defaults to true here: SignInPanel now guards its own visible markup with
	// `{#if $signInOpen}` (it is always mounted by BaseLayout.astro, not conditionally
	// mounted by a parent), so these tests -- which render SignInPanel directly and assert
	// on its visible markup -- need the panel open by default to exercise that markup.
	sessionStore.currentUser.set(null);
	sessionStore.signInOpen.set(true);
	stubRequestLinkSucceeds();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('SignInPanel', () => {
	it('focuses the email field on open', async () => {
		const screen = render(SignInPanel);

		await expect.element(screen.getByLabelText('Email')).toHaveFocus();
	});

	it('submits the visitor email plus the real current path (no hash) to session.signIn()', async () => {
		// jsdom-style location is not in play here (this is a real Chromium page via
		// playwright), so location.pathname reflects the actual test page URL, matching
		// spec section 4's "real returnPath" requirement.
		const screen = render(SignInPanel);

		await screen.getByLabelText('Email').fill('fan@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		await expect.element(screen.getByRole('status')).toHaveTextContent('Check your email for a sign-in link.');
		expect(fetch).toHaveBeenCalledWith(
			'/api/auth/request-link',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ email: 'fan@example.com', returnPath: location.pathname })
			})
		);
	});

	it('shows a disabled, spinner-bearing submit button while the request is in flight', async () => {
		let resolveRequest: (() => void) | undefined;
		// Holds the fetch open so the in-flight UI state is observable before it resolves.
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise((resolve) => {
						resolveRequest = () => resolve({ ok: true, status: 200, json: async () => SUCCESS_BODY });
					})
			)
		);
		const screen = render(SignInPanel);

		await screen.getByLabelText('Email').fill('fan@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		const submitButton = screen.getByRole('button', { name: 'Send sign-in link' });
		await expect.element(submitButton).toBeDisabled();
		await expect.element(screen.getByLabelText('Email')).toBeDisabled();

		resolveRequest?.();
		await expect.element(screen.getByRole('status')).toBeVisible();
	});

	it('replaces the form with a success message once signIn() resolves', async () => {
		const screen = render(SignInPanel);

		await screen.getByLabelText('Email').fill('fan@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		await expect.element(screen.getByRole('status')).toHaveTextContent('Check your email for a sign-in link.');
		await expect.element(screen.getByLabelText('Email')).not.toBeInTheDocument();
	});

	it('shows the server validation message for a 400 ApiError with a body.message', async () => {
		const errorBody = { message: 'Enter a valid email address.' };
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, status: 400, json: async () => errorBody }))
		);
		const screen = render(SignInPanel);

		// Server-side validation is what's under test here (the 400 + body.message path), so
		// the value must satisfy the input's native type="email" constraint or the browser
		// blocks the submit event before handleSubmit ever runs.
		await screen.getByLabelText('Email').fill('not-quite-valid@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
		// The form stays up (not replaced by the success view) so the visitor can correct and retry.
		await expect.element(screen.getByLabelText('Email')).toBeVisible();
	});

	it('falls back to a generic message for a non-400 ApiError or a transport failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ message: 'should not be shown' }) }))
		);
		const screen = render(SignInPanel);

		await screen.getByLabelText('Email').fill('fan@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not send the sign-in link. Try again.');
	});

	it('re-enables the submit button after a failed request, so the visitor can retry', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		const screen = render(SignInPanel);

		await screen.getByLabelText('Email').fill('fan@example.com');
		await screen.getByRole('button', { name: 'Send sign-in link' }).click();

		await expect.element(screen.getByRole('button', { name: 'Send sign-in link' })).not.toBeDisabled();
	});

	it('clicking the close button closes the panel via the session store', async () => {
		sessionStore.openSignIn();
		const screen = render(SignInPanel);

		await screen.getByRole('button', { name: 'Close sign-in panel' }).click();

		expect(sessionStore.signInOpen.get()).toBe(false);
	});

	it('pressing Escape closes the panel via the session store', async () => {
		sessionStore.openSignIn();
		render(SignInPanel);

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(sessionStore.signInOpen.get()).toBe(false);
	});
});
