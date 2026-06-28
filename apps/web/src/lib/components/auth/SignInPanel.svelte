<!--
	Sign-in panel: the email-entry form for requesting a magic sign-in link. Astro's
	BaseLayout always mounts this island (no SSR access to read `signInOpen` at the
	template level -- see BaseLayout.astro's own doc comment), so this component now
	guards its own visible markup with `{#if $signInOpen}` internally rather than relying
	on a parent to conditionally mount it. Re-initializing local $state on creation still
	gives every open a clean form (the panel's inner content remounts each time it opens).

	Sign-in posts the visitor's actual `location.pathname` (e.g. `/title/loki-season-1`)
	so consume-link can redirect back to a real, crawlable URL.

	Bead marvel-n4n.9 (this bead) layers UX polish on top of the marvel-n4n.6 stub: a
	disabled-button-plus-spinner submit state, a success sub-view that replaces the form
	inline error text sourced from ApiError (status 400 + body.message, falling back to a
	generic message for anything else), focus-on-open, and an Escape key to close.
	The public surface stays prop-less: everything reads/writes through shared stores.
-->
<script lang="ts">
	import { sessionStore } from '$lib/state/session';
	import { ApiError } from '$lib/api/http';

	// Destructured so Svelte's `$store` auto-subscription syntax below can target the atom
	// directly -- `$sessionStore.signInOpen` would try to subscribe to `sessionStore` itself
	// (the bag of atoms + actions), which has no `subscribe` method of its own.
	const { signInOpen } = sessionStore;

	// Local presentation/UX state only, per this bead's brief: the store holds *whether*
	// the panel is open and the actual signIn() I/O, but the in-progress form value, the
	// submit-in-flight flag, and the success/error message are this component's own concern
	// and would have no other consumer if hoisted into the store.
	let email = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	let succeeded = $state(false);

	// Binds the email input's DOM node so it can be focused once, right after the panel
	// mounts (see $effect below). Declared with $state (not a plain `let`) because the
	// $effect below reads it: Svelte only tracks state-backed variables for effect re-runs,
	// and bind:this's first write needs to trigger that effect.
	let emailInput: HTMLInputElement | undefined = $state();

	// The root layout only mounts this component while signInOpen is true (see its own
	// {#if} block), so "this component was just created" and "the panel was just opened"
	// are the same event here -- there's no separate reset() entry point to call.
	// Focusing email here keeps every fresh open keyboard-ready.
	$effect(() => {
		emailInput?.focus();
	});

	/**
	 * Returns the server-provided validation message, or a generic fallback for transport
	 * errors. ApiError with status 400 and a body.message is treated as a validation
	 * message worth showing verbatim; anything else (network failure, 5xx, malformed body)
	 * gets a generic message so internal error detail never leaks into the UI.
	 */
	function getSignInErrorMessage(error: unknown): string {
		if (error instanceof ApiError && error.status === 400 && isMessageBody(error.body)) {
			return error.body.message;
		}

		return 'Could not send the sign-in link. Try again.';
	}

	/** Narrows ApiError.body (typed `unknown`) to the `{ message: string }` shape before reading it. */
	function isMessageBody(body: unknown): body is { message: string } {
		return typeof body === 'object' && body !== null && typeof (body as { message?: unknown }).message === 'string';
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		errorMessage = '';
		submitting = true;

		try {
			await sessionStore.signIn(email, location.pathname);
			succeeded = true;
		} catch (error) {
			errorMessage = getSignInErrorMessage(error);
		} finally {
			submitting = false;
		}
	}

	/** Escape closes the panel, matching the close button -- a reasonable, low-risk affordance for a modal-style overlay. */
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			sessionStore.closeSignIn();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $signInOpen}
	<section class="signin-panel">
		<div class="signin-card">
			<button
				type="button"
				class="signin-close"
				aria-label="Close sign-in panel"
				onclick={() => sessionStore.closeSignIn()}
			>
				&times;
			</button>

			<p class="eyebrow">Personal progress</p>
			<h2>Sign in</h2>

			{#if succeeded}
				<!-- Replaces the form entirely: there is nothing left for the visitor to do here except
				     read the message and close the panel. -->
				<p class="signin-success" role="status" aria-live="polite">Check your email for a sign-in link.</p>
			{:else}
				<p>Get a one-time link by email to save your own watched progress.</p>

				<form onsubmit={handleSubmit}>
					<label for="signInEmailInput">Email</label>
					<input
						id="signInEmailInput"
						type="email"
						autocomplete="email"
						required
						disabled={submitting}
						bind:value={email}
						bind:this={emailInput}
					/>

					<!-- aria-live so screen reader users hear the validation message as soon as a failed
					     submit sets it, without needing to navigate to it manually. -->
					<p class="signin-error" role="alert" aria-live="assertive">{errorMessage}</p>

					<button type="submit" disabled={submitting}>
						{#if submitting}
							<span class="spinner" aria-hidden="true"></span>
						{/if}
						Send sign-in link
					</button>
				</form>
			{/if}
		</div>
	</section>
{/if}

<style>
	.signin-panel {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		z-index: 10;
	}

	.signin-card {
		position: relative;
		background: var(--panel-solid);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 2rem;
		max-width: 24rem;
		width: 100%;
		box-shadow: var(--shadow);
	}

	.signin-close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		border: none;
		background: none;
		color: var(--muted);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}

	.eyebrow {
		color: var(--accent-2);
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		margin: 0 0 0.25rem;
	}

	h2 {
		margin: 0 0 0.5rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	label {
		color: var(--muted);
		font-size: 0.85rem;
	}

	input {
		background: var(--panel-light);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		color: var(--text);
		padding: 0.5rem 0.75rem;
	}

	input:disabled {
		opacity: 0.6;
	}

	/* Always rendered (even with empty text) so its reserved height keeps the form from
	   jumping when an error appears or clears between submit attempts. */
	.signin-error {
		margin: 0;
		color: var(--accent);
		font-size: 0.85rem;
		min-height: 1em;
	}

	.signin-success {
		margin: 1rem 0 0;
		color: var(--done);
		font-weight: 600;
	}

	button[type='submit'] {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--text);
		border-radius: 0.5rem;
		padding: 0.5rem 0.9rem;
		cursor: pointer;
		font-weight: 600;
	}

	button[type='submit']:hover {
		opacity: 0.92;
	}

	button[type='submit']:disabled {
		cursor: not-allowed;
		opacity: 0.75;
	}

	/* A small CSS-only spinner (no extra icon dependency) shown next to the submit label while a request is in flight. */
	.spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: var(--text);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
