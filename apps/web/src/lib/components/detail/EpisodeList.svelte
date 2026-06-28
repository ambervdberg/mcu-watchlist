<!--
	Collapsible per-season episode list for a series item. `episodes` is the baked Content
	Layer data passed down from [id].astro/TitleDetail.svelte (marvel-h8a) -- undefined means
	no episode data was available at build time (unreleased season, or no snapshot entry yet),
	which renders as an empty state rather than a loading spinner, since there is nothing left
	to load client-side. Shows a "(watched/total)" count in the <summary> once data is present.

	Owns the episode-watched-toggle wiring: it reads `progress.isWatchedEpisode` and calls
	`progress.toggleEpisodeWatched` directly (the progress store itself gates anonymous
	toggles behind sign-in, per progress.svelte.ts's class doc), so EpisodeRow stays a pure
	presentational component.
-->
<script lang="ts">
	import type { EpisodeDto } from '$lib/api/ports';
	import type { ProgressStore } from '$lib/state/progress';
	import EpisodeRow from './EpisodeRow.svelte';

	let {
		seriesId,
		season,
		episodes,
		progress
	}: {
		seriesId: string;
		season: number;
		/** Baked episode list for this series season, or undefined when none was available at build time. */
		episodes: EpisodeDto[] | undefined;
		progress: ProgressStore;
	} = $props();

	// `progress.progress` is the nanostore atom; `$`-prefixed auto-subscription (rather than
	// the imperative `.get()`) is required so this derives re-run when the store loads or a
	// toggle lands -- Svelte 5's reactivity does not track a plain `.get()` call.
	const progressAtom = progress.progress;

	const allEpisodeIds = $derived((episodes ?? []).map((episode) => episode.id));
	const watchedCount = $derived(
		allEpisodeIds.filter((id) => $progressAtom.watchedEpisodes[seriesId]?.includes(id)).length
	);

	const summaryText = $derived(
		episodes && episodes.length > 0 ? `Episodes (${watchedCount}/${episodes.length} watched)` : 'Episodes'
	);

	function isEpisodeWatched(episodeId: string): boolean {
		return $progressAtom.watchedEpisodes[seriesId]?.includes(episodeId) ?? false;
	}

	function handleToggle(episodeId: string): void {
		void progress.toggleEpisodeWatched(seriesId, episodeId, allEpisodeIds);
	}
</script>

<details class="detail-episodes">
	<summary>{summaryText}</summary>

	{#if !episodes || episodes.length === 0}
		<p class="detail-episodes-status">No episode data available yet.</p>
	{:else}
		<div class="episode-list">
			{#each episodes as episode (episode.id)}
				<EpisodeRow
					{episode}
					{season}
					watched={isEpisodeWatched(episode.id)}
					onToggleWatched={() => handleToggle(episode.id)}
				/>
			{/each}
		</div>
	{/if}
</details>

<style>
	.detail-episodes {
		margin-top: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.85rem;
		padding: 0.85rem 1rem;
		background: var(--soft);
	}

	.detail-episodes summary {
		cursor: pointer;
		font-weight: 700;
	}

	.detail-episodes-status {
		margin: 0.75rem 0 0;
		color: var(--muted);
		font-size: 0.85rem;
	}

	.episode-list {
		margin-top: 0.5rem;
	}
</style>
