<!--
	One episode row inside EpisodeList: thumbnail, "S<season>E<n> - <title>" heading, a
	per-episode watched toggle button, runtime/rating/release meta, and plot text.

	Presentational only -- props in, `onToggleWatched` callback out -- per the layered
	architecture (UI reads watched state and emits intent; the progress store owns the
	actual mutation and the anonymous/sign-in gate, see EpisodeList.svelte).
-->
<script lang="ts">
	import type { EpisodeDto } from '$lib/api/ports';

	let {
		episode,
		season,
		watched,
		onToggleWatched
	}: {
		episode: EpisodeDto;
		season: number;
		watched: boolean;
		onToggleWatched: () => void;
	} = $props();

	/** "1h 2m" / "45m" style runtime label, matching the movie-level format used elsewhere. */
	function formatRuntimeSeconds(runtimeSeconds: number | null): string {
		if (!runtimeSeconds) {
			return '';
		}

		const minutes = Math.round(runtimeSeconds / 60);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;

		return hours === 0 ? `${remainingMinutes}m` : `${hours}h ${remainingMinutes}m`;
	}

	const title = $derived(episode.title || `Episode ${episode.episodeNumber}`);
	const runtimeLabel = $derived(formatRuntimeSeconds(episode.runtimeSeconds));
</script>

<article class="episode-row">
	{#if episode.posterUrl}
		<img class="episode-thumb" src={episode.posterUrl} alt={`${title} thumbnail`} />
	{:else}
		<div class="episode-thumb episode-thumb-empty" aria-hidden="true"></div>
	{/if}

	<div class="episode-main">
		<div class="episode-heading">
			<h3>S{season}E{episode.episodeNumber} - {title}</h3>
			<button
				type="button"
				class="watch-toggle-btn episode-watch-btn"
				class:active={watched}
				aria-pressed={watched}
				onclick={onToggleWatched}
			>
				Watched
			</button>
		</div>

		<div class="episode-meta">
			{#if runtimeLabel}
				<span>{runtimeLabel}</span>
			{/if}
			{#if episode.imdbRating}
				<span>IMDb {episode.imdbRating}</span>
			{/if}
			{#if episode.released}
				<span>{episode.released}</span>
			{/if}
		</div>

		{#if episode.plot}
			<p class="episode-plot">{episode.plot}</p>
		{/if}
	</div>
</article>

<style>
	.episode-row {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem 0;
		border-top: 1px solid var(--border);
	}

	.episode-row:first-child {
		border-top: none;
	}

	.episode-thumb {
		flex: 0 0 auto;
		width: 6rem;
		height: 3.4rem;
		border-radius: 0.5rem;
		object-fit: cover;
	}

	.episode-thumb-empty {
		background: var(--panel-light);
	}

	.episode-main {
		flex: 1 1 auto;
		min-width: 0;
	}

	.episode-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.episode-heading h3 {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.3;
	}

	.episode-watch-btn {
		flex: 0 0 auto;
		padding: 0.35rem 0.7rem;
		font-size: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font-weight: 700;
		cursor: pointer;
	}

	.episode-watch-btn.active {
		background: var(--done);
		color: #07130d;
		border-color: var(--done);
	}

	.episode-watch-btn:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.episode-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.3rem;
		color: var(--muted);
		font-size: 0.8rem;
	}

	.episode-plot {
		margin: 0.4rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.episode-row {
			flex-direction: column;
		}

		.episode-thumb {
			width: 100%;
			height: auto;
			aspect-ratio: 16 / 9;
		}
	}
</style>
