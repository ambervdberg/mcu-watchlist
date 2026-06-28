<!--
	"Essential only" checkbox switch. A real `<input type="checkbox">` under the hood
	(so it stays keyboard- and screen-reader-accessible) visually styled as a pill switch
	via the sibling `<span>`.

	Astro migration: mounted as its own island, separate from the other toolbar/timeline
	islands on the "/" page (no shared parent closure across islands), so this reads/writes
	`filtersStore.filters.essentialOnly` (lib/state/filters.ts) directly instead of taking a
	`checked`/`onToggle` prop pair from a parent.
-->
<script lang="ts">
	import { filtersStore } from '$lib/state/filters';

	const { filters } = filtersStore;
</script>

<label class="essential-toggle">
	<input
		type="checkbox"
		class="toggle-input"
		checked={$filters.essentialOnly}
		onchange={(event) => filtersStore.setEssentialOnly(event.currentTarget.checked)}
	/>
	<span class="toggle-switch" aria-hidden="true"></span>
	Essential only
</label>

<style>
	.essential-toggle {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		font-size: 14px;
		cursor: pointer;
		user-select: none;
	}

	.toggle-input {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
	}

	.toggle-switch {
		position: relative;
		width: 34px;
		height: 20px;
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--panel-light);
		border: 1px solid var(--border);
		transition:
			background 160ms ease,
			border-color 160ms ease;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--muted);
		transition:
			transform 160ms ease,
			background 160ms ease;
	}

	.toggle-input:checked ~ .toggle-switch {
		background: rgba(230, 36, 41, 0.35);
		border-color: var(--accent);
	}

	.toggle-input:checked ~ .toggle-switch::after {
		transform: translateX(14px);
		background: var(--accent);
	}

	.toggle-input:focus-visible ~ .toggle-switch {
		outline: 2px solid var(--accent-2);
		outline-offset: 2px;
	}

	@media (max-width: 600px) {
		.essential-toggle {
			gap: 6px;
			font-size: 12px;
			white-space: nowrap;
		}

		.toggle-switch {
			width: 28px;
			height: 16px;
		}

		.toggle-switch::after {
			width: 12px;
			height: 12px;
		}

		.toggle-input:checked ~ .toggle-switch::after {
			transform: translateX(12px);
		}
	}
</style>
