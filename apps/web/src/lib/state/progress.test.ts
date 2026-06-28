// Tests for createProgressStore() using FakeProgressGateway/FakeSessionGateway
// (src/lib/api/fakes.ts) instead of real network calls. Covers: anonymous load,
// authenticated toggles persisting mapped arrays, the watched/skipped mutual-exclusion
// invariant flowing through to the gateway, anonymous toggles opening sign-in instead of
// saving, and DTO<->domain round-trips.

import { describe, expect, it } from 'vitest';
import { FakeProgressGateway, FakeSessionGateway } from '../api/fakes';
import type { ProgressDto } from '../api/ports';
import { createSessionStore, type SessionStore } from './session';
import { createProgressStore, type ProgressStore } from './progress';

/**
 * Builds a ProgressStore backed by fakes, with the session already hydrated as signed in.
 * Calls `session.init()` so `isAuthenticated` reflects the seeded gateway user (setting
 * `gateway.currentUser` alone is not enough; the store only reads it back via `init()`).
 */
type AuthenticatedStoreFixture = { store: ProgressStore; gateway: FakeProgressGateway; session: SessionStore };

async function authenticatedStore(): Promise<AuthenticatedStoreFixture> {
	const sessionGateway = new FakeSessionGateway();
	sessionGateway.currentUser = { id: 'u1', email: 'a@b.com' };
	const session = createSessionStore(sessionGateway);
	await session.init();

	const gateway = new FakeProgressGateway();
	const store = createProgressStore(gateway, session);

	return { store, gateway, session };
}

