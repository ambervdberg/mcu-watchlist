// Pure JSON-LD (schema.org) builders. Return plain objects; the .astro pages serialize them
// into a <script type="application/ld+json"> block. Framework-agnostic: no Astro/DOM imports.

import type { TitleInfoDto } from '../api/ports';
import type { Item } from '../domain/item';
import { siteCreator } from '../data/siteCreator';
import { titleUrl } from './catalogUrl';
import type { FaqEntry } from './faq';
import {
	aggregateRatingField,
	datePublishedField,
	descriptionField,
	durationField,
	imageField
} from './titleInfoFields';

const IMDB_TITLE_URL_PREFIX = 'https://www.imdb.com/title/';
const ITEM_LIST_ORDER_ASCENDING = 'https://schema.org/ItemListOrderAscending';

/**
 * Builds the JSON-LD for one title/episode detail page.
 *
 * `@type` is `TVSeason` for a series item, `Movie` for movie/short/special (schema.org has no
 * TVSpecial or Short type). `titleInfo` may be undefined, in which case only the fields the
 * catalog item itself carries are included, see titleInfoFields.ts for the hygiene rules.
 */
export function buildItemJsonLd(
	item: Item,
	titleInfo: TitleInfoDto | undefined,
	season: number,
	url: string
): Record<string, unknown> {
	const jsonLd: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': itemJsonLdType(item),
		name: item.title,
		url,
		sameAs: imdbUrl(item.imdbId),
		...descriptionField(titleInfo),
		...imageField(titleInfo),
		...durationField(item, titleInfo),
		...datePublishedField(titleInfo),
		...aggregateRatingField(titleInfo)
	};

	if (item.type === 'series') {
		jsonLd.seasonNumber = season;
		jsonLd.partOfSeries = { '@type': 'TVSeries', name: item.title };
	}

	return jsonLd;
}

/** Builds the JSON-LD for the catalog page: every item as an ordered ItemList. */
export function buildCatalogJsonLd(items: Item[], baseUrl: string): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		itemListOrder: ITEM_LIST_ORDER_ASCENDING,
		numberOfItems: items.length,
		itemListElement: items.map((item, index) => buildListItem(item, index, baseUrl)),
		creator: buildCreator()
	};
}

/** Builds the JSON-LD for the catalog page's FAQ section: one Question per entry. */
export function buildFaqJsonLd(entries: readonly FaqEntry[]): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: entries.map(buildQuestion)
	};
}

/** Renders one Question entry for the FAQPage's mainEntity list. */
function buildQuestion(entry: FaqEntry): Record<string, unknown> {
	return {
		'@type': 'Question',
		name: entry.question,
		acceptedAnswer: {
			'@type': 'Answer',
			text: entry.answer
		}
	};
}

/** Renders one ListItem entry for the catalog ItemList, 1-based position. */
function buildListItem(item: Item, index: number, baseUrl: string): Record<string, unknown> {
	return {
		'@type': 'ListItem',
		position: index + 1,
		url: titleUrl(baseUrl, item.id),
		name: item.title
	};
}

/** Renders the site creator as a schema.org Person, linked to their LinkedIn profile. */
function buildCreator(): Record<string, unknown> {
	return {
		'@type': 'Person',
		name: siteCreator.name,
		sameAs: siteCreator.linkedInUrl
	};
}

/** JSON-LD `@type` for a catalog item: `TVSeason` for a series, `Movie` otherwise. */
function itemJsonLdType(item: Item): 'TVSeason' | 'Movie' {
	return item.type === 'series' ? 'TVSeason' : 'Movie';
}

/** Full IMDb title URL for an IMDb id. */
function imdbUrl(imdbId: string): string {
	return `${IMDB_TITLE_URL_PREFIX}${imdbId}/`;
}
