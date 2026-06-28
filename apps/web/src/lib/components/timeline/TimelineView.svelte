<!--
	Orchestrates the era-grouped timeline: groups the currently-visible items by consecutive
	`era`, renders one EraGroup per run, and the centered spine line behind them.

	Grouping is done here because "how items are grouped for display" is a
	timeline-rendering concern, not a page-routing concern.

	Astro migration: mounted as its own island on the "/" page, separate from the
	FilterBar/SearchInput/EssentialToggle/StatsBar islands (no shared parent closure across
	islands), so this recomputes `filtersStore.visibleItems(items, progress)`
	(lib/state/filters.ts) itself from the shared `filtersStore`/`progressStore` singletons,
	and calls the progress store's toggle actions directly instead of taking
	`onToggleWatched`/`onToggleSkipped` callback props. `items` (the static catalog,
	lib/data/items.ts) is still a prop: it is build-time data passed once from the page, not
	store state any island mutates.
-->
<script lang="ts">
	import type { Item } from '$lib/domain/item';
	import { filtersStore } from '$lib/state/filters';
	import { progressStore } from '$lib/state/progress';
	import EraGroup from './EraGroup.svelte';

	interface Props {
		/** The full catalog (lib/data/items.ts), static build-time data. */
		items: readonly Item[];
		/**
		 * Baked episode-count totals (marvel-s4b), keyed by series item id, for the "X/N"
		 * progress pill on series cards. Built once in index.astro frontmatter from the
		 * `episodes` Content Layer collection (only readable there, not inside this island)
		 * and threaded straight through to ItemCard, same as `items` itself.
		 */
		totalEpisodesByItemId: Readonly<Record<string, number>>;
	}

	let { items, totalEpisodesByItemId }: Props = $props();

	const { filters } = filtersStore;
	const { progress } = progressStore;

	/** One era group per consecutive run of equal `era` values. */
	interface EraGroupData {
		era: string;
		items: Item[];
	}

	/**
	 * Groups `items` into consecutive runs sharing the same `era`.
	 * A new heading appears when the era changes from the previous item.
	 */
	function groupByEra(source: readonly Item[]): EraGroupData[] {
		const groups: EraGroupData[] = [];

		for (const item of source) {
			const currentGroup = groups.at(-1);

			if (currentGroup === undefined || currentGroup.era !== item.era) {
				groups.push({ era: item.era, items: [item] });
			} else {
				currentGroup.items.push(item);
			}
		}

		return groups;
	}

	// Re-derived whenever filters or progress change; $filters is read only to register as a
	// $derived dependency (filtersStore.visibleItems reads its own atom internally via .get()).
	let visibleItems = $derived.by(() => {
		void $filters;
		return filtersStore.visibleItems(items, $progress);
	});
	let eraGroups = $derived(groupByEra(visibleItems));

	function handleToggleWatched(itemId: string): void {
		void progressStore.toggleWatched(itemId);
	}

	function handleToggleSkipped(itemId: string): void {
		void progressStore.toggleSkipped(itemId);
	}
</script>

{#if visibleItems.length === 0}
	<p class="empty visible">No items match the current filters.</p>
{:else}
	<div class="timeline-view">
		{#each eraGroups as group (group.items[0].id)}
			<EraGroup
				era={group.era}
				items={group.items}
				progress={$progress}
				{totalEpisodesByItemId}
				onToggleWatched={handleToggleWatched}
				onToggleSkipped={handleToggleSkipped}
			/>
		{/each}
	</div>
{/if}

<style>
	.timeline-view {
		position: relative;
		display: grid;
		gap: 18px;
		padding: 8px 0;
	}

	.timeline-view::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 3px;
		border-radius: 999px;
		background: linear-gradient(180deg, rgba(230, 36, 41, 0.95), rgba(255, 159, 67, 0.95), rgba(122, 167, 255, 0.95));
		transform: translateX(-50%);
		opacity: 0.85;
	}

	.empty {
		padding: 30px;
		border: 1px dashed var(--border);
		border-radius: 26px;
		color: var(--muted);
		text-align: center;
	}

	@media (max-width: 820px) {
		.timeline-view::before {
			left: 23px;
		}
	}
</style>
