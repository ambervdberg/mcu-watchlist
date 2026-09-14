// FAQ copy for the catalog page. Single source for both the visible Faq.astro section and the
// FAQPage JSON-LD (jsonLd.ts): a fact changes here once, in both places at once.

import type { Item } from '../domain/item';

const ESSENTIAL_FILTER_LABEL = 'Essential only';

/** One FAQ question/answer pair. */
export interface FaqEntry {
	question: string;
	answer: string;
}

/** Builds the catalog page's FAQ entries, with the first item read from `items`. */
export function buildFaqEntries(items: readonly Item[]): FaqEntry[] {
	const firstItem = items[0];

	return [
		{
			question: 'What order should I watch the Marvel movies in?',
			answer:
				'There are two common orders. Release order follows the dates the films came out, starting with ' +
				`Iron Man (2008). Chronological order follows the story timeline, starting with ${firstItem.title}, ` +
				'set long before Iron Man. This site lists the chronological order.'
		},
		{
			question: 'What is the difference between release order and chronological order?',
			answer:
				'Release order sorts by release date. Chronological order sorts by when the story happens. Same films ' +
				'and shows, different order. Chronological order moves prequels like Captain Marvel (1995) and Captain ' +
				'America: The First Avenger (1940s) to the front.'
		},
		{
			question: 'Do I need to watch everything?',
			answer: `No. Turn on the ${ESSENTIAL_FILTER_LABEL} filter to see only the entries that matter for the main story.`
		}
	];
}
