import { describe, it, expect } from 'vitest';
import { items } from './items';
import { isItem } from '$lib/domain/item';

describe('items catalog', () => {
	it('should be non-empty', () => {
		expect(items.length).toBeGreaterThan(0);
	});

	it('every entry should pass the isItem type guard', () => {
		items.forEach((item) => {
			expect(isItem(item)).toBe(true);
		});
	});

	it('should have unique IDs', () => {
		const ids = items.map((item) => item.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});
});
