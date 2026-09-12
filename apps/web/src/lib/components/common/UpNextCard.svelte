<!--
	"Up next" card: the single item (and, for a series, the single episode) the visitor
	should watch next, in catalog order, scoped to the current essential-only filter.

	Inner panel of StatsBar (marvel-q34), a plain child component in the same island, not
	its own island -- it reads the shared `filtersStore`/`progressStore`/`sessionStore`
	singletons directly per CLAUDE.md rather than as props. `items`/`episodesByItemId` are
	still props: build-time data passed once from the page, not store state any island
	mutates. No `aria-live` here: StatsBar (the outer `<aside>`) already owns that region.
-->
<script lang="ts">
	import { formatItemType, type Item } from '$lib/domain/item';
	import { findUpNext, type EpisodeSummary } from '$lib/domain/upNext';
	import { getSeasonNumber } from '$lib/data/mediaMetadata/itemSeason';
	import { filtersStore } from '$lib/state/filters';
	import { progressStore } from '$lib/state/progress';
	import { sessionStore } from '$lib/state/session';

	interface Props {
		/** The full catalog (lib/data/items.ts), static build-time data, in timeline order. */
		items: readonly Item[];
		/** Baked per-series episode list (marvel-q34), keyed by catalog item id. */
		episodesByItemId: Readonly<Record<string, readonly EpisodeSummary[]>>;
	}

	let { items, episodesByItemId }: Props = $props();

	const { filters } = filtersStore;
	const { progress } = progressStore;
	const { isAuthenticated } = sessionStore;

	let signedIn = $derived($isAuthenticated);

	let upNext = $derived(findUpNext(items, $progress, $filters.essentialOnly, episodesByItemId));

	/** Season/episode/title line for a series' next episode, e.g. "S2 · E3 · Lamentis". */
	function episodeLine(itemId: string, title: string, episodeNumber: number): string {
		return `S${getSeasonNumber(itemId)} · E${episodeNumber} · ${title}`;
	}

	/** Scrolls the matching timeline card into view instead of following the `#item-{id}` href. */
	function jumpToItem(event: MouseEvent): void {
		if (upNext === null) {
			return;
		}

		event.preventDefault();
		document.getElementById(`item-${upNext.item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<aside class="up-next">
	{#if upNext === null}
		<p class="caught-up">All caught up</p>
	{:else}
		<div class="row">
			<a
				class="jump"
				href={`#item-${upNext.item.id}`}
				onclick={jumpToItem}
				aria-label={`Jump to ${upNext.item.title} in the timeline`}
			>
				<span class="label">{signedIn ? 'Up next' : 'Start here'}</span>

				<span class="title">{upNext.item.title}</span>

				<span class="pill {upNext.item.type}-type">{formatItemType(upNext.item.type)}</span>

				<span class="timeline">{upNext.item.timeline}</span>

				{#if upNext.episode}
					<span class="episode">{episodeLine(upNext.item.id, upNext.episode.title, upNext.episode.episodeNumber)}</span>
					<span class="remaining">{upNext.remainingEpisodes} of {upNext.allEpisodeIds.length} left</span>
				{/if}
			</a>

			<div class="actions">
				<a class="open-link" href={`/title/${upNext.item.id}`}>Open</a>

				{#if !signedIn}
					<span class="sign-in-hint">Sign in to save progress</span>
				{/if}
			</div>
		</div>
	{/if}
</aside>

<style>
	.up-next {
		margin-top: 16px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.055);
	}

	.caught-up {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.jump {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		min-width: 0;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.jump:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 4px;
		border-radius: 8px;
	}

	.label {
		color: var(--muted);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.title {
		font-size: 15px;
		font-weight: 700;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 9px;
		border-radius: 999px;
		background: var(--soft);
		color: var(--muted);
		font-size: 12px;
		line-height: 1;
	}

	.pill.movie-type {
		color: var(--movie);
	}

	.pill.series-type {
		color: var(--series);
	}

	.pill.short-type {
		color: var(--short);
	}

	.pill.special-type {
		color: var(--special);
	}

	.timeline,
	.episode,
	.remaining {
		color: var(--muted);
		font-size: 13px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-left: auto;
	}

	.open-link {
		color: var(--muted);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.open-link:hover {
		text-decoration: underline;
	}

	.sign-in-hint {
		color: var(--muted);
		font-size: 12px;
	}

	@media (max-width: 480px) {
		.actions {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
