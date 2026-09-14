import { describe, expect, it } from 'vitest';
import type { TitleInfoDto } from '../api/ports';
import type { Item } from '../domain/item';
import {
	aggregateRatingField,
	datePublishedField,
	descriptionField,
	durationField,
	imageField
} from './titleInfoFields';

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
		imdbVotes: '1,234,567',
		poster: 'https://example.com/poster.jpg',
		runtimeMinutes: 126,
		released: '02 May 2008',
		trailer: null,
		...overrides
	};
}

describe('descriptionField', () => {
	it('is empty when titleInfo is undefined', () => {
		expect(descriptionField(undefined)).toEqual({});
	});

	it('is empty when plot is the OMDb "N/A" sentinel', () => {
		expect(descriptionField(makeTitleInfo({ plot: 'N/A' }))).toEqual({});
	});

	it('is empty when plot is an empty string', () => {
		expect(descriptionField(makeTitleInfo({ plot: '' }))).toEqual({});
	});

	it('carries a real plot through as description', () => {
		expect(descriptionField(makeTitleInfo({ plot: 'A hero rises.' }))).toEqual({ description: 'A hero rises.' });
	});
});

describe('imageField', () => {
	it('is empty when titleInfo is undefined', () => {
		expect(imageField(undefined)).toEqual({});
	});

	it('is empty when poster is the OMDb "N/A" sentinel', () => {
		expect(imageField(makeTitleInfo({ poster: 'N/A' }))).toEqual({});
	});

	it('carries a real poster URL through as image', () => {
		expect(imageField(makeTitleInfo({ poster: 'https://example.com/p.jpg' }))).toEqual({
			image: 'https://example.com/p.jpg'
		});
	});
});

describe('durationField', () => {
	it('prefers the catalog item runtime over titleInfo runtime', () => {
		const item = makeItem({ runtimeMinutes: 126 });

		expect(durationField(item, makeTitleInfo({ runtimeMinutes: 999 }))).toEqual({ duration: 'PT126M' });
	});

	it('falls back to titleInfo runtime when the catalog item has none', () => {
		const item = makeItem({ runtimeMinutes: undefined });

		expect(durationField(item, makeTitleInfo({ runtimeMinutes: 96 }))).toEqual({ duration: 'PT96M' });
	});

	it('is empty when neither the item nor titleInfo has a runtime', () => {
		const item = makeItem({ runtimeMinutes: undefined });

		expect(durationField(item, makeTitleInfo({ runtimeMinutes: null }))).toEqual({});
		expect(durationField(item, undefined)).toEqual({});
	});
});

describe('datePublishedField', () => {
	it('is empty when titleInfo is undefined', () => {
		expect(datePublishedField(undefined)).toEqual({});
	});

	it('parses OMDb\'s "DD Mon YYYY" format into "YYYY-MM-DD"', () => {
		expect(datePublishedField(makeTitleInfo({ released: '02 May 2008' }))).toEqual({ datePublished: '2008-05-02' });
	});

	it('is empty when released is the OMDb "N/A" sentinel', () => {
		expect(datePublishedField(makeTitleInfo({ released: 'N/A' }))).toEqual({});
	});

	it('is empty when released does not parse at all', () => {
		expect(datePublishedField(makeTitleInfo({ released: 'garbage' }))).toEqual({});
	});
});

describe('aggregateRatingField', () => {
	it('is empty when titleInfo is undefined', () => {
		expect(aggregateRatingField(undefined)).toEqual({});
	});

	it('is empty when imdbRating is the OMDb "N/A" sentinel', () => {
		expect(aggregateRatingField(makeTitleInfo({ imdbRating: 'N/A' }))).toEqual({});
	});

	it('builds an AggregateRating with ratingCount from a real imdbRating and imdbVotes', () => {
		expect(aggregateRatingField(makeTitleInfo({ imdbRating: '7.9', imdbVotes: '1,234,567' }))).toEqual({
			aggregateRating: {
				'@type': 'AggregateRating',
				ratingValue: 7.9,
				ratingCount: 1234567,
				bestRating: 10,
				worstRating: 1
			}
		});
	});

	it('omits ratingCount when imdbVotes is the OMDb "N/A" sentinel', () => {
		expect(aggregateRatingField(makeTitleInfo({ imdbRating: '7.9', imdbVotes: 'N/A' }))).toEqual({
			aggregateRating: { '@type': 'AggregateRating', ratingValue: 7.9, bestRating: 10, worstRating: 1 }
		});
	});
});
