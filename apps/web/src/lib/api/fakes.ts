// In-memory implementations of every gateway port, for use in tests (and by
// the state layer's own unit tests, per spec section 6) without touching a
// real network. Each fake keeps a small amount of mutable state plus a
// `seed`/inspection surface so tests can arrange data and assert on calls
// without re-mocking fetch in every consuming test file.
//
// Also reused outside tests: state/session.ts and state/progress.ts swap these in for
// their production singletons under the `PUBLIC_FAKE_LOGIN=true` local-dev opt-in, since
// real auth needs a `Secure` cookie that only works over HTTPS against a deployed SWA.

import type {
	MeResponse,
	ProgressDto,
	ProgressGateway,
	RequestLinkRequest,
	RequestLinkResponse,
	SessionGateway
} from './ports';

/** A neutral, empty progress shape, used both as the FakeProgressGateway's pre-save fallback and as a test fixture. */
export function emptyProgress(): ProgressDto {
	return {
		watchedIds: [],
		skippedIds: [],
		watchedDates: {},
		watchedEpisodes: {}
	};
}

/**
 * In-memory SessionGateway. `currentUser` is public so tests can set up a
 * signed-in state directly, and `requestedLinks` records every requestLink
 * call so tests can assert on what was sent without a real email going out.
 */
export class FakeSessionGateway implements SessionGateway {
	currentUser: { id: string; email: string } | null = null;
	requestedLinks: RequestLinkRequest[] = [];

	async me(): Promise<MeResponse> {
		if (!this.currentUser) {
			return { authenticated: false };
		}

		return { authenticated: true, user: this.currentUser };
	}

	async requestLink(request: RequestLinkRequest): Promise<RequestLinkResponse> {
		this.requestedLinks.push(request);
		return { message: 'Check your email for a sign-in link.' };
	}

	async logout(): Promise<void> {
		this.currentUser = null;
	}
}

/**
 * In-memory ProgressGateway. `load()` resolves to `null` (the documented
 * anonymous signal) until either `save()` has been called or a test seeds
 * `stored` directly, matching the real HttpProgressGateway's behaviour for
 * an anonymous visitor.
 */
export class FakeProgressGateway implements ProgressGateway {
	stored: ProgressDto | null = null;

	async load(): Promise<ProgressDto | null> {
		return this.stored;
	}

	async save(progress: ProgressDto): Promise<ProgressDto> {
		this.stored = progress;
		return progress;
	}
}
