// Verifies the in-memory fakes both satisfy their port interfaces (a compile-time
// check enforced by the type annotations below) and behave sensibly at runtime,
// since the state layer's own tests (marvel-n4n.5) will depend on these fakes
// rather than re-mocking fetch themselves.

import { describe, expect, it } from 'vitest';
import type { ProgressDto, ProgressGateway, SessionGateway } from './ports';
import { FakeProgressGateway, FakeSessionGateway } from './fakes';

describe('fakes satisfy their port interfaces', () => {
	it('FakeSessionGateway is assignable to SessionGateway', () => {
		const gateway: SessionGateway = new FakeSessionGateway();
		expect(gateway).toBeInstanceOf(FakeSessionGateway);
	});

	it('FakeProgressGateway is assignable to ProgressGateway', () => {
		const gateway: ProgressGateway = new FakeProgressGateway();
		expect(gateway).toBeInstanceOf(FakeProgressGateway);
	});
});

describe('FakeSessionGateway', () => {
	it('defaults to anonymous and reflects a manually set signed-in user', async () => {
		const gateway = new FakeSessionGateway();

		await expect(gateway.me()).resolves.toEqual({ authenticated: false });

		gateway.currentUser = { id: 'u1', email: 'a@b.com' };

		await expect(gateway.me()).resolves.toEqual({ authenticated: true, user: { id: 'u1', email: 'a@b.com' } });
	});

	it('records requestLink calls for assertions without sending real email', async () => {
		const gateway = new FakeSessionGateway();

		await gateway.requestLink({ email: 'a@b.com', returnPath: '/title/loki' });

		expect(gateway.requestedLinks).toEqual([{ email: 'a@b.com', returnPath: '/title/loki' }]);
	});

	it('logout clears the current user', async () => {
		const gateway = new FakeSessionGateway();
		gateway.currentUser = { id: 'u1', email: 'a@b.com' };

		await gateway.logout();

		await expect(gateway.me()).resolves.toEqual({ authenticated: false });
	});
});

describe('FakeProgressGateway', () => {
	it('defaults load() to null, the anonymous signal, until progress is seeded or saved', async () => {
		const gateway = new FakeProgressGateway();

		await expect(gateway.load()).resolves.toBeNull();
	});

	it('save() stores progress so a subsequent load() returns it', async () => {
		const gateway = new FakeProgressGateway();
		const progress: ProgressDto = {
			watchedIds: ['iron-man'],
			skippedIds: [],
			watchedDates: { 'iron-man': '2026-01-01' },
			watchedEpisodes: {}
		};

		await gateway.save(progress);

		await expect(gateway.load()).resolves.toEqual(progress);
	});
});
