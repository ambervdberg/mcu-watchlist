// Progress store: holds the signed-in visitor's watch progress (domain/progress.ts's
// `Progress` shape) and exposes the toggle actions the UI calls.
//
// This store owns the one place that converts between the domain's presence-map shape
// (`Record<string, true>`, `Record<string, string[]>`) and the API's array-based
// `ProgressDto` (see api/ports.ts). Nothing outside this file should need to know both
// shapes exist.
//
// Every toggle is "optimistic local update via the pure domain function, then persist":
// the domain layer (progress.ts) computes the next Progress synchronously so the UI
// reacts immediately, and the mapped DTO is saved to the gateway afterwards. If saving
// fails, the error propagates to the caller (UI) to surface, but the local optimistic
// state is intentionally left in place per the spec's "optimistic update" framing rather
// than rolled back, since a rollback heuristic is out of scope.
//
// Anonymous gating: toggling progress requires a session. Rather than attempt the
// mutation and fail, each toggle method checks `session.isAuthenticated` first and, if
// false, calls `session.openSignIn()` instead of touching local state or the gateway at
// all -- this matches the spec's "anonymous -> open sign-in" rule precisely (no partial
// optimistic update happens for an anonymous visitor).

import { atom } from 'nanostores';
import { createEmptyProgress, setSkipped, setWatched, setWatchedEpisodes, type Progress } from '../domain/progress';
import { emptyProgress, FakeProgressGateway } from '../api/fakes';
import { HttpProgressGateway } from '../api/http-gateways';
import type { ProgressDto, ProgressGateway } from '../api/ports';
import { sessionStore, type SessionStore } from './session';

/** Converts the API's array-based ProgressDto into the domain's presence-map Progress. */
function dtoToDomain(dto: ProgressDto): Progress {
	return {
		watchedIds: toPresenceMap(dto.watchedIds),
		skippedIds: toPresenceMap(dto.skippedIds),
		watchedDates: { ...dto.watchedDates },
		watchedEpisodes: { ...dto.watchedEpisodes }
	};
}

/** Converts the domain's presence-map Progress back into the API's array-based ProgressDto. */
function domainToDto(progress: Progress): ProgressDto {
	return {
		watchedIds: Object.keys(progress.watchedIds),
		skippedIds: Object.keys(progress.skippedIds),
		watchedDates: { ...progress.watchedDates },
		watchedEpisodes: { ...progress.watchedEpisodes }
	};
}

/** Builds a `Record<string, true>` presence map from an array of ids. */
function toPresenceMap(ids: string[]): Record<string, true> {
	const map: Record<string, true> = {};
	for (const id of ids) {
		map[id] = true;
	}
	return map;
}

/** Today's date as "YYYY-MM-DD", in the visitor's local timezone, for stamping watchedDates. */
function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/** The store shape returned by `createProgressStore`: the progress atom plus the toggle actions. */
export interface ProgressStore {
	/** The signed-in visitor's progress. Starts empty (anonymous-safe); see module doc. */
	progress: ReturnType<typeof atom<Progress>>;

	/**
	 * Loads progress from the server. A `null` result (the gateway's documented signal
	 * for the API's 401-when-anonymous response) is treated as "no progress yet", not an
	 * error: `progress` simply stays at its empty default. Called once by the progress-
	 * owning island on client mount, after the session store's own `init()` has resolved.
	 */
	load(): Promise<void>;

	/**
	 * Toggles whether `itemId` is marked watched, applying the watched/skipped
	 * mutual-exclusion invariant (domain/progress.ts's setWatched). Stamps today's date
	 * when marking watched. No-ops (other than opening sign-in) for an anonymous visitor.
	 */
	toggleWatched(itemId: string): Promise<void>;

	/**
	 * Toggles whether `itemId` is marked skipped, applying the watched/skipped
	 * mutual-exclusion invariant (domain/progress.ts's setSkipped). No-ops (other than
	 * opening sign-in) for an anonymous visitor.
	 */
	toggleSkipped(itemId: string): Promise<void>;

	/**
	 * Toggles whether `episodeId` (within series `seriesId`) is marked watched, given the
	 * full set of `allEpisodeIds` for that series/season so the next watched-episode array
	 * can be computed by simple set membership. No-ops (other than opening sign-in) for an
	 * anonymous visitor.
	 */
	toggleEpisodeWatched(seriesId: string, episodeId: string, allEpisodeIds: readonly string[]): Promise<void>;

	/** Whether `itemId` is currently marked watched. Convenience read used by toggleWatched and the UI. */
	isWatched(itemId: string): boolean;

