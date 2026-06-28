<!--
	Main detail-view layout: title, meta pills, watched-date stamp, watch/skip toggle,
	OMDb plot/poster/rating/runtime/trailer section, and (for series) the per-season
	episode list.

	`item`/`season`/`titleInfo`/`episodes` all arrive as static, build-time-known props from
	the page (see [id].astro's file doc): `titleInfo`/`episodes` are the matching entries from
	the `titleInfo`/`episodes` Content Layer collections (content.config.ts), baked by their
	loaders at build time (marvel-h8a) rather than fetched client-side. Either can be
	`undefined` -- no imdbId, an unreleased season, or a snapshot with no data yet for this
	key -- and that must render as "nothing for this block", not an error; there is no loading
	state to show since this data is already present in the prerendered HTML.

	`progress` reads the shared `progressStore` singleton directly rather than receiving it as
	a prop, because Astro serializes island props through JSON, which silently drops functions
	-- a store object's methods would arrive as null on the client.
-->
<script lang="ts">
	import { formatItemType, formatRuntimeMinutes, formatWatchedDate, type Item } from '$lib/domain/item';
	import type { TitleInfoDto, EpisodeDto } from '$lib/api/ports';
	import { progressStore } from '$lib/state/progress';
	import EpisodeList from './EpisodeList.svelte';
	import TrailerEmbed from './TrailerEmbed.svelte';

	let {
		item,
		season,
		titleInfo,
		episodes
	}: {
		item: Item;
		/** Season number for series items (parsed from the id), unused for movies/shorts/specials. */
		season: number;
		/** Baked title-info for this item/season, or undefined when none was available at build time. */
		titleInfo: TitleInfoDto | undefined;
		/** Baked episode list for this series season, or undefined when none was available at build time. */
		episodes: EpisodeDto[] | undefined;
	} = $props();

	// `$`-prefixed auto-subscription, not `progressStore.isWatched()`/`.get()` -- those read
	// the atom imperatively, which Svelte 5's $derived can't track, so these would freeze at
	// whatever progress held on first render and never reflect a later load() or toggle.
	const { progress } = progressStore;
	const isWatched = $derived($progress.watchedIds[item.id] === true);
	const isSkipped = $derived($progress.skippedIds[item.id] === true);
	const watchedDate = $derived($progress.watchedDates[item.id]);

	const hasOmdbContent = $derived(
		Boolean(titleInfo && (titleInfo.poster !== 'N/A' || titleInfo.plot || titleInfo.imdbRating !== 'N/A'))
	);
</script>

<h1 class="title" class:watched={isWatched} class:skipped={isSkipped}>{item.title}</h1>

<div class="meta">
	<span class="pill {item.type}-type">{formatItemType(item.type)}</span>
	{#if item.essential}
		<span class="pill essential-pill">Essential</span>
	{/if}
	<span class="timeline-text">{item.timeline}</span>
	{#if item.imdbId}
		<a class="imdb-link" href={`https://www.imdb.com/title/${item.imdbId}/`} target="_blank" rel="noopener noreferrer">
			IMDb
		</a>
	{/if}
</div>

{#if isWatched && watchedDate}
	<p class="watched-date">Watched {formatWatchedDate(watchedDate)}</p>
{/if}

<div class="watch-toggle" role="group" aria-label={`Watch status for ${item.title}`}>
	<button
		type="button"
		class="watch-toggle-btn watch-btn"
		class:active={isWatched}
		aria-pressed={isWatched}
		onclick={() => progressStore.toggleWatched(item.id)}
	>
		Watched
	</button>
	<button
		type="button"
		class="watch-toggle-btn skip-btn"
		class:active={isSkipped}
		aria-pressed={isSkipped}
		onclick={() => progressStore.toggleSkipped(item.id)}
	>
		Skip
	</button>
</div>

{#if hasOmdbContent}
	<div class="detail-omdb">
		{#if titleInfo?.poster !== 'N/A'}
			<img class="detail-poster" src={titleInfo?.poster} alt={`${item.title} poster`} />
		{/if}

		<div class="detail-omdb-text">
			{#if titleInfo?.imdbRating !== 'N/A'}
				<p class="detail-rating">IMDb rating: <strong>{titleInfo?.imdbRating}/10</strong></p>
			{/if}
			{#if titleInfo?.released !== 'N/A'}
				<p class="detail-released">Released {titleInfo?.released}</p>
			{/if}
			{#if item.runtimeMinutes}
				<p class="detail-runtime">Runtime {formatRuntimeMinutes(item.runtimeMinutes)}</p>
			{/if}
			{#if titleInfo?.plot}
				<p class="detail-plot">{titleInfo?.plot}</p>
			{/if}
			{#if titleInfo?.trailer}
				<TrailerEmbed trailer={titleInfo?.trailer} itemTitle={item.title} />
			{/if}
		</div>
	</div>
{/if}

{#if item.type === 'series'}
	<EpisodeList seriesId={item.id} {season} {episodes} progress={progressStore} />
{/if}

<style>
	.title {
		margin: 0;
		font-size: 1.6rem;
		line-height: 1.32;
	}

	.title.watched,
	.title.skipped {
		text-decoration: line-through;
		color: var(--muted);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		align-items: center;
		margin-top: 0.5em;
		margin-bottom: 1em;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 9px;
		border-radius: 999px;
		background: var(--soft);
		color: var(--muted);
		font-size: 13px;
		line-height: 1;
	}

	.pill::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
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

	.essential-pill {
		background: rgba(255, 159, 67, 0.16);
		color: var(--accent-2);
		font-weight: 700;
	}

	.essential-pill::before {
		display: none;
	}

	.timeline-text {
		color: var(--muted);
		font-size: 13px;
	}

	.imdb-link {
		display: inline-flex;
		align-items: center;
		padding: 5px 9px;
		border: 1px solid rgba(245, 197, 24, 0.45);
		border-radius: 999px;
		background: rgba(245, 197, 24, 0.1);
		color: #f5c518;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		text-decoration: none;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			transform 160ms ease;
	}

	.imdb-link:hover {
		border-color: rgba(245, 197, 24, 0.85);
		background: rgba(245, 197, 24, 0.18);
		transform: translateY(-1px);
	}

	.imdb-link:focus-visible {
		outline: 2px solid #f5c518;
		outline-offset: 2px;
	}

	.watched-date {
		margin: 6px 0 0;
		color: var(--done);
		font-size: 12px;
	}

	.watch-toggle {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 4px;
		width: fit-content;
		margin-top: 1rem;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
	}

	.watch-toggle-btn {
		padding: 8px 14px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
	}

	.watch-toggle-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.watch-toggle-btn.watch-btn.active {
		background: var(--done);
		color: #07130d;
	}

	.watch-toggle-btn.skip-btn.active {
		background: var(--muted);
		color: #1a2236;
	}

	.watch-toggle-btn:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.detail-omdb {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.detail-poster {
		flex: 0 0 auto;
		width: 9rem;
		border-radius: 0.75rem;
		object-fit: cover;
	}

	.detail-omdb-text {
		flex: 1 1 auto;
		min-width: 0;
	}

	.detail-rating,
	.detail-released,
	.detail-runtime {
		margin: 0 0 0.4rem;
		color: var(--muted);
	}

	.detail-rating strong {
		color: var(--text);
	}

	.detail-plot {
		margin: 0.5rem 0 0;
		line-height: 1.5;
	}

	@media (max-width: 600px) {
		.title,
		.watched-date {
			text-align: center;
		}

		.meta {
			justify-content: center;
			text-align: center;
		}

		.watch-toggle {
			margin-right: auto;
			margin-left: auto;
		}

		.detail-omdb {
			align-items: center;
			flex-direction: column;
			margin-top: 1.5rem;
		}

		.detail-poster {
			width: 100%;
			max-width: clamp(18rem, 68vw, 24rem);
		}

		.detail-omdb-text {
			width: 100%;
		}

		.detail-rating,
		.detail-released {
			text-align: center;
		}
	}
</style>
