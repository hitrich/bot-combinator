import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import { JsonlRpcTransport } from '../src/jsonl-transport.js';
import type { ProcessSpawner } from '../src/process.js';

class FakeChild extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly kill = vi.fn(() => {
    this.emit('close', 0);
    return true;
  });
}

function harness(timeout = 500) {
  const child = new FakeChild();
  const writes: string[] = [];
  child.stdin.setEncoding('utf8');
  child.stdin.on('data', (chunk: string) => writes.push(chunk));
  const spawner: ProcessSpawner = vi.fn(() => child as unknown as ChildProcessWithoutNullStreams);
  const transport = new JsonlRpcTransport({
    processSpawner: spawner,
    requestTimeoutMs: timeout,
    executable: '/absolute/codex',
  });
  return { child, writes, spawner, transport };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('JsonlRpcTransport', () => {
  it('correlates requests and responses over local JSONL stdio', async () => {
    const { child, writes, spawner, transport } = harness();
    const pending = transport.request<{ ok: boolean }>('account/read', { refreshToken: false });
    await tick();
    expect(spawner).toHaveBeenCalledWith(
      '/absolute/codex',
      ['app-server', '--listen', 'stdio://'],
      expect.any(Object),
    );
    const request = JSON.parse(writes.join('').trim()) as { id: number };
    child.stdout.write(`${JSON.stringify({ id: request.id, result: { ok: true } })}\n`);
    await expect(pending).resolves.toEqual({ ok: true });
    transport.close();
  });

  it('streams notifications and denies every server-initiated request', async () => {
    const { child, writes, transport } = harness();
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);
    transport.notify('initialized', {});
    child.stdout.write(
      `${JSON.stringify({ method: 'turn/started', params: { threadId: 't' } })}\n`,
    );
    child.stdout.write(
      `${JSON.stringify({ id: 99, method: 'item/permissions/requestApproval', params: {} })}\n`,
    );
    await tick();
    expect(listener).toHaveBeenCalledWith({ method: 'turn/started', params: { threadId: 't' } });
    expect(writes.join('')).toContain('proposal-only policy denied');
    expect(writes.join('')).toContain('"id":99');
    unsubscribe();
    transport.close();
  });

  it('normalizes RPC errors and fails pending work on malformed output or process exit', async () => {
    const first = harness();
    const rejected = first.transport.request('turn/start', {});
    await tick();
    const id = (JSON.parse(first.writes.join('').trim()) as { id: number }).id;
    first.child.stdout.write(`${JSON.stringify({ id, error: { code: 7, message: 'denied' } })}\n`);
    await expect(rejected).rejects.toThrow('turn/start failed: denied');
    first.transport.close();

    const secret = harness();
    const secretRejected = secret.transport.request('turn/start', {});
    await tick();
    const secretId = (JSON.parse(secret.writes.join('').trim()) as { id: number }).id;
    secret.child.stdout.write(
      `${JSON.stringify({ id: secretId, error: { message: 'OUTREACHR_MCP_TOKEN=do-not-leak' } })}\n`,
    );
    await expect(secretRejected).rejects.toThrow('OUTREACHR_MCP_TOKEN=[REDACTED]');
    await expect(secretRejected).rejects.not.toThrow('do-not-leak');
    secret.transport.close();

    const second = harness();
    const malformed = second.transport.request('account/read', {});
    second.child.stdout.write('not-json\n');
    await expect(malformed).rejects.toThrow('invalid JSON');
    second.transport.close();

    const third = harness();
    const exited = third.transport.request('account/read', {});
    third.child.stderr.write('API_KEY=secret-value\n');
    third.child.emit('close', 2);
    await expect(exited).rejects.toThrow('exited with code 2');
    third.transport.close();
  });

  it('times out unanswered requests and cannot restart after close', async () => {
    const { transport } = harness(10);
    await expect(transport.request('never/responds', {})).rejects.toThrow('timed out');
    transport.close();
    expect(() => transport.notify('initialized')).toThrow('closed');
  });

  it('fails closed when the process cannot spawn or stdin is unavailable', async () => {
    const throwing = new JsonlRpcTransport({
      processSpawner: () => {
        throw new Error('spawn denied');
      },
    });
    await expect(throwing.request('initialize', {})).rejects.toThrow('Could not start');

    const { child, transport } = harness();
    transport.start();
    child.stdin.end();
    await tick();
    expect(() => transport.notify('initialized')).toThrow('not writable');
    transport.close();
    transport.close();
  });

  it('terminates an app-server that emits an oversized JSONL line', async () => {
    const { child, transport } = harness();
    const pending = transport.request('turn/start', {});
    child.stdout.write('x'.repeat(1_048_577));
    await expect(pending).rejects.toThrow('maximum JSONL line length');
    expect(child.kill).toHaveBeenCalledOnce();
  });
});
