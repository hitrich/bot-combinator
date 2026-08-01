import { describe, expect, it } from 'vitest';

import { firstNonEmptyLine, nodeCommandRunner, redactSecrets } from '../src/process.js';

describe('local process helpers', () => {
  it('runs a local executable without a shell and captures bounded output', async () => {
    const result = await nodeCommandRunner(process.execPath, [
      '-e',
      "process.stdout.write('ok\\nOUTREACHR_MCP_TOKEN=stdout-secret\\n'); process.stderr.write('API_KEY=super-secret-value\\n')",
    ]);
    expect(result).toMatchObject({
      exitCode: 0,
      stdout: 'ok\nOUTREACHR_MCP_TOKEN=[REDACTED]\n',
    });
    expect(result.stdout).not.toContain('stdout-secret');
    expect(result.stderr).toContain('API_KEY=[REDACTED]');
    expect(result.stderr).not.toContain('super-secret-value');
  });

  it('returns non-zero exit codes and rejects missing binaries or timeouts', async () => {
    await expect(
      nodeCommandRunner(process.execPath, ['-e', 'process.exit(7)']),
    ).resolves.toMatchObject({ exitCode: 7 });
    await expect(
      nodeCommandRunner('/definitely/not/a/real/outreachr-command', []),
    ).rejects.toMatchObject({
      code: 'BINARY_NOT_FOUND',
    });
    await expect(
      nodeCommandRunner(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('redacts common credential shapes and reads only useful version lines', () => {
    expect(
      redactSecrets(
        'Bearer abc.def_ghi\nsk-ant-abcdefghijk\nACCESS_TOKEN: raw-value\n' +
          '{"OUTREACHR_MCP_TOKEN":"mcp-secret-value","refresh_token":"refresh-secret"}',
      ),
    ).toBe(
      'Bearer [REDACTED]\nsk-ant-[REDACTED]\nACCESS_TOKEN: [REDACTED]\n' +
        '{"OUTREACHR_MCP_TOKEN":"[REDACTED]","refresh_token":"[REDACTED]"}',
    );
    expect(firstNonEmptyLine('\n  \nversion 1\nversion 2')).toBe('version 1');
    expect(firstNonEmptyLine('')).toBeUndefined();
  });
});
