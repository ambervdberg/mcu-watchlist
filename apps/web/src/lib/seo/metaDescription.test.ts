import { describe, expect, it } from 'vitest';
import { buildTitleMetaDescription } from './metaDescription';

const LEAD = 'Iron Man in the Marvel watch order.';
const FALLBACK = 'Iron Man (2008) in the MCU chronological watch order.';

describe('buildTitleMetaDescription', () => {
	it('returns the fallback when plot is undefined', () => {
		expect(buildTitleMetaDescription(LEAD, undefined, FALLBACK)).toBe(FALLBACK);
	});

	it("returns the fallback when plot is OMDb's 'N/A' sentinel", () => {
		expect(buildTitleMetaDescription(LEAD, 'N/A', FALLBACK)).toBe(FALLBACK);
	});

	it('prefixes the lead to a plot that fits within the length limit', () => {
		const plot = 'A rich playboy builds a suit of armor to fight evil.';

		expect(buildTitleMetaDescription(LEAD, plot, FALLBACK)).toBe(`${LEAD} ${plot}`);
	});

	it('cuts a long plot at the last sentence end within the limit, no ellipsis added', () => {
		const firstSentence = 'A genius inventor is captured and forced to build a devastating weapon of mass destruction.';
		const filler = ` ${'x'.repeat(100)}`;
		const plot = firstSentence + filler;

		expect(buildTitleMetaDescription(LEAD, plot, FALLBACK)).toBe(`${LEAD} ${firstSentence}`);
	});

	it('cuts a long plot with no early sentence end at the last word boundary, adds an ellipsis', () => {
		const plot =
			'A genius inventor billionaid playboy philanthropist builds increasingly ' +
			'sophisticated suits of armor after escaping captivity in a cave with a box of scraps ' +
			'and years of unresolved family trauma driving every decision he makes from that day on';

		const result = buildTitleMetaDescription(LEAD, plot, FALLBACK);
		const snippet = result.slice(LEAD.length + 1, -1);

		expect(result.length).toBeLessThanOrEqual(156);
		expect(result.startsWith(`${LEAD} `)).toBe(true);
		expect(result.endsWith('…')).toBe(true);
		expect(plot.startsWith(snippet)).toBe(true);
	});
});
