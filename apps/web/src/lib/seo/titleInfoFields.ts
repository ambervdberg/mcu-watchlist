// Data-hygiene field builders shared by jsonLd.ts. `titleInfo` may be undefined, and its
// fields carry OMDb sentinels ('N/A', empty string, null); each builder here returns either a
// single real key or an empty object, so a caller can spread the result without ever emitting
// a junk value (undefined/null/'N/A') into JSON-LD output.

import type { TitleInfoDto } from '../api/ports';
import type { Item } from '../domain/item';

/** One optional JSON-LD field: present with a real value, or absent entirely, never `undefined`. */
type OptionalField<Key extends string, Value> = Partial<Record<Key, Value>>;

/** `description` field from `titleInfo.plot`, omitted when there is no real plot text. */
export function descriptionField(titleInfo: TitleInfoDto | undefined): OptionalField<'description', string> {
	if (!titleInfo || isMissingText(titleInfo.plot)) {
		return {};
	}

	return { description: titleInfo.plot };
}

/** `image` field from `titleInfo.poster`, omitted when there is no real poster URL. */
export function imageField(titleInfo: TitleInfoDto | undefined): OptionalField<'image', string> {
	if (!titleInfo || isMissingText(titleInfo.poster)) {
		return {};
	}

	return { image: titleInfo.poster };
}

/**
 * `duration` field as ISO 8601 (e.g. "PT96M"), from the catalog item's own runtime first,
 * else the baked title info's runtime. Omitted when neither is a known number.
 */
export function durationField(item: Item, titleInfo: TitleInfoDto | undefined): OptionalField<'duration', string> {
	const minutes = item.runtimeMinutes ?? titleInfo?.runtimeMinutes ?? null;

	if (minutes === null) {
		return {};
	}

	return { duration: `PT${minutes}M` };
}

/**
 * `datePublished` field as "YYYY-MM-DD", parsed from OMDb's "DD Mon YYYY" release date.
 * Omitted when `titleInfo` is missing or its `released` field does not parse.
 */
export function datePublishedField(titleInfo: TitleInfoDto | undefined): OptionalField<'datePublished', string> {
	const parsed = titleInfo ? parseOmdbReleased(titleInfo.released) : null;

	return parsed ? { datePublished: parsed } : {};
}

/**
 * `aggregateRating` field built from `titleInfo.imdbRating` (and `imdbVotes` as
 * `ratingCount` when real), omitted when the rating itself is missing or not a finite number.
 */
export function aggregateRatingField(
	titleInfo: TitleInfoDto | undefined
): OptionalField<'aggregateRating', Record<string, unknown>> {
	const ratingValue = titleInfo ? Number(titleInfo.imdbRating) : NaN;

	if (!Number.isFinite(ratingValue)) {
		return {};
	}

	const ratingCount = titleInfo ? parseVoteCount(titleInfo.imdbVotes) : null;

	return {
		aggregateRating: {
			'@type': 'AggregateRating',
			ratingValue,
			...(ratingCount === null ? {} : { ratingCount }),
			bestRating: 10,
			worstRating: 1
		}
	};
}

/** Parses OMDb's "1,234,567"-style vote count into a number, or null when not a real count. */
function parseVoteCount(imdbVotes: string): number | null {
	const votes = Number(imdbVotes.replace(/,/g, ''));

	return Number.isFinite(votes) && votes > 0 ? votes : null;
}

/** OMDb's sentinel for a field it has no value for; treated the same as an empty string. */
function isMissingText(value: string): boolean {
	return value === '' || value === 'N/A';
}

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses OMDb's "DD Mon YYYY" release date (e.g. "02 May 2008") into "YYYY-MM-DD". */
function parseOmdbReleased(released: string): string | null {
	const match = new RegExp(/^(\d{2}) (\w{3}) (\d{4})$/).exec(released);

	if (!match) {
		return null;
	}

	const [, day, monthName, year] = match;
	const monthIndex = MONTH_ABBREVIATIONS.indexOf(monthName);

	return monthIndex === -1 ? null : `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
}
