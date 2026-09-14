import { describe, expect, it } from 'vitest';
import type { Item } from '../domain/item';
import { buildFaqEntries } from './faq';

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

describe('buildFaqEntries', () => {
	it('returns three entries, each with a question and an answer', () => {
		const entries = buildFaqEntries([makeItem()]);

		expect(entries).toHaveLength(3);
		for (const entry of entries) {
			expect(entry.question.length).toBeGreaterThan(0);
			expect(entry.answer.length).toBeGreaterThan(0);
		}
	});

	it('names the first catalog item in the order-explainer answer', () => {
		const items = [
			makeItem({ id: 'eyes-of-wakanda', title: 'Eyes of Wakanda', timeline: '1260 BC, 1200 BC, 1400 and 1896' }),
			makeItem()
		];

		const entries = buildFaqEntries(items);

		expect(entries[0].answer).toContain('starting with Eyes of Wakanda, set long before Iron Man');
	});

	it('names the essential filter in the "watch everything" answer', () => {
		const entries = buildFaqEntries([makeItem()]);

		expect(entries[2].answer).toContain('Essential only');
	});
});
