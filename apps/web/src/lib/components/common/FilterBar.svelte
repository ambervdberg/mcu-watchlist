<!--
	The row of type/status filter buttons.

	Only the type/status filter (TypeFilter) gets buttons here. The phase filter
	(domain/filters.ts's PhaseFilter) is plumbed end-to-end in the domain/state layers, but
	no catalog entry sets `Item.phase` yet, so there is no real data to drive a phase filter
	UI today. Rendering a dropdown with only "All phases" in it would be a no-op control
	with no behaviour to test.

	Astro migration: this is mounted as its own island on the "/" page, separate from
	SearchInput/EssentialToggle/StatsBar/TimelineView -- each of those is a separately
	mounted Svelte instance with no shared closure, so this component reads/writes the
	`filtersStore` singleton (lib/state/filters.ts) directly instead of taking
	`active`/`onSelect` props from a parent. No props at all now: every other island
	reading the same store re-renders independently when `filtersStore.filters` changes.
-->
<script lang="ts">
	import { filtersStore } from '$lib/state/filters';
	import type { TypeFilter } from '$lib/domain/filters';

	const { filters } = filtersStore;

	/** One button per TypeFilter value, in the order the toolbar presents them. */
	const FILTER_OPTIONS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'movie', label: 'Movies' },
		{ value: 'series', label: 'Series' },
		{ value: 'short', label: 'Shorts' },
		{ value: 'special', label: 'Specials' },
		{ value: 'todo', label: 'To watch' },
		{ value: 'watched', label: 'Watched' },
		{ value: 'skipped', label: 'Skipped' }
	];
</script>

<div class="filters" role="group" aria-label="Filter the watchlist">
	{#each FILTER_OPTIONS as option (option.value)}
		<button
			type="button"
			class="filter-btn"
			class:active={$filters.typeFilter === option.value}
			aria-pressed={$filters.typeFilter === option.value}
			onclick={() => filtersStore.setTypeFilter(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}

	.filter-btn {
		padding: 10px 14px;
		border: 0;
		border-radius: 999px;
		background: var(--panel-light);
		color: var(--text);
		font: inherit;
		cursor: pointer;
		transition:
			transform 160ms ease,
			background 160ms ease;
	}

	.filter-btn:hover {
		transform: translateY(-1px);
		background: #242d45;
	}

	.filter-btn.active {
		background: var(--accent);
		color: white;
	}

	.filter-btn:focus-visible {
		outline: 2px solid var(--accent-2);
		outline-offset: 2px;
	}

	@media (max-width: 600px) {
		.filters {
			gap: 6px;
		}

		.filter-btn {
			padding: 7px 10px;
			font-size: 12.5px;
		}
	}
</style>
