import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTmdbApiKey } from './tmdbKey';

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('getTmdbApiKey', () => {
	it('returns the configured key', () => {
		vi.stubEnv('TMDB_API_KEY', 'test-key');

		expect(getTmdbApiKey()).toBe('test-key');
	});

	it('throws a clear error when the key is missing', () => {
		vi.stubEnv('TMDB_API_KEY', '');

		expect(() => getTmdbApiKey()).toThrow('TMDB_API_KEY is not configured.');
	});
});
