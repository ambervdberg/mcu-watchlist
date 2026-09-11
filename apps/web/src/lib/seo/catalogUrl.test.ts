import { describe, expect, it } from 'vitest';
import { homeUrl, titleUrl } from './catalogUrl';

describe('homeUrl', () => {
	it('appends a trailing slash to a base URL that has none', () => {
		expect(homeUrl('https://example.com')).toBe('https://example.com/');
	});

	it('does not double a trailing slash already present on the base URL', () => {
		expect(homeUrl('https://example.com/')).toBe('https://example.com/');
	});
});

describe('titleUrl', () => {
	it('builds a /title/<id>/ URL under the base URL', () => {
		expect(titleUrl('https://example.com', 'iron-man')).toBe('https://example.com/title/iron-man/');
	});

	it('does not double a trailing slash already present on the base URL', () => {
		expect(titleUrl('https://example.com/', 'iron-man')).toBe('https://example.com/title/iron-man/');
	});
});
