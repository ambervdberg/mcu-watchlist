import { expect, test, type Page, type Route } from '@playwright/test';

type ProgressDto = {
	watchedIds: string[];
	skippedIds: string[];
	watchedDates: Record<string, string>;
	watchedEpisodes: Record<string, string[]>;
};

/** Shared anonymous API responses keep static-page flows offline and deterministic. */
async function mockAnonymousApi(page: Page): Promise<void> {
	await page.route('**/api/me', (route) => route.fulfill({ json: { authenticated: false } }));
	await page.route('**/api/progress', (route) => route.fulfill({ status: 401, json: { message: 'Not signed in' } }));
}

/** Authenticated API responses let progress mutations run without a real backend. */
async function mockAuthenticatedApi(page: Page, progress: ProgressDto): Promise<ProgressDto[]> {
	const saves: ProgressDto[] = [];

	await page.route('**/api/me', (route) =>
		route.fulfill({ json: { authenticated: true, user: { id: 'user-1', email: 'amber@example.com' } } })
	);

	await page.route('**/api/progress', async (route) => {
		if (route.request().method() === 'PUT') {
			const saved = route.request().postDataJSON() as ProgressDto;
			saves.push(saved);
			await route.fulfill({ json: saved });
			return;
		}

		await route.fulfill({ json: progress });
	});

	return saves;
}

/** Captures the sign-in request body and returns a successful magic-link response. */
async function mockSignInApi(page: Page): Promise<unknown[]> {
	const requests: unknown[] = [];

	await page.route('**/api/auth/request-link', async (route: Route) => {
		requests.push(route.request().postDataJSON());
		await route.fulfill({ json: { message: 'Check your email for a sign-in link.' } });
	});

	return requests;
}

test('browses and filters the timeline', async ({ page }) => {
	await mockAnonymousApi(page);

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Marvel Chronological Watchlist' })).toBeVisible();

	await page.getByLabel('Search title or year').fill('Iron Man');
	await expect(page.getByRole('heading', { name: 'Iron Man', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Agent Carter' })).toBeHidden();

	await page.getByRole('button', { name: 'Series' }).click();
	await expect(page.getByText('No items match the current filters.')).toBeVisible();
});

test('opens a prerendered detail page from a timeline card', async ({ page }) => {
	await mockAnonymousApi(page);

	await page.goto('/');
	await page
		.locator('.timeline-item')
		.filter({ has: page.getByRole('heading', { name: 'Iron Man', exact: true }) })
		.getByRole('link')
		.click();

	await expect(page).toHaveURL(/\/title\/iron-man$/);
	await expect(page.getByRole('heading', { name: 'Iron Man', exact: true })).toBeVisible();
	// Runtime comes from the static items.ts catalog entry (baked at build time, not OMDb),
	// so it's stable to assert on without mocking anything network-related.
	await expect(page.getByText('2h 6m')).toBeVisible();
});

test('requests a sign-in link with the current return path', async ({ page }) => {
	await mockAnonymousApi(page);
	const signInRequests = await mockSignInApi(page);

	await page.goto('/title/iron-man');
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.getByLabel('Email').fill('amber@example.com');
	await page.getByRole('button', { name: 'Send sign-in link' }).click();

	await expect(page.getByText('Check your email for a sign-in link.')).toBeVisible();
	expect(signInRequests).toEqual([{ email: 'amber@example.com', returnPath: '/title/iron-man' }]);
});

test('marks an authenticated item as watched', async ({ page }) => {
	const saves = await mockAuthenticatedApi(page, {
		watchedIds: [],
		skippedIds: [],
		watchedDates: {},
		watchedEpisodes: {}
	});

	await page.goto('/');
	const ironManCard = page
		.locator('.timeline-item')
		.filter({ has: page.getByRole('heading', { name: 'Iron Man', exact: true }) });

	await ironManCard.getByRole('button', { name: 'Watched' }).click();

	await expect(ironManCard.getByRole('button', { name: 'Watched' })).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => saves.at(-1)?.watchedIds).toEqual(['iron-man']);
});
