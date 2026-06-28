<!--
	Watch-progress summary panel.

	Astro migration: mounted as its own island on the "/" page, separate from the other
	toolbar/timeline islands (no shared parent closure across islands), so this recomputes
	`filtersStore.stats(items, progress)` (lib/state/filters.ts) itself from the shared
	`filtersStore`/`progressStore` singletons, re-deriving whenever either store's atom
	changes. `items` (the static catalog, lib/data/items.ts) is still a prop: it is
	build-time data passed once from the page, not store state any island mutates.
-->
<script lang="ts">
	import { filtersStore } from '$lib/state/filters';
	import { progressStore } from '$lib/state/progress';
	import type { Item } from '$lib/domain/item';

	interface Props {
		/** The full catalog (lib/data/items.ts), static build-time data. */
		items: readonly Item[];
	}

	let { items }: Props = $props();

	const { filters } = filtersStore;
	const { progress } = progressStore;

	// Re-derived whenever filters or progress change; $filters/$progress below are read only
	// to register as $derived dependencies (filtersStore.stats reads its own atom internally).
	let stats = $derived.by(() => {
		void $filters;
		void $progress;
		return filtersStore.stats(items, $progress);
	});
</script>

<aside class="stats" aria-live="polite">
	<div class="stats-number">
		<strong>{stats.watchedCount}</strong>
		<span>/ {stats.totalCount} watched</span>
	</div>

	<div class="progress" aria-hidden="true">
		<div class="progress-bar" style:width="{stats.percentage}%"></div>
	</div>

	<div class="next-card">
		<p class="next-label">Next up</p>
		<p class="next-title">{stats.nextItem ? stats.nextItem.title : 'Everything is watched'}</p>
	</div>
</aside>

<style>
	.stats {
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: 30px;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.025)), var(--panel);
		box-shadow: var(--shadow);
	}

	.stats-number {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 14px;
	}

	.stats-number strong {
		font-size: 44px;
		line-height: 1;
	}

	.stats-number span {
		color: var(--muted);
	}

	.progress {
		overflow: hidden;
		height: 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
	}

	.progress-bar {
		width: 0;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: width 200ms ease;
	}

	.next-card {
		margin-top: 16px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.055);
	}

	.next-label {
		margin: 0 0 6px;
		color: var(--muted);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.next-title {
		margin: 0;
		font-size: 16px;
		line-height: 1.35;
	}
</style>
