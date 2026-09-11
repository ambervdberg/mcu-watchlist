import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './jsonLdScript';

describe('serializeJsonLd', () => {
	it('escapes a "</script>" sequence in a plot value', () => {
		const value = { plot: 'Evil</script><script>alert(1)</script>' };
		const serialized = serializeJsonLd(value);

		expect(serialized).not.toContain('</script>');
		expect(serialized).toContain('\\u003c/script>');
	});

	it('escapes a "<!--" sequence in a title value', () => {
		const value = { title: 'Marvel<!-- comment -->Movie' };
		const serialized = serializeJsonLd(value);

		expect(serialized).not.toContain('<!--');
	});

	it('round-trips through JSON.parse back to the original value', () => {
		const value = { plot: 'Evil</script> plan', title: 'Marvel<!--x-->Movie' };
		const serialized = serializeJsonLd(value);

		expect(JSON.parse(serialized)).toEqual(value);
	});
});
