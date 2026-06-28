<!--
	Account badge: the header's reflection of the current auth state. Anonymous visitors
	see a "Sign in" button; signed-in visitors see their email plus a "Log out" button. There is no third
	"loading" state here -- the session store starts anonymous (`currentUser = null`) per
	its own neutral-state rule, and flips to signed-in only once init() resolves on the
	client, so this component just renders whatever the store currently holds.

	Bead marvel-n4n.9 (this bead) adds one piece of polish over the marvel-n4n.6 stub: the
	"Log out" button disables itself and the logout() call is wrapped so a network failure
	surfaces as a small inline message instead of becoming an unhandled promise rejection.
	The public surface is unchanged from the stub: still no props, no events, everything
	reads/writes through the shared stores.

	Astro migration: this island is always mounted with `client:load` by BaseLayout.astro
	(the header is on every page), making it the earliest-and-always-present place to kick
	off the client-only session/progress hydration that used to live in +layout.svelte's
	onMount. See the onMount below.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { sessionStore } from '$lib/state/session';
	import { progressStore } from '$lib/state/progress';

	// Hydration: real session/progress are only known once these resolve, and that can only
	// happen on the client (fetch isn't available at prerender time, and even if it were,
	// baking one visitor's session into static HTML shared by every visitor would be the
	// exact server-state-leak bug the spec's "neutral anonymous state" rule guards against).
	// Progress load is sequenced after session init resolves, since the progress store's
	// load() only makes sense once we know whether there is a session to load for -- same
	// ordering +layout.svelte used to enforce in its own onMount.
	async function syncSession(): Promise<void> {
		await sessionStore.init();
		await progressStore.load();
	}

	onMount(() => {
		void syncSession();

		// The site does full page navigations (no client router), so this onMount only runs
		// once per real load -- browser back/forward instead restores the page from bfcache
		// (`pageshow` with `persisted: true`), resuming the exact in-memory state from before
		// the visitor navigated away. Without this listener, a toggle made on another page
		// (e.g. marking an episode watched on the detail page) would never show up after
		// going back, since the timeline page never re-fetches.
		function handlePageShow(event: PageTransitionEvent): void {
			if (event.persisted) {
				void syncSession();
			}
		}

		window.addEventListener('pageshow', handlePageShow);
		return () => window.removeEventListener('pageshow', handlePageShow);
	});

	// Destructured so Svelte's `$store` auto-subscription syntax below can target each atom
	// directly -- `$sessionStore.isAuthenticated` would try to subscribe to `sessionStore`
	// itself (the bag of atoms + actions), which has no `subscribe` method of its own.
	const { currentUser, isAuthenticated } = sessionStore;

	// Local UX-only state: whether a log-out request is in flight, and the message to show
	// if it fails. Neither belongs in the session store -- they are this component's own
	// transient presentation concern, not state any other consumer needs.
	let loggingOut = $state(false);
	let logoutError = $state('');

	async function handleLogout(): Promise<void> {
		logoutError = '';
		loggingOut = true;

		try {
			await sessionStore.logout();
			progressStore.clear();
		} catch {
			// The store's own logout() only throws if the gateway call itself fails (e.g.
			// offline); local state is left exactly as the store leaves it on the rejection,
			// matching the existing SessionStore.logout() contract (no partial logout).
			logoutError = 'Could not log out. Try again.';
		} finally {
			loggingOut = false;
		}
	}
</script>

{#if $isAuthenticated}
	<div class="account-authenticated">
		<span class="account-email">{$currentUser?.email}</span>
		<button type="button" disabled={loggingOut} onclick={handleLogout}>Log out</button>
	</div>

	<!-- Only rendered once there is something to say, so an empty alert region never reserves
	     layout space or gets announced by a screen reader on every render. -->
	{#if logoutError}
		<p class="account-error" role="alert" aria-live="assertive">{logoutError}</p>
	{/if}
{:else}
	<button type="button" onclick={() => sessionStore.openSignIn()}>Sign in</button>
{/if}

<style>
	.account-authenticated {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		max-width: 100%;
		min-width: 0;
	}

	.account-email {
		color: var(--muted);
		font-size: 0.9rem;
		min-width: 0;
		white-space: nowrap;
	}

	.account-error {
		margin: 0.35rem 0 0;
		color: var(--accent);
		font-size: 0.8rem;
		text-align: right;
	}

	button {
		flex: 0 0 auto;
		border: 1px solid var(--border);
		background: var(--panel-light);
		color: var(--text);
		border-radius: 0.5rem;
		padding: 0.4rem 0.9rem;
		cursor: pointer;
	}

	button:hover {
		background: var(--soft);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}

	@media (max-width: 420px) {
		.account-authenticated {
			flex-direction: column;
			align-items: flex-end;
			gap: 0.25rem;
		}

		.account-email {
			font-size: 0.78rem;
		}

		button {
			padding: 0.35rem 0.65rem;
		}
	}
</style>