describe('createProgressStore()', () => {
	it('starts with empty progress synchronously (anonymous-safe default)', async () => {
		const { store } = await authenticatedStore();

		expect(store.progress.get().watchedIds).toEqual({});
		expect(store.progress.get().skippedIds).toEqual({});
	});

	describe('load()', () => {
		it('leaves progress empty when the gateway resolves null (anonymous/no-progress, not an error)', async () => {
			const { store } = await authenticatedStore();

			await expect(store.load()).resolves.toBeUndefined();

			expect(store.progress.get().watchedIds).toEqual({});
		});

		it('maps a loaded ProgressDto (arrays) into the domain Progress shape (presence maps)', async () => {
			const { store, gateway } = await authenticatedStore();
			const dto: ProgressDto = {
				watchedIds: ['iron-man'],
				skippedIds: ['thor'],
				watchedDates: { 'iron-man': '2026-01-01' },
				watchedEpisodes: { loki: ['s1e1'] }
			};
			gateway.stored = dto;

			await store.load();

			expect(store.progress.get().watchedIds).toEqual({ 'iron-man': true });
			expect(store.progress.get().skippedIds).toEqual({ thor: true });
			expect(store.progress.get().watchedDates).toEqual({ 'iron-man': '2026-01-01' });
			expect(store.progress.get().watchedEpisodes).toEqual({ loki: ['s1e1'] });
		});
	});

	describe('toggleWatched()', () => {
		it('when authenticated: marks watched, stamps a date, and persists mapped arrays to the gateway', async () => {
			const { store, gateway } = await authenticatedStore();

			await store.toggleWatched('iron-man');

			expect(store.isWatched('iron-man')).toBe(true);
			expect(store.progress.get().watchedDates['iron-man']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(gateway.stored?.watchedIds).toEqual(['iron-man']);
		});

		it('clears skipped when marking watched (mutual exclusion invariant), and persists that too', async () => {
			const { store, gateway } = await authenticatedStore();
			await store.toggleSkipped('iron-man');

			await store.toggleWatched('iron-man');

			expect(store.isSkipped('iron-man')).toBe(false);
			expect(store.isWatched('iron-man')).toBe(true);
			expect(gateway.stored?.skippedIds).toEqual([]);
			expect(gateway.stored?.watchedIds).toEqual(['iron-man']);
		});

		it('toggling watched again unmarks it and clears the stamped date, persisting the removal', async () => {
			const { store, gateway } = await authenticatedStore();
			await store.toggleWatched('iron-man');

			await store.toggleWatched('iron-man');

			expect(store.isWatched('iron-man')).toBe(false);
			expect(store.progress.get().watchedDates['iron-man']).toBeUndefined();
			expect(gateway.stored?.watchedIds).toEqual([]);
		});

		it('when anonymous: opens sign-in instead of mutating progress or calling the gateway', async () => {
			const sessionGateway = new FakeSessionGateway();
			const session = createSessionStore(sessionGateway);
			const gateway = new FakeProgressGateway();
			const store = createProgressStore(gateway, session);

			await store.toggleWatched('iron-man');

			expect(session.signInOpen.get()).toBe(true);
			expect(store.isWatched('iron-man')).toBe(false);
			expect(gateway.stored).toBeNull();
		});
	});

	describe('toggleSkipped()', () => {
		it('when authenticated: marks skipped and persists', async () => {
			const { store, gateway } = await authenticatedStore();

			await store.toggleSkipped('thor');

			expect(store.isSkipped('thor')).toBe(true);
			expect(gateway.stored?.skippedIds).toEqual(['thor']);
		});

		it('when anonymous: opens sign-in instead of mutating progress or calling the gateway', async () => {
			const sessionGateway = new FakeSessionGateway();
			const session = createSessionStore(sessionGateway);
			const gateway = new FakeProgressGateway();
			const store = createProgressStore(gateway, session);

			await store.toggleSkipped('thor');

			expect(session.signInOpen.get()).toBe(true);
			expect(store.isSkipped('thor')).toBe(false);
			expect(gateway.stored).toBeNull();
		});
	});

	describe('toggleEpisodeWatched()', () => {
		it('adds the episode id to watchedEpisodes for the series and persists it', async () => {
			const { store, gateway } = await authenticatedStore();

			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1', 's1e2']);

			expect(store.progress.get().watchedEpisodes.loki).toEqual(['s1e1']);
			expect(gateway.stored?.watchedEpisodes).toEqual({ loki: ['s1e1'] });
		});

		it('removes the episode id when toggled again, dropping the series entry once empty', async () => {
			const { store, gateway } = await authenticatedStore();
			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1', 's1e2']);

			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1', 's1e2']);

			expect(store.progress.get().watchedEpisodes.loki).toBeUndefined();
			expect(gateway.stored?.watchedEpisodes).toEqual({});
		});

		it('preserves existing watched episodes in the series when adding another', async () => {
			const { store } = await authenticatedStore();
			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1', 's1e2', 's1e3']);

			await store.toggleEpisodeWatched('loki', 's1e2', ['s1e1', 's1e2', 's1e3']);

			expect(store.progress.get().watchedEpisodes.loki).toEqual(['s1e1', 's1e2']);
		});

		it('when anonymous: opens sign-in instead of mutating progress or calling the gateway', async () => {
			const sessionGateway = new FakeSessionGateway();
			const session = createSessionStore(sessionGateway);
			const gateway = new FakeProgressGateway();
			const store = createProgressStore(gateway, session);

			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1']);

			expect(session.signInOpen.get()).toBe(true);
			expect(store.progress.get().watchedEpisodes.loki).toBeUndefined();
			expect(gateway.stored).toBeNull();
		});
	});

	describe('DTO <-> domain mapping round-trip', () => {
		it('round-trips watched/skipped/dates/episodes through save() and load()', async () => {
			const { store, gateway } = await authenticatedStore();

			await store.toggleWatched('iron-man');
			await store.toggleSkipped('thor');
			await store.toggleEpisodeWatched('loki', 's1e1', ['s1e1']);

			// Simulate a fresh store re-loading the same persisted state.
			const reloaded = createProgressStore(gateway, createSessionStore(new FakeSessionGateway()));
			await reloaded.load();

			expect(reloaded.progress.get().watchedIds).toEqual(store.progress.get().watchedIds);
			expect(reloaded.progress.get().skippedIds).toEqual(store.progress.get().skippedIds);
			expect(reloaded.progress.get().watchedDates).toEqual(store.progress.get().watchedDates);
			expect(reloaded.progress.get().watchedEpisodes).toEqual(store.progress.get().watchedEpisodes);
		});
	});
});
