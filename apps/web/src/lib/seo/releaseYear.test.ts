import { describe, expect, it } from 'vitest';
import { extractReleaseYear } from './releaseYear';

describe('extractReleaseYear', () => {
	it('reads the year out of a "DD Mon YYYY" released date', () => {
		expect(extractReleaseYear('02 May 2008', '2008')).toBe('2008');
	});

	it('reads the year out of a "YYYY-MM-DD" released date', () => {
		expect(extractReleaseYear('2021-11-24', '2021')).toBe('2021');
	});

	it("falls back to timeline when released is OMDb's 'N/A' sentinel", () => {
		expect(extractReleaseYear('N/A', '2016-2017')).toBe('2016');
	});

	it('falls back to timeline when released is undefined', () => {
		expect(extractReleaseYear(undefined, '2016-2017')).toBe('2016');
	});

	it('skips a BC year in timeline and returns null when there is no AD year', () => {
		expect(extractReleaseYear(undefined, '1260 BC, 1200 BC, 1400 and 1896')).toBe('1400');
	});

	it('returns null when neither released nor timeline has a year', () => {
		expect(extractReleaseYear(undefined, 'unknown')).toBeNull();
	});
});
