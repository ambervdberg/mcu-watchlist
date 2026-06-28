// Unit tests for the HTTP implementations of each gateway port. fetch is
// stubbed directly (rather than mocking fetchJson) so these tests also
// double as integration coverage of the real request shapes sent to the
// existing Azure Functions API.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiError } from './http';
import { HttpSessionGateway, HttpProgressGateway } from './http-gateways';

function fakeResponse(options: { ok: boolean; status: number; jsonBody?: unknown }) {
	return {
		ok: options.ok,
		status: options.status,
		json: vi.fn(async () => options.jsonBody)
	};
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('HttpSessionGateway', () => {
	it('me() GETs /api/me and returns the parsed session state', async () => {
		const body = { authenticated: true, user: { id: 'u1', email: 'a@b.com' } };
		vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: body }) as unknown as Response);

		const result = await new HttpSessionGateway().me();

		expect(fetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'GET' }));
		expect(result).toEqual(body);
	});

	it('requestLink() POSTs email and returnPath to /api/auth/request-link', async () => {
		const body = { message: 'Check your email for a sign-in link.' };
		vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: body }) as unknown as Response);

		const result = await new HttpSessionGateway().requestLink({ email: 'a@b.com', returnPath: '/title/loki' });

		expect(fetch).toHaveBeenCalledWith(
			'/api/auth/request-link',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ email: 'a@b.com', returnPath: '/title/loki' })
			})
		);
		expect(result).toEqual(body);
	});

	it('requestLink() surfaces a 400 validation error as an ApiError with the server message', async () => {
		const body = { message: 'Enter a valid email address.' };
		vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 400, jsonBody: body }) as unknown as Response);

		await expect(new HttpSessionGateway().requestLink({ email: 'not-an-email' })).rejects.toMatchObject({
			status: 400,
			body
		});
	});

	it('logout() POSTs to /api/logout and resolves with no value', async () => {
		vi.mocked(fetch).mockResolvedValue(
			fakeResponse({ ok: true, status: 200, jsonBody: { authenticated: false } }) as unknown as Response
		);

		await expect(new HttpSessionGateway().logout()).resolves.toBeUndefined();
		expect(fetch).toHaveBeenCalledWith('/api/logout', expect.objectContaining({ method: 'POST' }));
	});
});

describe('HttpProgressGateway', () => {
	it('load() GETs /api/progress and returns the parsed progress on success', async () => {
		const body = {
			watchedIds: ['iron-man'],
			skippedIds: [],
			watchedDates: { 'iron-man': '2026-01-01' },
			watchedEpisodes: {}
		};
		vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: true, status: 200, jsonBody: body }) as unknown as Response);

		const result = await new HttpProgressGateway().load();

		expect(fetch).toHaveBeenCalledWith('/api/progress', expect.objectContaining({ method: 'GET' }));
		expect(result).toEqual(body);
	});

	it('load() resolves to null (the anonymous signal) on a 401, instead of throwing', async () => {
		vi.mocked(fetch).mockResolvedValue(fakeResponse({ ok: false, status: 401, jsonBody: null }) as unknown as Response);

		const result = await new HttpProgressGateway().load();

		expect(result).toBeNull();
	});

	it('load() still rejects with an ApiError on a genuine server error (non-401 non-OK)', async () => {
		vi.mocked(fetch).mockResolvedValue(
			fakeResponse({ ok: false, status: 500, jsonBody: { message: 'Could not load progress.' } }) as unknown as Response
		);

		await expect(new HttpProgressGateway().load()).rejects.toBeInstanceOf(ApiError);
	});

	it('save() PUTs the progress shape and returns the echoed-back response', async () => {
		const progress = {
			watchedIds: ['iron-man'],
			skippedIds: [],
			watchedDates: { 'iron-man': '2026-01-01' },
			watchedEpisodes: {}
		};
		vi.mocked(fetch).mockResolvedValue(
			fakeResponse({ ok: true, status: 200, jsonBody: progress }) as unknown as Response
		);

		const result = await new HttpProgressGateway().save(progress);

		expect(fetch).toHaveBeenCalledWith(
			'/api/progress',
			expect.objectContaining({ method: 'PUT', body: JSON.stringify(progress) })
		);
		expect(result).toEqual(progress);
	});
});
