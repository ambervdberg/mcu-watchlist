import { describe, expect, it } from 'vitest';
import type { TitleInfoDto } from '../api/ports';
import type { Item } from '../domain/item';
import { buildCatalogJsonLd, buildItemJsonLd } from './jsonLd';

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'iron-man',
		title: 'Iron Man',
		timeline: '2008',
		era: '2008-2012',
		dot: '2008',
		type: 'movie',
		imdbId: 'tt0371746',
		essential: true,
		...overrides
	};
}

function makeTitleInfo(overrides: Partial<TitleInfoDto> = {}): TitleInfoDto {
	return {
		plot: 'A rich playboy builds a suit of armor.',
		imdbRating: '7.9',
		poster: 'https://example.com/poster.jpg',
		runtimeMinutes: 126,
		released: '02 May 2008',
		trailer: null,
		...overrides
	};
}

const URL = 'https://example.com/title/iron-man/';

describe('buildItemJsonLd', () => {
	it('uses @type Movie for a movie item', () => {
		const jsonLd = buildItemJsonLd(makeItem({ type: 'movie' }), undefined, 1, URL);

		expect(jsonLd['@type']).toBe('Movie');
	});

	it('uses @type Movie for a short item', () => {
		const jsonLd = buildItemJsonLd(makeItem({ type: 'short' }), undefined, 1, URL);

		expect(jsonLd['@type']).toBe('Movie');
	});

	it('uses @type Movie for a special item', () => {
		const jsonLd = buildItemJsonLd(makeItem({ type: 'special' }), undefined, 1, URL);

		expect(jsonLd['@type']).toBe('Movie');
	});

	it('uses @type TVSeason and adds seasonNumber/partOfSeries for a series item', () => {
		const item = makeItem({ type: 'series', title: 'Loki season 1' });
		const jsonLd = buildItemJsonLd(item, undefined, 1, URL);

		expect(jsonLd['@type']).toBe('TVSeason');
		expect(jsonLd.seasonNumber).toBe(1);
		expect(jsonLd.partOfSeries).toEqual({ '@type': 'TVSeries', name: 'Loki season 1' });
	});

	it('always includes @context, name, url and sameAs', () => {
		const jsonLd = buildItemJsonLd(makeItem(), undefined, 1, URL);

		expect(jsonLd['@context']).toBe('https://schema.org');
		expect(jsonLd.name).toBe('Iron Man');
		expect(jsonLd.url).toBe(URL);
		expect(jsonLd.sameAs).toBe('https://www.imdb.com/title/tt0371746/');
	});

	it('omits optional fields entirely when titleInfo is undefined and the item has no runtime', () => {
		const jsonLd = buildItemJsonLd(makeItem({ runtimeMinutes: undefined }), undefined, 1, URL);

		expect(jsonLd).not.toHaveProperty('description');
		expect(jsonLd).not.toHaveProperty('image');
		expect(jsonLd).not.toHaveProperty('duration');
		expect(jsonLd).not.toHaveProperty('datePublished');
		expect(jsonLd).not.toHaveProperty('aggregateRating');
	});

	it('includes description, image, duration, datePublished and aggregateRating from real titleInfo', () => {
		const jsonLd = buildItemJsonLd(makeItem(), makeTitleInfo(), 1, URL);

		expect(jsonLd.description).toBe('A rich playboy builds a suit of armor.');
		expect(jsonLd.image).toBe('https://example.com/poster.jpg');
		expect(jsonLd.duration).toBe('PT126M');
		expect(jsonLd.datePublished).toBe('2008-05-02');
		expect(jsonLd.aggregateRating).toEqual({
			'@type': 'AggregateRating',
			ratingValue: 7.9,
			bestRating: 10,
			worstRating: 1
		});
	});

	it('never emits OMDb sentinel values', () => {
		const jsonLd = buildItemJsonLd(
			makeItem({ runtimeMinutes: undefined }),
			makeTitleInfo({ plot: 'N/A', poster: 'N/A', runtimeMinutes: null, released: 'N/A', imdbRating: 'N/A' }),
			1,
			URL
		);

		expect(jsonLd).not.toHaveProperty('description');
		expect(jsonLd).not.toHaveProperty('image');
		expect(jsonLd).not.toHaveProperty('duration');
		expect(jsonLd).not.toHaveProperty('datePublished');
		expect(jsonLd).not.toHaveProperty('aggregateRating');
	});
});

describe('buildCatalogJsonLd', () => {
	it('builds an ascending-order ItemList with one ListItem per item, in catalog order', () => {
		const items = [makeItem({ id: 'iron-man' }), makeItem({ id: 'iron-man-2', title: 'Iron Man 2' })];
		const jsonLd = buildCatalogJsonLd(items, 'https://example.com');

		expect(jsonLd['@context']).toBe('https://schema.org');
		expect(jsonLd['@type']).toBe('ItemList');
		expect(jsonLd.itemListOrder).toBe('https://schema.org/ItemListOrderAscending');
		expect(jsonLd.numberOfItems).toBe(2);
		expect(jsonLd.itemListElement).toEqual([
			{ '@type': 'ListItem', position: 1, url: 'https://example.com/title/iron-man/', name: 'Iron Man' },
			{ '@type': 'ListItem', position: 2, url: 'https://example.com/title/iron-man-2/', name: 'Iron Man 2' }
		]);
	});

	it('is empty-safe for an empty catalog', () => {
		const jsonLd = buildCatalogJsonLd([], 'https://example.com');

		expect(jsonLd.numberOfItems).toBe(0);
		expect(jsonLd.itemListElement).toEqual([]);
	});
});
