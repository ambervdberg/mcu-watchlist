<!--
	Small inline loading spinner. This component only renders the spinner glyph itself;
	callers decide layout/positioning around it.

	`size` picks between inline button and full-page loading variants. Defaults to "sm"
	since that is the more common call site, per Svelte 5's $props with a default value.
-->
<script lang="ts">
	interface Props {
		/** Spinner diameter variant. "sm" for inline/button use, "lg" for full-page loading states. */
		size?: 'sm' | 'lg';
	}

	let { size = 'sm' }: Props = $props();
</script>

<span class="spinner" class:spinner-lg={size === 'lg'} aria-hidden="true"></span>

<style>
	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.25);
		border-top-color: var(--text);
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}

	.spinner-lg {
		width: 36px;
		height: 36px;
		border-width: 3px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
