import { AgentRuntimeError } from './errors.js';
import { nodeProcessSpawner, redactSecrets, type ProcessSpawner } from './process.js';

const MAX_JSONL_LINE_CHARS = 1_048_576;

export interface RpcNotification {
  readonly method: string;
  readonly params?: unknown;
}

export type RpcNotificationListener = (notification: RpcNotification) => void;

interface PendingRequest {
  readonly method: string;
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

interface RpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: { readonly code?: number; readonly message?: string; readonly data?: unknown };
}

interface RpcServerRequest {
  readonly id: number;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonlTransportOptions {
  readonly executable?: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<NodeJS.ProcessEnv>;
  readonly requestTimeoutMs?: number;
  readonly processSpawner?: ProcessSpawner;
}

/** A minimal, fail-closed JSON-RPC-over-JSONL client for `codex app-server`. */
export class JsonlRpcTransport {
  readonly #executable: string;
  readonly #args: readonly string[];
  readonly #env: Readonly<NodeJS.ProcessEnv>;
  readonly #timeoutMs: number;
  readonly #spawner: ProcessSpawner;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #listeners = new Set<RpcNotificationListener>();
  #child?: ReturnType<ProcessSpawner>;
  #stdoutBuffer = '';
  #nextId = 1;
  #stderr = '';
  #closed = false;

  constructor(options: JsonlTransportOptions = {}) {
    this.#executable = options.executable ?? 'codex';
    this.#args = options.args ?? ['app-server', '--listen', 'stdio://'];
    this.#env = options.env ?? process.env;
    this.#timeoutMs = options.requestTimeoutMs ?? 30_000;
    this.#spawner = options.processSpawner ?? nodeProcessSpawner;
  }

  start(): void {
    if (this.#closed)
      throw new AgentRuntimeError('PROTOCOL_ERROR', 'Codex app-server transport is closed.');
    if (this.#child) return;
    try {
      this.#child = this.#spawner(this.#executable, this.#args, {
        env: { ...this.#env },
        windowsHide: true,
      });
    } catch (error) {
      throw new AgentRuntimeError(
        'BINARY_NOT_FOUND',
        'Could not start the local Codex app-server.',
        error,
      );
    }
    this.#child.stdout.setEncoding('utf8');
    this.#child.stderr.setEncoding('utf8');
    this.#child.stderr.on('data', (chunk: string) => {
      this.#stderr = (this.#stderr + chunk).slice(-32_000);
    });
    this.#child.stdout.on('data', (chunk: string) => this.#receiveChunk(chunk));
    this.#child.stdout.once('end', () => this.#flushStdout());
    this.#child.once('error', (error) =>
      this.#terminate(
        new AgentRuntimeError('PROTOCOL_ERROR', 'Codex app-server failed.', error),
        false,
      ),
    );
    this.#child.once('close', (code) => {
      if (this.#closed) return;
      const detail = redactSecrets(this.#stderr.trim());
      const suffix = detail ? `: ${detail}` : '';
      this.#terminate(
        new AgentRuntimeError(
          'PROTOCOL_ERROR',
          `Codex app-server exited with code ${code ?? 'unknown'}${suffix}`,
        ),
        false,
      );
    });
  }

  async request<T>(method: string, params?: unknown, timeoutMs = this.#timeoutMs): Promise<T> {
    this.start();
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new AgentRuntimeError('TIMEOUT', `Codex request ${method} timed out.`));
      }, timeoutMs);
      timer.unref?.();
      this.#pending.set(id, {
        method,
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      try {
        this.#write({ id, method, ...(params === undefined ? {} : { params }) });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  notify(method: string, params?: unknown): void {
    this.start();
    this.#write({ method, ...(params === undefined ? {} : { params }) });
  }

  subscribe(listener: RpcNotificationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  close(): void {
    if (this.#closed) return;
    this.#terminate(
      new AgentRuntimeError('PROTOCOL_ERROR', 'Codex app-server transport closed.'),
      true,
    );
  }

  #receive(line: string): void {
    if (!line.trim()) return;
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch (error) {
      this.#terminate(
        new AgentRuntimeError('PROTOCOL_ERROR', 'Codex app-server emitted invalid JSON.', error),
        true,
      );
      return;
    }
    if (!isRecord(message)) return;
    if (typeof message.id === 'number' && typeof message.method === 'string') {
      this.#denyServerRequest(message as unknown as RpcServerRequest);
      return;
    }
    if (typeof message.id === 'number') {
      this.#resolve(message as unknown as RpcResponse);
      return;
    }
    if (typeof message.method === 'string') {
      const notification: RpcNotification = {
        method: message.method,
        ...(message.params === undefined ? {} : { params: message.params }),
      };
      for (const listener of this.#listeners) listener(notification);
    }
  }

  #receiveChunk(chunk: string): void {
    if (this.#closed) return;
    let cursor = 0;
    while (cursor < chunk.length) {
      const newline = chunk.indexOf('\n', cursor);
      const end = newline === -1 ? chunk.length : newline;
      const segment = chunk.slice(cursor, end);
      if (this.#stdoutBuffer.length + segment.length > MAX_JSONL_LINE_CHARS) {
        this.#terminate(
          new AgentRuntimeError(
            'PROTOCOL_ERROR',
            'Codex app-server exceeded the maximum JSONL line length.',
          ),
          true,
        );
        return;
      }
      this.#stdoutBuffer += segment;
      if (newline === -1) return;
      const line = this.#stdoutBuffer.endsWith('\r')
        ? this.#stdoutBuffer.slice(0, -1)
        : this.#stdoutBuffer;
      this.#stdoutBuffer = '';
      this.#receive(line);
      if (this.#closed) return;
      cursor = newline + 1;
    }
  }

  #flushStdout(): void {
    if (this.#closed || !this.#stdoutBuffer) return;
    const line = this.#stdoutBuffer.endsWith('\r')
      ? this.#stdoutBuffer.slice(0, -1)
      : this.#stdoutBuffer;
    this.#stdoutBuffer = '';
    this.#receive(line);
  }

  #denyServerRequest(request: RpcServerRequest): void {
    // Outreachr never grants tool approvals or external-auth refreshes to an agent.
    this.#write({
      id: request.id,
      error: {
        code: -32000,
        message: `Outreachr proposal-only policy denied server request: ${request.method}`,
      },
    });
  }

  #resolve(response: RpcResponse): void {
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    clearTimeout(pending.timer);
    if (response.error) {
      const providerMessage = redactSecrets(response.error.message ?? 'unknown error').slice(
        0,
        2_000,
      );
      pending.reject(
        new AgentRuntimeError(
          'PROVIDER_ERROR',
          `Codex ${pending.method} failed: ${providerMessage}`,
        ),
      );
      return;
    }
    pending.resolve(response.result);
  }

  #write(message: unknown): void {
    if (!this.#child?.stdin.writable) {
      throw new AgentRuntimeError('PROTOCOL_ERROR', 'Codex app-server stdin is not writable.');
    }
    this.#child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  #failAll(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #terminate(error: Error, kill: boolean): void {
    this.#closed = true;
    this.#stdoutBuffer = '';
    if (kill) this.#child?.kill();
    this.#failAll(error);
  }
}

export interface CodexRpcClient {
  request<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  notify(method: string, params?: unknown): void;
  subscribe(listener: RpcNotificationListener): () => void;
  close(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
