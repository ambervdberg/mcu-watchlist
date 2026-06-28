// HTTP implementations of the gateway ports, wired up over fetchJson. These
// are the production implementations, constructed directly by the module-level
// singletons in lib/state/{session,progress}.ts; tests and the state layer's
// own unit tests use fakes.ts instead.

import { ApiError, fetchJson } from './http';
import type {
	MeResponse,
	ProgressDto,
	ProgressGateway,
	RequestLinkRequest,
	RequestLinkResponse,
	SessionGateway
} from './ports';

/** SessionGateway backed by GET /api/me, POST /api/auth/request-link, and POST /api/logout. */
export class HttpSessionGateway implements SessionGateway {
	me(): Promise<MeResponse> {
		return fetchJson<MeResponse>('/api/me');
	}

	requestLink(request: RequestLinkRequest): Promise<RequestLinkResponse> {
		return fetchJson<RequestLinkResponse>('/api/auth/request-link', { method: 'POST', body: request });
	}

	async logout(): Promise<void> {
		await fetchJson('/api/logout', { method: 'POST' });
	}
}

/**
 * ProgressGateway backed by GET/PUT /api/progress.
 *
 * Both endpoints require an authenticated session. `load` specifically
 * intercepts a 401 ApiError and resolves to `null` (the documented anonymous
 * signal) rather than letting the rejection propagate, since "not signed in"
 * is an expected state for this gateway, not a failure.
 */
export class HttpProgressGateway implements ProgressGateway {
	async load(): Promise<ProgressDto | null> {
		try {
			return await fetchJson<ProgressDto>('/api/progress');
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				return null;
			}

			throw error;
		}
	}

	save(progress: ProgressDto): Promise<ProgressDto> {
		return fetchJson<ProgressDto>('/api/progress', { method: 'PUT', body: progress });
	}
}
