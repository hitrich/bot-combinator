import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('packaged renderer security policy', () => {
  it('ships no development sockets and blocks active embedded content', async () => {
    const html = await readFile(
      resolve(import.meta.dirname, '../../src/renderer/index.html'),
      'utf8',
    );
    const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/u)?.[1];

    expect(policy).toBeDefined();
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain('ws:');
    expect(policy).not.toContain('wss:');
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'none'");
    // Chromium ignores frame-ancestors in a meta policy and logs a console error. The main
    // process prevents embedding and remote navigation through BrowserWindow isolation and
    // navigation guards instead, so the unsupported directive must not be shipped here.
    expect(policy).not.toContain('frame-ancestors');
  });
});
