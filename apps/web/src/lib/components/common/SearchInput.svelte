<!--
	Free-text search box.

	Astro migration: mounted as its own island, separate from the other toolbar/timeline
	islands on the "/" page (no shared parent closure across islands), so this reads/writes
	`filtersStore.filters.search` (lib/state/filters.ts) directly instead of taking a
	`value`/`onSearch` prop pair from a parent.
-->
<script lang="ts">
	import { filtersStore } from '$lib/state/filters';

	const { filters } = filtersStore;
</script>

<input
	class="search"
	type="search"
	autocomplete="off"
	placeholder="Search title or year"
	aria-label="Search title or year"
	value={$filters.search}
	oninput={(event) => filtersStore.setSearch(event.currentTarget.value)}
/>

<style>
	.search {
		width: min(100%, 380px);
		padding: 12px 15px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: var(--text);
		font: inherit;
		outline: none;
	}

	.search::placeholder {
		color: rgba(174, 183, 203, 0.72);
	}

	@media (max-width: 820px) {
		.search {
			width: 100%;
		}
	}
</style>
