// Tests for createSessionStore() using FakeSessionGateway (src/lib/api/fakes.ts) instead
// of a real network call, per the spec's testing section.

import { describe, expect, it } from 'vitest';
import { FakeSessionGateway } from '../api/fakes';
import { createSessionStore } from './session';

describe('createSessionStore()', () => {
	it('starts anonymous synchronously, with the sign-in panel closed', () => {
		const store = createSessionStore(new FakeSessionGateway());

		expect(store.currentUser.get()).toBeNull();
		expect(store.isAuthenticated.get()).toBe(false);
		expect(store.signInOpen.get()).toBe(false);
	});

	it('init() hydrates an anonymous session as currentUser = null, not an error', async () => {
		const store = createSessionStore(new FakeSessionGateway());

		await expect(store.init()).resolves.toBeUndefined();

		expect(store.currentUser.get()).toBeNull();
		expect(store.isAuthenticated.get()).toBe(false);
	});

	it('init() hydrates a signed-in session from the gateway', async () => {
		const gateway = new FakeSessionGateway();
		gateway.currentUser = { id: 'u1', email: 'a@b.com' };
		const store = createSessionStore(gateway);

		await store.init();

		expect(store.currentUser.get()).toEqual({ id: 'u1', email: 'a@b.com' });
		expect(store.isAuthenticated.get()).toBe(true);
	});

	it('signIn() forwards email and returnPath to the gateway without changing local state', async () => {
		const gateway = new FakeSessionGateway();
		const store = createSessionStore(gateway);

		await store.signIn('a@b.com', '/title/loki-season-1');

		expect(gateway.requestedLinks).toEqual([{ email: 'a@b.com', returnPath: '/title/loki-season-1' }]);
		expect(store.currentUser.get()).toBeNull();
	});

	it('logout() clears the gateway session and local currentUser', async () => {
		const gateway = new FakeSessionGateway();
		gateway.currentUser = { id: 'u1', email: 'a@b.com' };
		const store = createSessionStore(gateway);
		await store.init();

		await store.logout();

		expect(store.currentUser.get()).toBeNull();
		await expect(gateway.me()).resolves.toEqual({ authenticated: false });
	});

	it('openSignIn() / closeSignIn() toggle the signInOpen flag', () => {
		const store = createSessionStore(new FakeSessionGateway());

		store.openSignIn();
		expect(store.signInOpen.get()).toBe(true);

		store.closeSignIn();
		expect(store.signInOpen.get()).toBe(false);
	});
});
