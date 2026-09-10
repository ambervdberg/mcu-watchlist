import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOmdbApiKey } from './omdbKey';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('getOmdbApiKey', () => {
	it('returns the configured key', () => {
		vi.stubEnv('OMDB_API_KEY', 'test-key');

		expect(getOmdbApiKey()).toBe('test-key');
	});

	it('returns a falsy value when the key is missing', () => {
		vi.stubEnv('OMDB_API_KEY', '');

		expect(getOmdbApiKey()).toBeFalsy();
	});
});
