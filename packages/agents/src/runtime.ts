import { randomUUID } from 'node:crypto';

import { AgentRuntimeError, asAgentError } from './errors.js';
import type {
  AgentEvent,
  AgentEventListener,
  AgentProvider,
  AgentProviderAdapter,
  AgentRunHandle,
  AgentRunRequest,
  Clock,
  IdGenerator,
  LoginChallenge,
  LoginRequest,
  ProviderDetection,
} from './types.js';

const systemClock: Clock = { now: () => new Date() };
const uuidGenerator: IdGenerator = { next: (prefix) => `${prefix}_${randomUUID()}` };

export interface AgentRuntimeOptions {
  readonly adapters: readonly AgentProviderAdapter[];
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
}

/** Coordinates provider adapters without ever applying an agent proposal. */
export class AgentRuntime {
  readonly #adapters = new Map<AgentProvider, AgentProviderAdapter>();
  readonly #listeners = new Set<AgentEventListener>();
  readonly #active = new Map<string, AgentProvider>();
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  #disposed = false;

  constructor(options: AgentRuntimeOptions) {
    for (const adapter of options.adapters) {
      if (this.#adapters.has(adapter.provider)) {
        throw new AgentRuntimeError('POLICY_DENIED', `Duplicate ${adapter.provider} adapter.`);
      }
      this.#adapters.set(adapter.provider, adapter);
    }
    if (this.#adapters.size === 0)
      throw new AgentRuntimeError('POLICY_DENIED', 'At least one agent adapter is required.');
    this.#clock = options.clock ?? systemClock;
    this.#ids = options.ids ?? uuidGenerator;
  }

  subscribe(listener: AgentEventListener): () => void {
    this.#assertActive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async detect(provider: AgentProvider): Promise<ProviderDetection> {
    return this.#adapter(provider).detect();
  }

  async detectAll(): Promise<readonly ProviderDetection[]> {
    return Promise.all([...this.#adapters.values()].map((adapter) => adapter.detect()));
  }

  async status(provider: AgentProvider): Promise<ProviderDetection> {
    return this.#adapter(provider).status();
  }

  async statusAll(): Promise<readonly ProviderDetection[]> {
    return Promise.all([...this.#adapters.values()].map((adapter) => adapter.status()));
  }

  async login(request: LoginRequest): Promise<LoginChallenge> {
    const challenge = await this.#adapter(request.provider).login(request);
    this.#emit({ type: 'auth.challenge', provider: request.provider, challenge, at: this.#now() });
    return challenge;
  }

  async logout(provider: AgentProvider): Promise<void> {
    await this.#adapter(provider).logout();
    this.#emit({ type: 'auth.changed', provider, authenticated: false, at: this.#now() });
  }

  run(request: AgentRunRequest): AgentRunHandle {
    const adapter = this.#adapter(request.provider);
    const id = this.#ids.next('run');
    if (this.#active.has(id))
      throw new AgentRuntimeError('POLICY_DENIED', `Generated duplicate run id: ${id}`);
    this.#active.set(id, request.provider);
    this.#emit({ type: 'run.started', runId: id, provider: request.provider, at: this.#now() });
    const result = (async () => {
      try {
        const value = await adapter.run(id, request, (event) => this.#emit(event));
        for (const proposal of value.proposals) {
          this.#emit({ type: 'run.proposal', runId: id, proposal, at: this.#now() });
        }
        this.#emit({ type: 'run.completed', runId: id, result: value, at: this.#now() });
        return value;
      } catch (error) {
        const agentError = asAgentError(error);
        if (agentError.code === 'CANCELLED') {
          this.#emit({ type: 'run.cancelled', runId: id, at: this.#now() });
        } else {
          this.#emit({
            type: 'run.failed',
            runId: id,
            code: agentError.code,
            message: agentError.message,
            at: this.#now(),
          });
        }
        throw agentError;
      } finally {
        this.#active.delete(id);
      }
    })();
    return { id, provider: request.provider, result };
  }

  async cancel(runId: string): Promise<boolean> {
    this.#assertActive();
    const provider = this.#active.get(runId);
    if (!provider) return false;
    return this.#adapter(provider).cancel(runId);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.all([...this.#adapters.values()].map((adapter) => adapter.dispose()));
    this.#active.clear();
    this.#listeners.clear();
  }

  #adapter(provider: AgentProvider): AgentProviderAdapter {
    this.#assertActive();
    const adapter = this.#adapters.get(provider);
    if (!adapter) throw new AgentRuntimeError('BINARY_NOT_FOUND', `${provider} is not configured.`);
    return adapter;
  }

  #assertActive(): void {
    if (this.#disposed) throw new AgentRuntimeError('PROVIDER_ERROR', 'Agent runtime is disposed.');
  }

  #now(): string {
    return this.#clock.now().toISOString();
  }

  #emit(event: AgentEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch {
        // A renderer listener must never break provider cleanup or policy enforcement.
      }
    }
  }
}
