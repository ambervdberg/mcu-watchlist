import { describe, expect, it } from 'vitest';
import { requireSiteUrl } from './siteUrl';

describe('requireSiteUrl', () => {
	it('returns the URL unchanged when site is set', () => {
		const site = new URL('https://example.com');

		expect(requireSiteUrl(site)).toBe(site);
	});

	it('throws when site is undefined', () => {
		expect(() => requireSiteUrl(undefined)).toThrow('astro.config.mjs must set `site`');
	});
});