	/** Whether `itemId` is currently marked skipped. Convenience read used by toggleSkipped and the UI. */
	isSkipped(itemId: string): boolean;

	/**
	 * Resets local progress back to empty. Called by the session-owning island right after a
	 * successful logout -- without this, the previous visitor's watched/skipped/episode data
	 * would keep rendering (cards, detail page, episode rows) for the rest of the page's
	 * lifetime, since logging out only clears the session store's own `currentUser`.
	 */
	clear(): void;
}

/**
 * Builds a ProgressStore wired to `gateway` and `session`. `session` is consulted to gate
 * toggles behind authentication and to open the sign-in panel for an anonymous toggle
 * attempt. Production uses the `progressStore` singleton below; tests build their own with
 * fakes (api/fakes.ts) and an isolated SessionStore instance.
 */
export function createProgressStore(gateway: ProgressGateway, session: SessionStore): ProgressStore {
	const progress = atom<Progress>(createEmptyProgress());

	async function load(): Promise<void> {
		const dto = await gateway.load();
		progress.set(dto === null ? createEmptyProgress() : dtoToDomain(dto));
	}

	function isWatched(itemId: string): boolean {
		return progress.get().watchedIds[itemId] === true;
	}

	function isSkipped(itemId: string): boolean {
		return progress.get().skippedIds[itemId] === true;
	}

	/** Persists the current in-memory progress to the gateway, mapped to the DTO shape. */
	async function persist(): Promise<void> {
		await gateway.save(domainToDto(progress.get()));
	}

	async function toggleWatched(itemId: string): Promise<void> {
		if (!session.isAuthenticated.get()) {
			session.openSignIn();
			return;
		}

		const nextWatched = !isWatched(itemId);
		progress.set(setWatched(progress.get(), itemId, nextWatched, todayIsoDate()));
		await persist();
	}

	async function toggleSkipped(itemId: string): Promise<void> {
		if (!session.isAuthenticated.get()) {
			session.openSignIn();
			return;
		}

		const nextSkipped = !isSkipped(itemId);
		progress.set(setSkipped(progress.get(), itemId, nextSkipped));
		await persist();
	}

	async function toggleEpisodeWatched(
		seriesId: string,
		episodeId: string,
		allEpisodeIds: readonly string[]
	): Promise<void> {
		if (!session.isAuthenticated.get()) {
			session.openSignIn();
			return;
		}

		const currentEpisodes = progress.get().watchedEpisodes[seriesId] ?? [];
		const isCurrentlyWatched = currentEpisodes.includes(episodeId);

		const nextEpisodes = isCurrentlyWatched
			? currentEpisodes.filter((id) => id !== episodeId)
			: allEpisodeIds.filter((id) => currentEpisodes.includes(id) || id === episodeId);

		const allWatched = nextEpisodes.length === allEpisodeIds.length;
		const seriesCurrentlyWatched = isWatched(seriesId);
		let next = setWatchedEpisodes(progress.get(), seriesId, nextEpisodes);

		// Auto-check series when all episodes watched; auto-uncheck when any episode unchecked.
		if (allWatched && !seriesCurrentlyWatched) {
			next = setWatched(next, seriesId, true, todayIsoDate());
		} else if (!allWatched && seriesCurrentlyWatched) {
			next = setWatched(next, seriesId, false, todayIsoDate());
		}

		progress.set(next);
		await persist();
	}

	function clear(): void {
		progress.set(createEmptyProgress());
	}

	return { progress, load, toggleWatched, toggleSkipped, toggleEpisodeWatched, isWatched, isSkipped, clear };
}

/**
 * Picks the progress gateway for the production singleton below. Mirrors session.ts's
 * `buildSessionGateway`: under the same `PUBLIC_FAKE_LOGIN=true` dev opt-in, toggles persist
 * to an in-memory FakeProgressGateway instead of the real `/api/progress` endpoint, which
 * has no local backend to hit when only `astro dev` (not the full SWA emulator) is running.
 */
function buildProgressGateway(): ProgressGateway {
	if (import.meta.env.DEV && import.meta.env.PUBLIC_FAKE_LOGIN === 'true') {
		const fake = new FakeProgressGateway();
		fake.stored = emptyProgress();
		return fake;
	}

	return new HttpProgressGateway();
}

/** The production progress store, wired to the real HTTP gateway (or a fake one, see buildProgressGateway) and the production session store. */
export const progressStore = createProgressStore(buildProgressGateway(), sessionStore);
