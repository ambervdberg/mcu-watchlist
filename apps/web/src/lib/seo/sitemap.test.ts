import { describe, expect, it } from 'vitest';
import type { Item } from '../domain/item';
import { buildSitemapXml } from './sitemap';

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

describe('buildSitemapXml', () => {
	it('includes a url entry for the home page', () => {
		const xml = buildSitemapXml([], BASE_URL);

		expect(xml).toContain('<loc>https://example.com/</loc>');
	});

	it('includes a lastmod date for every url', () => {
		const xml = buildSitemapXml([makeItem()], BASE_URL);
		const today = new Date().toISOString().slice(0, 10);

		expect(xml.match(/<lastmod>/g)).toHaveLength(2);
		expect(xml).toContain(`<lastmod>${today}</lastmod>`);
	});

	it('includes one url entry per catalog item, in catalog order', () => {
		const items = [makeItem({ id: 'iron-man' }), makeItem({ id: 'iron-man-2' })];
		const xml = buildSitemapXml(items, BASE_URL);

		const ironManIndex = xml.indexOf('<loc>https://example.com/title/iron-man/</loc>');
		const ironMan2Index = xml.indexOf('<loc>https://example.com/title/iron-man-2/</loc>');

		expect(ironManIndex).toBeGreaterThan(-1);
		expect(ironMan2Index).toBeGreaterThan(ironManIndex);
	});

	it('produces a valid urlset document', () => {
		const xml = buildSitemapXml([makeItem()], BASE_URL);

		expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml.trim()).toMatch(/<\/urlset>$/);
	});

	it('XML-escapes special characters in item ids', () => {
		const xml = buildSitemapXml([makeItem({ id: 'a&b' })], BASE_URL);

		expect(xml).toContain('a&amp;b');
		expect(xml).not.toContain('<loc>https://example.com/title/a&b/</loc>');
	});

	it('is deterministic for the same input', () => {
		const items = [makeItem({ id: 'iron-man' }), makeItem({ id: 'iron-man-2' })];

		expect(buildSitemapXml(items, BASE_URL)).toBe(buildSitemapXml(items, BASE_URL));
	});
});
