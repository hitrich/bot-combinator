import { describe, expect, it } from 'vitest';

import { AgentRuntimeError } from '../src/errors.js';
import { AgentRuntime } from '../src/runtime.js';
import { FakeAdapter, runRequest } from './helpers.js';

describe('AgentRuntime', () => {
  it('provides lifecycle APIs and ordered proposal-only events', async () => {
    const adapter = new FakeAdapter();
    const runtime = new AgentRuntime({
      adapters: [adapter],
      clock: { now: () => new Date('2026-01-01T00:00:00Z') },
      ids: { next: () => 'run-fixed' },
    });
    const eventTypes: string[] = [];
    runtime.subscribe((event) => eventTypes.push(event.type));
    expect(await runtime.detect('codex')).toEqual(adapter.detection);
    expect(await runtime.statusAll()).toEqual([adapter.detection]);
    expect(await runtime.detectAll()).toEqual([adapter.detection]);
    const challenge = await runtime.login({ provider: 'codex', mode: 'browser' });
    expect(challenge.kind).toBe('browser');
    await runtime.logout('codex');

    const handle = runtime.run(runRequest());
    expect(handle).toMatchObject({ id: 'run-fixed', provider: 'codex' });
    await expect(handle.result).resolves.toEqual(adapter.result);
    expect(eventTypes).toEqual([
      'auth.challenge',
      'auth.changed',
      'run.started',
      'run.output_delta',
      'run.proposal',
      'run.completed',
    ]);
    await runtime.dispose();
    expect(adapter.disposed).toBe(true);
  });

  it('contains listener errors and emits normalized failures', async () => {
    const adapter = new FakeAdapter();
    adapter.runError = new AgentRuntimeError('AUTH_REQUIRED', 'login first');
    const runtime = new AgentRuntime({ adapters: [adapter], ids: { next: () => 'run-error' } });
    const events: string[] = [];
    runtime.subscribe(() => {
      throw new Error('renderer failed');
    });
    runtime.subscribe((event) => events.push(event.type));
    await expect(runtime.run(runRequest()).result).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    expect(events).toEqual(['run.started', 'run.output_delta', 'run.failed']);
  });

  it('routes cancellation and fails closed for configuration errors', async () => {
    class PendingAdapter extends FakeAdapter {
      override async run(): Promise<never> {
        return new Promise(() => undefined);
      }
    }
    const adapter = new PendingAdapter();
    const runtime = new AgentRuntime({ adapters: [adapter], ids: { next: () => 'run-pending' } });
    runtime.run(runRequest());
    expect(await runtime.cancel('run-pending')).toBe(true);
    expect(adapter.cancelled).toEqual(['run-pending']);
    expect(await runtime.cancel('missing')).toBe(false);
    expect(() => new AgentRuntime({ adapters: [] })).toThrow('At least one');
    expect(() => new AgentRuntime({ adapters: [adapter, adapter] })).toThrow('Duplicate codex');
    await runtime.dispose();
    await expect(runtime.detect('codex')).rejects.toThrow('disposed');
  });
});
