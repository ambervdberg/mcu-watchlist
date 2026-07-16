<!--
	The "Watched Jun 22, 2026" stamp with an inline edit affordance: clicking "Edit"
	swaps the text for a native date input so the visitor can correct when they actually
	watched the item (capped at today -- a future watched date makes no sense).

	Saves through the shared `progressStore` singleton (imported directly per CLAUDE.md,
	never passed as an Astro island prop), which re-stamps `watchedDates[itemId]` and
	persists. Rendered by both ItemCard (timeline) and TitleDetail, only when the item is
	watched and has a stamped date, so `watchedDate` is always present here.
-->
<script lang="ts">
	import { formatWatchedDate } from '$lib/domain/item';
	import { progressStore } from '$lib/state/progress';

	interface Props {
		/** Id of the watched catalog item whose date this edits. */
		itemId: string;
		/** Display title, used only for the accessible control labels. */
		itemTitle: string;
		/** Current "YYYY-MM-DD" watched-date stamp for the item. */
		watchedDate: string;
	}

	let { itemId, itemTitle, watchedDate }: Props = $props();

	let editing = $state(false);

	/** Today as "YYYY-MM-DD" for the input's `max`; matches the stamp format used by the store. */
	const today = new Date().toISOString().slice(0, 10);

	/**
	 * Svelte action: focus the freshly-mounted date input and pop its native picker where
	 * supported. `showPicker()` needs transient user activation and can throw in odd
	 * embedding contexts, so failures just leave the focused input -- still fully usable.
	 */
	function focusAndOpen(node: HTMLInputElement): void {
		node.focus();
		try {
			node.showPicker?.();
		} catch {
			// Picker is a progressive enhancement; the focused input alone is fine.
		}
	}

	function handleChange(event: Event): void {
		const value = (event.currentTarget as HTMLInputElement).value;

		// An empty value means the visitor cleared the input; keep the existing date.
		if (value) {
			void progressStore.setWatchedDate(itemId, value);
		}

		editing = false;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			editing = false;
		}
	}
</script>

{#if editing}
	<input
		class="watched-date-input"
		type="date"
		value={watchedDate}
		max={today}
		aria-label={`Watched date for ${itemTitle}`}
		onchange={handleChange}
		onkeydown={handleKeydown}
		onblur={() => (editing = false)}
		use:focusAndOpen
	/>
{:else}
	<p class="watched-date">
		Watched {formatWatchedDate(watchedDate)}
		<button
			type="button"
			class="edit-date-btn"
			aria-label={`Change watched date for ${itemTitle}`}
			onclick={() => (editing = true)}
		>
			Edit
		</button>
	</p>
{/if}

<style>
	.watched-date {
		display: flex;
		gap: 8px;
		align-items: center;
		margin: 6px 0 0;
		color: var(--done);
		font-size: 12px;
	}

	.edit-date-btn {
		padding: 2px 8px;
		border: 1px solid rgba(93, 227, 155, 0.35);
		border-radius: 999px;
		background: transparent;
		color: var(--done);
		font: inherit;
		font-size: 11px;
		font-weight: 700;
		line-height: 1.4;
		cursor: pointer;
	}

	.edit-date-btn:hover {
		background: rgba(93, 227, 155, 0.14);
	}

	.edit-date-btn:focus-visible {
		outline: 2px solid var(--done);
		outline-offset: 2px;
	}

	.watched-date-input {
		margin: 6px 0 0;
		padding: 3px 8px;
		border: 1px solid rgba(93, 227, 155, 0.35);
		border-radius: 8px;
		background: rgba(8, 10, 18, 0.6);
		color: var(--done);
		font: inherit;
		font-size: 12px;
		color-scheme: dark;
	}

	.watched-date-input:focus-visible {
		outline: 2px solid var(--done);
		outline-offset: 2px;
	}
</style>
