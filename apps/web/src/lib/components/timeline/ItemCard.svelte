<!--
	A single timeline entry: the era-line dot plus title/meta card.
	The whole-card detail affordance is a link to `/title/{id}` (the Astro-prerendered
	detail page, src/pages/title/[id].astro) stretched to cover the entire card via
	`.card-overlay-link` (position: absolute; inset: 0), rather than wrapping just the
	title in an anchor. Astro has no `$app/paths` equivalent of SvelteKit's `resolve()` --
	the site has no configured `base` path (astro.config.mjs), so a plain template-literal
	href is the direct equivalent.
	The watch/skip buttons sit in their own stacking context (z-index above the overlay
	link) so they stay independently clickable -- nesting them inside the anchor itself
	would be invalid HTML (interactive controls can't nest) and would break keyboard nav.
-->
<script lang="ts">
	import { formatItemType, formatRuntimeMinutes, formatWatchedDate, type Item } from '$lib/domain/item';
	import { progressStore } from '$lib/state/progress';

	interface Props {
		/** The catalog entry this card represents. */
		item: Item;
		/** Whether `item` is currently marked watched. */
		watched: boolean;
		/** Whether `item` is currently marked skipped. */
		skipped: boolean;
		/** "YYYY-MM-DD" the item was marked watched, or undefined if not watched/never stamped. */
		watchedDate: string | undefined;
		/**
		 * Baked total episode count for this series/season (marvel-s4b), from the `episodes`
		 * Content Layer collection threaded down via index.astro -> TimelineView -> EraGroup.
		 * Undefined (or 0) for movies/shorts/specials, and for a series with no baked episode
		 * data yet (unreleased season) -- both cases render no progress pill, see `episodeProgress`.
		 */
		totalEpisodes: number | undefined;
		/** Called when the visitor clicks the "Watched" toggle button. */
		onToggleWatched: () => void;
		/** Called when the visitor clicks the "Skip" toggle button. */
		onToggleSkipped: () => void;
	}

	let { item, watched, skipped, watchedDate, totalEpisodes, onToggleWatched, onToggleSkipped }: Props = $props();

	// progressStore is the shared singleton (lib/state/progress.ts), imported directly per
	// CLAUDE.md rather than passed as a prop -- Astro would serialize a store prop through
	// JSON and drop its methods. This card only needs to read its `progress` atom, so
	// subscribing via $progress below is enough to stay reactive to episode toggles made on
	// the detail page.
	const { progress } = progressStore;

	/** Watched episode count for this item, read reactively from the shared progress store. */
	let watchedEpisodeCount = $derived($progress.watchedEpisodes[item.id]?.length ?? 0);

	/**
	 * Visual episode progress for series cards, or undefined when there is nothing
	 * meaningful to show.
	 */
	let episodeProgress = $derived.by(() => {
		if (item.type !== 'series' || !totalEpisodes) {
			return undefined;
		}

		const watchedCount = Math.min(watchedEpisodeCount, totalEpisodes);
		const percent = Math.round((watchedCount / totalEpisodes) * 100);

		return {
			label: `${watchedCount} of ${totalEpisodes} episodes watched`,
			text: `${watchedCount}/${totalEpisodes}`,
			percent
		};
	});
</script>

<article class="timeline-item" class:watched class:skipped>
	<div class="timeline-dot">{item.dot}</div>

	<div class="timeline-card">
		<a class="card-overlay-link" href={`/title/${item.id}`} aria-label={`View details for ${item.title}`}></a>

		<div class="timeline-card-header">
			<div class="card-content">
				<h2 class="title">{item.title}</h2>

				<div class="meta">
					<span class="pill {item.type}-type">{formatItemType(item.type)}</span>

					{#if item.essential}
						<span class="pill essential-pill">Essential</span>
					{/if}

					{#if episodeProgress}
						<span
							class="episode-progress"
							aria-label={episodeProgress.label}
							title={episodeProgress.label}
							style={`--episode-progress: ${episodeProgress.percent}%`}
						>
							<span class="episode-progress-label">Episodes</span>
							<span class="episode-progress-track" aria-hidden="true">
								<span class="episode-progress-fill"></span>
							</span>
							<span class="episode-progress-count">{episodeProgress.text}</span>
						</span>
					{/if}

					<span class="timeline-text">{item.timeline}</span>

					{#if item.runtimeMinutes}
						<span class="runtime">{formatRuntimeMinutes(item.runtimeMinutes)}</span>
					{/if}
				</div>

				{#if watched && watchedDate}
					<p class="watched-date">Watched {formatWatchedDate(watchedDate)}</p>
				{/if}
			</div>

			<div class="watch-toggle" role="group" aria-label="Watch status for {item.title}">
				<button
					type="button"
					class="watch-toggle-btn watch-btn"
					class:active={watched}
					aria-pressed={watched}
					onclick={onToggleWatched}
				>
					Watched
				</button>
				<button
					type="button"
					class="watch-toggle-btn skip-btn"
					class:active={skipped}
					aria-pressed={skipped}
					onclick={onToggleSkipped}
				>
					Skip
				</button>
			</div>
		</div>
	</div>
</article>

<style>
	.timeline-item {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 64px 1fr;
		align-items: center;
		min-height: 96px;
	}

	.timeline-dot {
		position: relative;
		z-index: 1;
		grid-column: 2;
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		margin: 0 auto;
		border: 3px solid rgba(255, 255, 255, 0.32);
		border-radius: 50%;
		background: var(--panel-solid);
		color: var(--muted);
		font-size: 12px;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		box-shadow: 0 0 0 8px rgba(8, 10, 18, 0.92);
	}

	.timeline-item.watched .timeline-dot {
		border-color: var(--done);
		background: rgba(93, 227, 155, 0.18);
		color: var(--done);
	}

	.timeline-item.skipped .timeline-dot {
		border-color: var(--muted);
		background: rgba(174, 183, 203, 0.14);
		color: var(--muted);
	}

	.timeline-card {
		position: relative;
		grid-column: 1;
		padding: 16px;
		border: 1px solid var(--border);
		border-radius: 23px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.082), rgba(255, 255, 255, 0.026)), var(--panel-solid);
		box-shadow: 0 12px 34px rgba(0, 0, 0, 0.2);
		transition:
			border 160ms ease,
			transform 160ms ease,
			opacity 160ms ease;
	}

	.card-overlay-link {
		position: absolute;
		inset: 0;
		z-index: 0;
		border-radius: inherit;
	}

	.card-overlay-link:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 4px;
	}

	.timeline-card:hover {
		transform: translateY(-2px);
		border-color: rgba(255, 255, 255, 0.25);
	}

	/* Even items sit on the right side of the centered timeline spine. Svelte's #each
	   renders one <article> per item in order, so nth-of-type gives stable alternation. */
	.timeline-item:nth-of-type(even) .timeline-card {
		grid-column: 3;
	}

	.timeline-card-header {
		position: relative;
		z-index: 1;
		display: flex;
		gap: 12px;
		align-items: flex-start;
		justify-content: space-between;
		/* Header and card-content ignore pointer events so clicks on the title/meta text
		   fall through to .card-overlay-link underneath. .watch-toggle opts back in so its
		   buttons stay independently clickable. */
		pointer-events: none;
	}

	.card-content {
		min-width: 0;
		pointer-events: none;
	}

	.watch-toggle {
		pointer-events: auto;
	}

	.timeline-item.watched .timeline-card {
		opacity: 0.62;
	}

	.timeline-item.watched .title {
		text-decoration: line-through;
		color: var(--muted);
	}

	.timeline-item.skipped .timeline-card {
		opacity: 0.42;
	}

	.timeline-item.skipped .title {
		text-decoration: line-through;
		color: var(--muted);
	}

	.title {
		margin: 0;
		font-size: 18px;
		line-height: 1.32;
	}

	.watched-date {
		margin: 6px 0 0;
		color: var(--done);
		font-size: 12px;
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

	.runtime {
		color: var(--muted);
		font-size: 13px;
	}

	.episode-progress {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
		min-width: 152px;
		padding: 5px 9px;
		border: 1px solid rgba(122, 167, 255, 0.32);
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(122, 167, 255, 0.16), rgba(93, 227, 155, 0.08)), rgba(122, 167, 255, 0.08);
		color: #dbe6ff;
		font-size: 12px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		white-space: nowrap;
	}

	.episode-progress-label {
		color: var(--series);
	}

	.episode-progress-track {
		position: relative;
		width: 42px;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(8, 10, 18, 0.58);
		box-shadow: inset 0 0 0 1px rgba(122, 167, 255, 0.16);
	}

	.episode-progress-fill {
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--episode-progress);
		border-radius: inherit;
		background: linear-gradient(90deg, var(--series), var(--done));
	}

	.episode-progress-count {
		min-width: 27px;
		text-align: right;
	}

	/* Single segmented "Watched / Skip" control, matching the watched/skipped
	   mutual-exclusion data model in domain/progress.ts. */
	.watch-toggle {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: 4px;
		padding: 4px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
	}

	.watch-toggle-btn {
		padding: 6px 10px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 12px;
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

	.watch-toggle-btn.watch-btn.active:hover {
		background: var(--done);
	}

	.watch-toggle-btn.skip-btn.active {
		background: var(--muted);
		color: #1a2236;
	}

	.watch-toggle-btn.skip-btn.active:hover {
		background: var(--muted);
	}

	.watch-toggle-btn:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	@media (max-width: 820px) {
		.timeline-item {
			grid-template-columns: 46px 1fr;
			gap: 12px;
			align-items: start;
			min-height: 0;
		}

		.timeline-dot {
			grid-column: 1;
			width: 38px;
			height: 38px;
			margin-top: 12px;
			font-size: 11px;
			box-shadow: 0 0 0 6px rgba(8, 10, 18, 0.92);
		}

		.timeline-card,
		.timeline-item:nth-of-type(even) .timeline-card {
			grid-column: 2;
		}

		.timeline-card-header {
			flex-direction: column;
			align-items: stretch;
		}

		.timeline-card-header .watch-toggle {
			margin-top: 12px;
		}

		.watch-toggle-btn {
			flex: 1;
			padding: 11px 10px;
			font-size: 14px;
			text-align: center;
		}
	}
</style>
