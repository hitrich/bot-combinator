import { defineConfig } from '@playwright/test';
import { e2eTimingFor } from './e2e/timing';

const timing = e2eTimingFor();

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e-artifacts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: timing.testTimeout,
  expect: { timeout: timing.expectTimeout },
  reporter: process.env.CI
    ? [
        ['line'],
        ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: timing.actionTimeout,
  },
});
