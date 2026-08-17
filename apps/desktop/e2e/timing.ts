export interface E2ETiming {
  testTimeout: number;
  expectTimeout: number;
  actionTimeout: number;
  applicationLaunchTimeout: number;
  applicationCloseTimeout: number;
  cleanupMaxRetries: number;
  cleanupRetryDelay: number;
}

const DEFAULT_TIMING: E2ETiming = {
  testTimeout: 120_000,
  expectTimeout: 15_000,
  actionTimeout: 15_000,
  applicationLaunchTimeout: 60_000,
  applicationCloseTimeout: 5_000,
  cleanupMaxRetries: 3,
  cleanupRetryDelay: 100,
};

const WINDOWS_ARM64_TIMING: E2ETiming = {
  // GitHub's native Windows ARM64 preview runner completes the same mutation
  // scenarios several times more slowly than Windows x64. Keep every assertion
  // enabled while giving the full scenario and its final state transition a
  // realistic native-runner budget.
  testTimeout: 300_000,
  expectTimeout: 60_000,
  actionTimeout: 30_000,
  applicationLaunchTimeout: 120_000,
  applicationCloseTimeout: 30_000,
  cleanupMaxRetries: 20,
  cleanupRetryDelay: 250,
};

export function e2eTimingFor(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): E2ETiming {
  return platform === 'win32' && architecture === 'arm64'
    ? { ...WINDOWS_ARM64_TIMING }
    : { ...DEFAULT_TIMING };
}
