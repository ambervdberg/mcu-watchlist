<!--
	Watch-progress strip: watched count + bar, watched/left time, and the "up next" pick
	(UpNextCard), laid out as one panel row (marvel-q34 hero rebuild).

	Astro migration: mounted as its own island on the "/" page, separate from the other
	toolbar/timeline islands (no shared parent closure across islands), so this recomputes
	`filtersStore.stats`/`filtersStore.runtimeTotals` (lib/state/filters.ts) itself from the
	shared `filtersStore`/`progressStore` singletons, re-deriving whenever either store's atom
	changes. `items`/`episodesByItemId`/`runtimeByItemId`/`posterByItemId` stay props:
	build-time data passed once from the page, not store state any island mutates.
-->
<script lang="ts">
	import { filtersStore } from '$lib/state/filters';
	import { progressStore } from '$lib/state/progress';
	import { formatWatchTime, type RuntimeIndex } from '$lib/domain/runtime';
	import type { Item } from '$lib/domain/item';
	import type { EpisodeSummary } from '$lib/domain/upNext';
	import UpNextCard from './UpNextCard.svelte';

	interface Props {
		/** The full catalog (lib/data/items.ts), static build-time data. */
		items: readonly Item[];
		/** Baked per-series episode list (marvel-q34), keyed by catalog item id. */
		episodesByItemId: Readonly<Record<string, readonly EpisodeSummary[]>>;
		/** Baked runtime minutes per catalog item (lib/data/runtimeIndex.ts), static build-time data. */
		runtimeByItemId: RuntimeIndex;
		/** Baked poster URL per catalog item, static build-time data. Missing entries have no poster. */
		posterByItemId: Readonly<Record<string, string>>;
	}

	let { items, episodesByItemId, runtimeByItemId, posterByItemId }: Props = $props();

	const { filters } = filtersStore;
	const { progress } = progressStore;

	// Re-derived whenever filters or progress change; $filters/$progress below are read only
	// to register as $derived dependencies (the filtersStore methods read their own atoms internally).
	let stats = $derived.by(() => {
		void $filters;
		void $progress;
		return filtersStore.stats(items, $progress);
	});

	let totals = $derived.by(() => {
		void $filters;
		void $progress;
		return filtersStore.runtimeTotals(items, $progress, runtimeByItemId);
	});
</script>

<aside class="strip" aria-live="polite">
	<div class="progress-cell">
		<div class="count">
			<strong>{stats.watchedCount}</strong>
			<span>/ {stats.totalCount} watched</span>
		</div>

		<div class="progress-track" aria-hidden="true">
			<div class="progress-fill" style:width="{stats.percentage}%"></div>
		</div>
	</div>

	<span class="divider" aria-hidden="true"></span>

	<div class="time-cell">
		<div class="time-figure">
			<span class="time-label">Watched</span>
			<span class="time-value">{formatWatchTime(totals.watchedMinutes)}</span>
		</div>

		<div class="time-figure">
			<span class="time-label">Left</span>
			<span class="time-value">{formatWatchTime(totals.remainingMinutes)}</span>
		</div>
	</div>

	<span class="divider" aria-hidden="true"></span>

	<UpNextCard {items} {episodesByItemId} {runtimeByItemId} {posterByItemId} />
</aside>

<style>
	.strip {
		display: flex;
		align-items: center;
		gap: 22px;
		padding: 14px 18px;
		border: 1px solid var(--border);
		border-radius: 26px;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)), var(--panel);
		box-shadow: var(--shadow);
	}

	.progress-cell {
		flex: none;
		width: 340px;
		padding: 4px 8px;
	}

	.count {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.count strong {
		font-size: 44px;
		line-height: 1;
	}

	.count span {
		color: var(--muted);
		font-size: 16px;
	}

	.progress-track {
		overflow: hidden;
		margin-top: 12px;
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
	}

	.progress-fill {
		width: 0;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: width 200ms ease;
	}

	.divider {
		flex: none;
		width: 1px;
		height: 44px;
		background: rgba(255, 255, 255, 0.14);
	}

	.time-cell {
		display: flex;
		flex: none;
		gap: 32px;
		padding: 0 6px;
	}

	.time-figure {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		white-space: nowrap;
	}

	.time-label {
		color: var(--muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.time-value {
		font-size: 18px;
		font-weight: 700;
	}

	@media (max-width: 1100px) {
		.strip {
			flex-wrap: wrap;
		}

		.divider {
			display: none;
		}

		.progress-cell {
			flex: 1 1 240px;
			width: auto;
		}

		.time-cell {
			flex: 1 1 auto;
		}
	}

	@media (max-width: 820px) {
		.strip {
			flex-direction: column;
			align-items: stretch;
		}

		/* Column direction: flex-basis becomes height, so cells go back to content size. */
		.progress-cell,
		.time-cell {
			flex: none;
			width: 100%;
		}
	}
</style>
