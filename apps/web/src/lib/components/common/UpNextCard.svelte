<!--
	"Up next" card: the single item (and, for a series, the single episode) the visitor
	should watch next, in catalog order, scoped to the current essential-only filter.

	Astro migration: mounted as its own island on "/" (marvel-q34), above StatsBar, reading
	the shared `filtersStore`/`progressStore`/`sessionStore` singletons directly per
	CLAUDE.md rather than as props -- Astro would serialize a store prop through JSON and
	drop its methods. `items`/`episodesByItemId` are still props: build-time data passed
	once from the page, not store state any island mutates.
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

	/** Marks the current pick watched: the next episode when one is pending, else the whole item. */
	function markWatched(): void {
		if (upNext === null) {
			return;
		}

		if (upNext.episode) {
			void progressStore.toggleEpisodeWatched(upNext.item.id, upNext.episode.id, upNext.allEpisodeIds);
			return;
		}

		void progressStore.toggleWatched(upNext.item.id);
	}
</script>

<aside class="up-next" aria-live="polite">
	{#if upNext === null}
		<p class="caught-up">All caught up</p>
	{:else}
		<div class="row">
			<span class="label">{signedIn ? 'Up next' : 'Start here'}</span>

			<span class="title">{upNext.item.title}</span>

			<span class="pill {upNext.item.type}-type">{formatItemType(upNext.item.type)}</span>

			<span class="timeline">{upNext.item.timeline}</span>

			{#if upNext.episode}
				<span class="episode">{episodeLine(upNext.item.id, upNext.episode.title, upNext.episode.episodeNumber)}</span>
				<span class="remaining">{upNext.remainingEpisodes} of {upNext.allEpisodeIds.length} left</span>
			{/if}

			<div class="actions">
				<a class="open-link" href={`/title/${upNext.item.id}`}>Open</a>

				{#if signedIn}
					<button type="button" class="watch-btn" onclick={markWatched}>Mark watched</button>
				{:else}
					<span class="sign-in-hint">Sign in to save progress</span>
				{/if}
			</div>
		</div>
	{/if}
</aside>

<style>
	.up-next {
		padding: 14px 18px;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)), var(--panel);
		box-shadow: var(--shadow);
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
		color: var(--accent-2);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}

	.open-link:hover {
		text-decoration: underline;
	}

	.watch-btn {
		padding: 6px 12px;
		border: 0;
		border-radius: 999px;
		background: var(--done);
		color: #07130d;
		font: inherit;
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
	}

	.watch-btn:hover {
		filter: brightness(1.05);
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
