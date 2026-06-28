<!--
	Trailer card + fullscreen player. Renders as a clickable card (thumbnail + title +
	runtime + description) that opens an
	in-app fullscreen IMDb iframe player on click/Enter/Space. The overlay is plain markup
	inside this component (no portal needed -- `position: fixed` makes it cover the
	viewport regardless of where it sits in the DOM), closed via the minimize button, a
	click on the backdrop, Escape, or the browser leaving fullscreen.
-->
<script lang="ts">
	import type { TrailerDto } from '$lib/api/ports';

	let { trailer, itemTitle }: { trailer: TrailerDto; itemTitle: string } = $props();

	let playerOpen = $state(false);
	let cardEl: HTMLButtonElement | undefined = $state();
	let minimizeButtonEl: HTMLButtonElement | undefined = $state();

	// Opening the overlay never moves keyboard focus there on its own (requestFullscreen()
	// is unrelated to DOM focus), so without this Escape/Tab would still target the card
	// behind the modal. Focus the minimize button on open, and hand focus back to the card
	// on close so keyboard users don't lose their place.
	$effect(() => {
		if (playerOpen) {
			minimizeButtonEl?.focus();
		}
	});

	/** "1h 2m" / "45m" style runtime label. */
	function formatRuntimeSeconds(runtimeSeconds: number | null): string {
		if (!runtimeSeconds) {
			return '';
		}

		const minutes = Math.round(runtimeSeconds / 60);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;

		return hours === 0 ? `${remainingMinutes}m` : `${hours}h ${remainingMinutes}m`;
	}

	/** Appends `autoplay=true` to the embed URL so the fullscreen player starts playing immediately. */
	function withAutoplay(embedUrl: string): string {
		const separator = embedUrl.includes('?') ? '&' : '?';
		return `${embedUrl}${separator}autoplay=true`;
	}

	function openPlayer(): void {
		playerOpen = true;
	}

	function closePlayer(): void {
		playerOpen = false;
		cardEl?.focus();

		// Leave real browser fullscreen if this overlay is the one that requested it.
		if (document.fullscreenElement) {
			void document.exitFullscreen?.().catch(() => {});
		}
	}

	function handleOverlayClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			closePlayer();
		}
	}

	function handleOverlayKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			closePlayer();
		}
	}

	/**
	 * Requests real browser fullscreen for the player modal once it is mounted, and keeps
	 * `playerOpen` in sync with it for the rest of the modal's lifetime.
	 *
	 * Browsers reserve Escape for exiting fullscreen themselves -- that exit can't be
	 * intercepted or prevented from page JS, and it consumes the keypress before
	 * `handleOverlayKeydown` ever sees it. Without this listener, a first Escape only drops
	 * out of fullscreen (the overlay then lingers as a small centered modal) and a second
	 * Escape is needed to actually close it. Listening for `fullscreenchange` instead closes
	 * the overlay the moment fullscreen ends, by any means: Escape, F11, or the browser UI.
	 */
	function requestFullscreen(node: HTMLElement): { destroy(): void } {
		void node.requestFullscreen?.().catch(() => {});

		function handleFullscreenChange(): void {
			if (!document.fullscreenElement) {
				closePlayer();
			}
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange);

		return {
			destroy() {
				document.removeEventListener('fullscreenchange', handleFullscreenChange);

				if (document.fullscreenElement === node) {
					void document.exitFullscreen?.().catch(() => {});
				}
			}
		};
	}

	const title = $derived(trailer.name || 'Trailer');
	const runtimeLabel = $derived(formatRuntimeSeconds(trailer.runtimeSeconds));
</script>

<button type="button" class="detail-trailer" aria-label={`Play ${title}`} onclick={openPlayer} bind:this={cardEl}>
	{#if trailer.imageUrl}
		<img class="detail-trailer-thumb" src={trailer.imageUrl} alt={`${title} thumbnail`} />
	{:else}
		<div class="detail-trailer-thumb detail-trailer-thumb-empty" aria-hidden="true"></div>
	{/if}

	<div class="detail-trailer-copy">
		<span class="detail-trailer-title">{title}</span>
		{#if runtimeLabel}
			<span class="detail-trailer-meta">{runtimeLabel}</span>
		{/if}
		{#if trailer.description}
			<p>{trailer.description}</p>
		{/if}
	</div>

	<span class="detail-trailer-play" aria-hidden="true"></span>
</button>

{#if playerOpen}
	<div class="detail-trailer-overlay" onclick={handleOverlayClick} onkeydown={handleOverlayKeydown} role="presentation">
		<div class="detail-trailer-modal" role="dialog" aria-modal="true" aria-label={title} use:requestFullscreen>
			<button type="button" class="detail-trailer-minimize" onclick={closePlayer} bind:this={minimizeButtonEl}>
				Minimize
			</button>
			<iframe
				class="detail-trailer-iframe"
				src={withAutoplay(trailer.embedUrl)}
				title={`${itemTitle}: ${title}`}
				allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
				allowfullscreen
				loading="eager"
				referrerpolicy="strict-origin-when-cross-origin"
			></iframe>
		</div>
	</div>
{/if}

<style>
	.detail-trailer {
		display: grid;
		grid-template-columns: clamp(8rem, 16vw, 11rem) minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 0.85rem;
		background: var(--soft);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}

	.detail-trailer:hover,
	.detail-trailer:focus-visible {
		border-color: var(--accent-2);
		background: rgba(255, 159, 67, 0.1);
	}

	.detail-trailer:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 2px;
	}

	.detail-trailer-thumb {
		width: 100%;
		aspect-ratio: 16 / 9;
		height: auto;
		border-radius: 0.5rem;
		object-fit: cover;
	}

	.detail-trailer-thumb-empty {
		background: var(--panel-light);
	}

	.detail-trailer-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.detail-trailer-title {
		font-weight: 700;
	}

	.detail-trailer-meta {
		color: var(--muted);
		font-size: 0.8rem;
	}

	.detail-trailer-copy p {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.detail-trailer-play {
		position: relative;
		width: 2.35rem;
		height: 2.35rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		transition:
			background 160ms ease,
			transform 160ms ease;
	}

	.detail-trailer-play::before {
		position: absolute;
		top: 50%;
		left: 54%;
		width: 0;
		height: 0;
		border-top: 0.38rem solid transparent;
		border-bottom: 0.38rem solid transparent;
		border-left: 0.58rem solid var(--text);
		content: '';
		transform: translate(-50%, -50%);
	}

	.detail-trailer:hover .detail-trailer-play,
	.detail-trailer:focus-visible .detail-trailer-play {
		background: rgba(255, 159, 67, 0.18);
		transform: scale(1.04);
	}

	.detail-trailer-overlay {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.88);
	}

	.detail-trailer-modal {
		position: relative;
		width: min(100%, 64rem);
		aspect-ratio: 16 / 9;
		background: #000;
	}

	.detail-trailer-minimize {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 1;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.6);
		color: var(--text);
		padding: 0.4rem 0.75rem;
		cursor: pointer;
	}

	.detail-trailer-iframe {
		width: 100%;
		height: 100%;
		border: none;
	}

	@media (max-width: 600px) {
		.detail-trailer {
			grid-template-columns: 5.5rem minmax(0, 1fr) auto;
			gap: 0.65rem;
			padding: 0.7rem;
		}

		.detail-trailer-title {
			font-size: 0.95rem;
		}

		.detail-trailer-copy p {
			-webkit-line-clamp: 1;
			line-clamp: 1;
		}

		.detail-trailer-play {
			width: 2rem;
			height: 2rem;
		}
	}
</style>
