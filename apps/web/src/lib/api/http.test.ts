// Unit tests for the fetchJson helper and ApiError shape, written before the
// implementation (TDD red phase). global.fetch is stubbed per-test with vi.fn.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, fetchJson } from './http';

// A minimal stand-in for the subset of the Fetch Response API that fetchJson
// actually touches: `ok`, `status`, and `json()`. Building a real Response
// object would drag in Node's undici types for no benefit here.
function fakeResponse(options: { ok: boolean; status: number; jsonBody?: unknown; jsonThrows?: boolean }) {
	return {
		ok: options.ok,
		status: options.status,
		json: vi.fn(async () => {
			if (options.jsonThrows) {
				throw new SyntaxError('Unexpected end of JSON input');
			}
			return options.jsonBody;
		})
	};
}

describe('fetchJson', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns the parsed JSON body on a successful response', async () => {
		const response = fakeResponse({ ok: true, status: 200, jsonBody: { hello: 'world' } });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		const result = await fetchJson('/api/me');

		expect(result).toEqual({ hello: 'world' });
	});

	it('always sends credentials: same-origin so the session cookie is included', async () => {
		const response = fakeResponse({ ok: true, status: 200, jsonBody: {} });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		await fetchJson('/api/me');

		expect(fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'same-origin' }));
	});

	it('serializes a JSON request body and sets the Content-Type header', async () => {
		const response = fakeResponse({ ok: true, status: 200, jsonBody: { ok: true } });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		await fetchJson('/api/progress', { method: 'PUT', body: { watchedIds: ['a'] } });

		expect(fetch).toHaveBeenCalledWith(
			'/api/progress',
			expect.objectContaining({
				method: 'PUT',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ watchedIds: ['a'] })
			})
		);
	});

	it('throws an ApiError carrying the HTTP status and parsed body on a non-OK response', async () => {
		const response = fakeResponse({ ok: false, status: 400, jsonBody: { message: 'Enter a valid email address.' } });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		await expect(fetchJson('/api/auth/request-link')).rejects.toMatchObject({
			status: 400,
			body: { message: 'Enter a valid email address.' }
		});
	});

	it('is an instance of both ApiError and Error so callers can catch either', async () => {
		const response = fakeResponse({ ok: false, status: 401, jsonBody: null });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		try {
			await fetchJson('/api/progress');
			expect.unreachable('fetchJson should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(ApiError);
			expect(error).toBeInstanceOf(Error);
		}
	});

	it('tolerates an empty or non-JSON error body instead of throwing while parsing it', async () => {
		const response = fakeResponse({ ok: false, status: 500, jsonThrows: true });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		await expect(fetchJson('/api/episodes')).rejects.toMatchObject({ status: 500, body: null });
	});

	it('tolerates an empty or non-JSON success body by resolving with null', async () => {
		const response = fakeResponse({ ok: true, status: 200, jsonThrows: true });
		vi.mocked(fetch).mockResolvedValue(response as unknown as Response);

		const result = await fetchJson('/api/logout', { method: 'POST' });

		expect(result).toBeNull();
	});
});

describe('ApiError', () => {
	it('stores the message, status, and body it was constructed with', () => {
		const error = new ApiError('GET /api/me failed with 500', 500, { message: 'boom' });

		expect(error.message).toBe('GET /api/me failed with 500');
		expect(error.status).toBe(500);
		expect(error.body).toEqual({ message: 'boom' });
	});
});
