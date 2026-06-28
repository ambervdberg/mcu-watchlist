<!--
	One era heading plus the ItemCards that belong to it.
	TimelineView owns grouping so this component stays a simple presenter for an
	already-grouped era.
-->
<script lang="ts">
	import type { Item } from '$lib/domain/item';
	import type { Progress } from '$lib/domain/progress';
	import ItemCard from './ItemCard.svelte';

	interface Props {
		/** The era label shown as the group heading, e.g. "2008-2012". */
		era: string;
		/** The items belonging to this era, in catalog order. */
		items: readonly Item[];
		/** Current watch progress, used to derive each card's watched/skipped/date state. */
		progress: Progress;
		/** Baked episode-count totals (marvel-s4b), keyed by series item id. See TimelineView. */
		totalEpisodesByItemId: Readonly<Record<string, number>>;
		/** Called with an item id when its "Watched" toggle is clicked. */
		onToggleWatched: (itemId: string) => void;
		/** Called with an item id when its "Skip" toggle is clicked. */
		onToggleSkipped: (itemId: string) => void;
	}

	let { era, items, progress, totalEpisodesByItemId, onToggleWatched, onToggleSkipped }: Props = $props();
</script>

<div class="timeline-era">{era}</div>

{#each items as item (item.id)}
	<ItemCard
		{item}
		watched={progress.watchedIds[item.id] === true}
		skipped={progress.skippedIds[item.id] === true}
		watchedDate={progress.watchedDates[item.id]}
		totalEpisodes={totalEpisodesByItemId[item.id]}
		onToggleWatched={() => onToggleWatched(item.id)}
		onToggleSkipped={() => onToggleSkipped(item.id)}
	/>
{/each}

<style>
	.timeline-era {
		position: relative;
		z-index: 1;
		justify-self: center;
		margin: 14px 0 4px;
		padding: 9px 13px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgba(12, 16, 32, 0.96);
		color: var(--text);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.26);
	}

	@media (max-width: 820px) {
		.timeline-era {
			justify-self: start;
			margin-left: 48px;
		}
	}
</style>
