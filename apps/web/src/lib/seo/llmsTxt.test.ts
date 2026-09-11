import { describe, expect, it } from 'vitest';
import type { Item } from '../domain/item';
import { buildLlmsTxt } from './llmsTxt';

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

const BASE_URL = 'https://example.com';

describe('buildLlmsTxt', () => {
	it('starts with an "# " title line followed by a "> " summary line', () => {
		const text = buildLlmsTxt([], BASE_URL);
		const lines = text.split('\n');

		expect(lines[0]).toMatch(/^# .+/);
		expect(lines[2]).toMatch(/^> .+/);
	});

	it('groups items into one "## <era>" section per era, in catalog order', () => {
		const items = [
			makeItem({ id: 'iron-man', era: '2008-2012' }),
			makeItem({ id: 'thor', title: 'Thor', era: '2013-2015' }),
			makeItem({ id: 'iron-man-2', title: 'Iron Man 2', era: '2008-2012' })
		];
		const text = buildLlmsTxt(items, BASE_URL);

		const firstEraIndex = text.indexOf('## 2008-2012');
		const secondEraIndex = text.indexOf('## 2013-2015');

		expect(firstEraIndex).toBeGreaterThan(-1);
		expect(secondEraIndex).toBeGreaterThan(firstEraIndex);
		expect(text).toContain('## 2008-2012');
		// Both 2008-2012 items land under the same, single section heading.
		expect(text.match(/## 2008-2012/g)).toHaveLength(1);
	});

	it('lists each item as a markdown link with type and timeline', () => {
		const text = buildLlmsTxt([makeItem()], BASE_URL);

		expect(text).toContain('- [Iron Man](https://example.com/title/iron-man/): Movie, timeline 2008');
	});

	it('is deterministic for the same input', () => {
		const items = [makeItem({ id: 'iron-man' }), makeItem({ id: 'thor', title: 'Thor', era: '2013-2015' })];

		expect(buildLlmsTxt(items, BASE_URL)).toBe(buildLlmsTxt(items, BASE_URL));
	});
});
