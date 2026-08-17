import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolvePackagedAgentExecutables } from '../src/paths.js';

describe('packaged sidecar paths', () => {
  it('resolves the CI/release contract on Unix and Windows', () => {
    const root = resolve('/tmp/bot-combinator/resources');
    expect(resolvePackagedAgentExecutables(root, 'darwin')).toEqual({
      codex: resolve(root, 'sidecars/codex/bin/codex'),
      claude: resolve(root, 'sidecars/claude/claude'),
      manifest: resolve(root, 'sidecars/manifest.json'),
    });
    expect(resolvePackagedAgentExecutables(root, 'win32')).toMatchObject({
      codex: expect.stringContaining('codex.exe'),
      claude: expect.stringContaining('claude.exe'),
    });
  });

  it('rejects relative roots and unsupported platforms', () => {
    expect(() => resolvePackagedAgentExecutables('resources')).toThrow('absolute');
    expect(() => resolvePackagedAgentExecutables(resolve('/tmp/resources'), 'aix')).toThrow(
      'Unsupported',
    );
  });
});
