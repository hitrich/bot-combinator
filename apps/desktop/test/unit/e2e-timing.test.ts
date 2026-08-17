import { describe, expect, it } from 'vitest';
import { e2eTimingFor } from '../../e2e/timing';

describe('Electron E2E timing policy', () => {
  it('keeps the strict default budget on established runners', () => {
    expect(e2eTimingFor('darwin', 'arm64')).toMatchObject({
      testTimeout: 120_000,
      expectTimeout: 15_000,
      actionTimeout: 15_000,
      cleanupMaxRetries: 3,
    });
    expect(e2eTimingFor('win32', 'x64')).toMatchObject({
      testTimeout: 120_000,
      expectTimeout: 15_000,
      actionTimeout: 15_000,
      cleanupMaxRetries: 3,
    });
  });

  it('retains every scenario with a native Windows ARM64 budget and resilient cleanup', () => {
    expect(e2eTimingFor('win32', 'arm64')).toEqual({
      testTimeout: 300_000,
      expectTimeout: 60_000,
      actionTimeout: 30_000,
      applicationLaunchTimeout: 120_000,
      applicationCloseTimeout: 30_000,
      cleanupMaxRetries: 20,
      cleanupRetryDelay: 250,
    });
  });

  it('returns an isolated policy object', () => {
    const timing = e2eTimingFor('win32', 'arm64');
    timing.testTimeout = 1;
    expect(e2eTimingFor('win32', 'arm64').testTimeout).toBe(300_000);
  });
});
