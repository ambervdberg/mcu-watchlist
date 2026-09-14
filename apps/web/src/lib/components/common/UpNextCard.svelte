<!--
	"Up next" row: the single item (and, for a series, the single episode) the visitor
	should watch next, in catalog order, scoped to the current essential-only filter.

	Inner panel of ProgressStrip, a plain child component in the same island, not
	its own island -- it reads the shared `filtersStore`/`progressStore`/`sessionStore`
	singletons directly per CLAUDE.md rather than as props. `items`/`episodesByItemId`/
	`runtimeByItemId`/`posterByItemId` are still props: build-time data passed once from the
	page, not store state any island mutates. The whole row is a link to the title page --
	it no longer scrolls the timeline into view. No `aria-live` here: ProgressStrip (the
	outer `<aside>`) already owns that region.
-->
<script lang="ts">
	import { formatItemType, formatRuntimeMinutes, type Item, type ItemType } from '$lib/domain/item';
	import { findUpNext, type EpisodeSummary, type UpNext } from '$lib/domain/upNext';
	import { getSeasonNumber } from '$lib/data/mediaMetadata/itemSeason';
	import { filtersStore } from '$lib/state/filters';
	import { progressStore } from '$lib/state/progress';
	import { sessionStore } from '$lib/state/session';
	import type { RuntimeIndex } from '$lib/domain/runtime';

	interface Props {
		/** The full catalog (lib/data/items.ts), static build-time data, in timeline order. */
		items: readonly Item[];
		/** Baked per-series episode list, keyed by catalog item id. */
		episodesByItemId: Readonly<Record<string, readonly EpisodeSummary[]>>;
		/** Baked runtime minutes per catalog item, static build-time data. */
		runtimeByItemId: RuntimeIndex;
		/** Baked poster URL per catalog item, static build-time data. Missing entries have no poster. */
		posterByItemId: Readonly<Record<string, string>>;
	}

	let { items, episodesByItemId, runtimeByItemId, posterByItemId }: Props = $props();

	const { filters } = filtersStore;
	const { progress } = progressStore;
	const { isAuthenticated } = sessionStore;

	let signedIn = $derived($isAuthenticated);

	let upNext = $derived(findUpNext(items, $progress, $filters.essentialOnly, episodesByItemId));

	/** Series' next-episode line, e.g. "S2 · E3 · Lamentis · 4 of 6 left". */
	function episodeLine(next: UpNext): string {
		if (!next.episode) {
			return '';
		}

		const season = getSeasonNumber(next.item.id);
		return `S${season} · E${next.episode.episodeNumber} · ${next.episode.title} · ${next.remainingEpisodes} of ${next.allEpisodeIds.length} left`;
	}

	/** Movie/short/special runtime line, e.g. "2h 4m". Empty when the runtime is unknown. */
	function runtimeLine(itemId: string): string {
		const minutes = runtimeByItemId[itemId]?.totalMinutes ?? 0;
		return minutes > 0 ? formatRuntimeMinutes(minutes) : '';
	}

	/** The meta line under the title: episode line for a series, runtime line otherwise. */
	function metaLine(next: UpNext): string {
		return next.item.type === 'series' ? episodeLine(next) : runtimeLine(next.item.id);
	}

	/** CSS class for the type tag, one per {@link ItemType}. */
	function typeTagClass(type: ItemType): string {
		return `type-tag ${type}`;
	}
</script>

{#if upNext === null}
	<p class="caught-up">All caught up</p>
{:else}
	<a class="up-next-link" href={`/title/${upNext.item.id}`}>
		<span class="poster">
			{#if posterByItemId[upNext.item.id]}
				<img src={posterByItemId[upNext.item.id]} alt={`${upNext.item.title} poster`} loading="lazy" />
			{/if}
		</span>

		<span class="info">
			<span class="label">{signedIn ? 'Up next' : 'Start here'}</span>

			<span class="head">
				<span class="title">{upNext.item.title}</span>
				<span class={typeTagClass(upNext.item.type)}>{formatItemType(upNext.item.type)}</span>
				<span class="timeline">{upNext.item.timeline}</span>
			</span>

			{#if metaLine(upNext)}
				<span class="meta">{metaLine(upNext)}</span>
			{/if}
		</span>

		<span class="open">
			Open
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				fill="none"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M7 4l6 6-6 6" />
			</svg>
		</span>
	</a>
{/if}

<style>
	.caught-up {
		flex: 1;
		margin: 0;
		padding: 10px 18px 10px 12px;
		color: var(--muted);
		font-size: 14px;
	}

	.up-next-link {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 16px;
		min-width: 0;
		padding: 10px 18px 10px 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.07);
		color: var(--text);
		text-decoration: none;
		transition: background 160ms ease;
	}

	.up-next-link:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.up-next-link:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 2px;
	}

	.poster {
		display: block;
		flex: none;
		width: 44px;
		height: 64px;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: linear-gradient(160deg, #2a3350, #151b2c);
	}

	.poster img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.info {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		gap: 4px;
		min-width: 0;
	}

	.label {
		color: var(--muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.title {
		font-size: 20px;
		font-weight: 700;
	}

	.type-tag {
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		line-height: 1.4;
	}

	.type-tag.movie {
		background: color-mix(in srgb, var(--movie) 16%, transparent);
		color: var(--movie);
	}

	.type-tag.series {
		background: color-mix(in srgb, var(--series) 16%, transparent);
		color: var(--series);
	}

	.type-tag.short {
		background: color-mix(in srgb, var(--short) 16%, transparent);
		color: var(--short);
	}

	.type-tag.special {
		background: color-mix(in srgb, var(--special) 16%, transparent);
		color: var(--special);
	}

	.timeline,
	.meta {
		color: var(--muted);
		font-size: 13px;
	}

	.open {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		margin-left: auto;
		color: var(--muted);
		font-size: 13px;
	}

	.open svg {
		stroke: var(--text);
	}

	@media (max-width: 1100px) {
		.up-next-link,
		.caught-up {
			flex-basis: 100%;
		}
	}

	@media (max-width: 480px) {
		.up-next-link {
			flex-wrap: wrap;
			padding: 10px 14px;
		}

		/* Poster and text stay side by side, only the Open link drops to its own line. */
		.info {
			flex: 1 1 0;
		}

		.open {
			margin-left: 0;
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
