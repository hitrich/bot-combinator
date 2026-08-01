import { isAbsolute, join, resolve } from 'node:path';

import { AgentRuntimeError } from './errors.js';

export interface PackagedAgentExecutables {
  readonly codex: string;
  readonly claude: string;
  readonly manifest: string;
}

/**
 * Resolves the release pipeline's stable sidecar contract. Pass
 * `join(process.resourcesPath, 'resources')` from a packaged Electron main
 * process, or the repository's absolute `resources` directory in development.
 */
export function resolvePackagedAgentExecutables(
  resourcesRoot: string,
  platform: NodeJS.Platform = process.platform,
): PackagedAgentExecutables {
  if (!isAbsolute(resourcesRoot)) {
    throw new AgentRuntimeError('POLICY_DENIED', 'Agent resources root must be an absolute path.');
  }
  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    throw new AgentRuntimeError('BINARY_NOT_FOUND', `Unsupported desktop platform: ${platform}`);
  }
  const root = resolve(resourcesRoot, 'sidecars');
  const suffix = platform === 'win32' ? '.exe' : '';
  return {
    codex: join(root, 'codex', 'bin', `codex${suffix}`),
    claude: join(root, 'claude', `claude${suffix}`),
    manifest: join(root, 'manifest.json'),
  };
}
