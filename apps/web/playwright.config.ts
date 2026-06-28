import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4321 },
	testMatch: '**/*.e2e.{ts,js}'
});
