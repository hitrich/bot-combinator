import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { CodexAgentAdapter, sanitizeCodexEnvironment } from '../src/codex.js';
import type {
  CodexRpcClient,
  RpcNotification,
  RpcNotificationListener,
} from '../src/jsonl-transport.js';
import type { CommandRunner } from '../src/process.js';
import { mcpConnection, runRequest, TEST_MCP_TOKEN, validRawResult } from './helpers.js';

class FakeRpc implements CodexRpcClient {
  readonly requests: Array<{ method: string; params: unknown }> = [];
  readonly listeners = new Set<RpcNotificationListener>();
  closed = false;
  handler: (method: string, params: unknown) => unknown = () => ({});

  async request<T>(method: string, params?: unknown): Promise<T> {
    this.requests.push({ method, params });
    return (await this.handler(method, params)) as T;
  }

  notify(method: string, params?: unknown): void {
    this.requests.push({ method, params });
  }

  subscribe(listener: RpcNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(notification: RpcNotification): void {
    for (const listener of this.listeners) listener(notification);
  }

  close(): void {
    this.closed = true;
  }
}

const installed: CommandRunner = vi.fn(async () => ({
  exitCode: 0,
  stdout: 'codex-cli 0.146.0\n',
  stderr: '',
}));
const resolvedWorkspaceDirectory = resolve('/tmp/bot-combinator-agent');

function authenticatedRpc(): FakeRpc {
  const rpc = new FakeRpc();
  rpc.handler = (method) => {
    if (method === 'account/read') {
      return {
        account: { type: 'chatgpt', email: 'founder@example.com', planType: 'plus' },
        requiresOpenaiAuth: true,
      };
    }
    return {};
  };
  return rpc;
}

function emitSuccessfulTurn(rpc: FakeRpc): void {
  const json = JSON.stringify(validRawResult);
  rpc.emit({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', delta: json } });
  rpc.emit({
    method: 'item/completed',
    params: { threadId: 'thread-1', item: { type: 'agentMessage', text: json } },
  });
  rpc.emit({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { status: 'completed' } },
  });
}

describe('CodexAgentAdapter', () => {
  it('passes only the minimal auth, platform, and network environment to Codex', () => {
    expect(
      sanitizeCodexEnvironment({
        HOME: '/home/founder',
        PATH: '/usr/bin',
        HTTPS_PROXY: 'http://proxy.example.test',
        CODEX_HOME: '/home/founder/.codex',
        OPENAI_API_KEY: 'sk-test-only',
        AWS_SECRET_ACCESS_KEY: 'must-not-be-inherited',
        GITHUB_TOKEN: 'must-not-be-inherited',
        ANTHROPIC_API_KEY: 'must-not-be-inherited',
      }),
    ).toEqual({
      HOME: '/home/founder',
      PATH: '/usr/bin',
      HTTPS_PROXY: 'http://proxy.example.test',
      CODEX_HOME: '/home/founder/.codex',
      OPENAI_API_KEY: 'sk-test-only',
    });
  });

  it('detects a locally authenticated ChatGPT account through app-server', async () => {
    const rpc = authenticatedRpc();
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
    });
    await expect(adapter.detect()).resolves.toMatchObject({
      provider: 'codex',
      installed: true,
      authenticated: true,
      authSource: 'chatgpt',
      accountLabel: 'founder@example.com',
      plan: 'plus',
    });
    expect(rpc.requests.slice(0, 3).map(({ method }) => method)).toEqual([
      'initialize',
      'initialized',
      'account/read',
    ]);
    await adapter.dispose();
    expect(rpc.closed).toBe(true);
  });

  it('pins OS-keyring storage and returns official browser and device challenges', async () => {
    const rpc = authenticatedRpc();
    rpc.handler = (method, params) => {
      if (method === 'account/login/start') {
        const type = (params as { type: string }).type;
        return type === 'chatgpt'
          ? { loginId: 'browser-1', authUrl: 'https://chatgpt.com/auth' }
          : {
              loginId: 'device-1',
              verificationUrl: 'https://auth.openai.com/codex/device',
              userCode: 'ABCD',
            };
      }
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
    });
    const browser = await adapter.login({ provider: 'codex', mode: 'browser' });
    expect(browser).toMatchObject({
      kind: 'browser',
      loginId: 'browser-1',
      url: 'https://chatgpt.com/auth',
    });
    const keyringWrite = rpc.requests.find(({ method }) => method === 'config/value/write');
    expect(keyringWrite?.params).toEqual({
      keyPath: 'cli_auth_credentials_store',
      value: 'keyring',
      mergeStrategy: 'replace',
    });
    await expect(adapter.login({ provider: 'codex', mode: 'device-code' })).resolves.toMatchObject({
      kind: 'device-code',
      loginId: 'device-1',
      userCode: 'ABCD',
    });
    await expect(adapter.login({ provider: 'codex', mode: 'api-key' })).resolves.toMatchObject({
      kind: 'environment',
      environmentVariable: 'OPENAI_API_KEY',
    });
    await expect(adapter.login({ provider: 'claude', mode: 'browser' })).rejects.toThrow(
      'mismatch',
    );
    await expect(adapter.login({ provider: 'codex', mode: 'official-cli' })).rejects.toThrow(
      'supports browser',
    );
  });

  it('runs an ephemeral restricted-read-only turn and returns proposals, never actions', async () => {
    const rpc = authenticatedRpc();
    rpc.handler = (method) => {
      if (method === 'account/read')
        return { account: { type: 'chatgpt' }, requiresOpenaiAuth: true };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        setImmediate(() => emitSuccessfulTurn(rpc));
        return { turn: { id: 'turn-1' } };
      }
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
      defaultModel: 'gpt-safe',
    });
    const emit = vi.fn();
    const result = await adapter.run('run-1', runRequest(), emit);
    expect(result.proposals[0]).toMatchObject({ executable: false, kind: 'draft' });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'run.output_delta', runId: 'run-1' }),
    );
    const thread = rpc.requests.find(({ method }) => method === 'thread/start')?.params;
    expect(rpc.requests.find(({ method }) => method === 'initialize')?.params).toMatchObject({
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        mcpServerOpenaiFormElicitation: false,
      },
    });
    expect(thread).toMatchObject({
      approvalPolicy: 'never',
      sandbox: 'read-only',
      runtimeWorkspaceRoots: [resolvedWorkspaceDirectory],
      ephemeral: true,
      model: 'gpt-safe',
    });
    const turn = rpc.requests.find(({ method }) => method === 'turn/start')?.params;
    expect(turn).toMatchObject({
      approvalPolicy: 'never',
      runtimeWorkspaceRoots: [resolvedWorkspaceDirectory],
      sandboxPolicy: {
        type: 'readOnly',
        networkAccess: false,
      },
    });
    expect(JSON.stringify(turn)).toContain('PROPOSAL-ONLY');
  });

  it('injects only the loopback Bot Combinator MCP and permits only its exact allowlisted tools', async () => {
    const rpc = authenticatedRpc();
    rpc.handler = (method) => {
      if (method === 'account/read') return { account: { type: 'chatgpt' } };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        setImmediate(() => {
          rpc.emit({
            method: 'item/started',
            params: {
              threadId: 'thread-1',
              item: {
                type: 'mcpToolCall',
                server: 'bot-combinator',
                tool: 'bot_combinator_get_round',
              },
            },
          });
          emitSuccessfulTurn(rpc);
        });
        return { turn: { id: 'turn-1' } };
      }
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
      mcpBearerToken: TEST_MCP_TOKEN,
    });
    const connection = {
      ...mcpConnection('run-mcp'),
      enabledTools: [
        'bot_combinator_get_round',
        'bot_combinator_propose_stage',
        'bot_combinator_propose_task',
        'bot_combinator_propose_draft',
      ] as const,
    };
    await expect(
      adapter.run('run-mcp', { ...runRequest(), mcp: connection }, vi.fn()),
    ).resolves.toMatchObject({ summary: 'One draft proposed.' });
    const thread = rpc.requests.find(({ method }) => method === 'thread/start')?.params;
    expect(thread).toMatchObject({
      environments: [],
      dynamicTools: [],
      selectedCapabilityRoots: [],
      config: {
        web_search: 'disabled',
        apps: {},
        mcp_servers: {
          'bot-combinator': {
            url: 'http://127.0.0.1:43123/mcp',
            bearer_token_env_var: 'BOT_COMBINATOR_MCP_TOKEN',
            http_headers: { 'X-Bot-Combinator-Session': 'run-mcp' },
            enabled_tools: [
              'bot_combinator_get_round',
              'bot_combinator_propose_stage',
              'bot_combinator_propose_task',
              'bot_combinator_propose_draft',
            ],
            required: true,
          },
        },
      },
    });
    expect(JSON.stringify(thread)).not.toContain('bot_combinator_search_investors');
    expect(JSON.stringify(thread)).not.toContain('bot_combinator_propose_target');

    const deniedRpc = authenticatedRpc();
    deniedRpc.handler = (method) => {
      if (method === 'account/read') return { account: { type: 'chatgpt' } };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        setImmediate(() =>
          deniedRpc.emit({
            method: 'item/started',
            params: {
              threadId: 'thread-1',
              item: {
                type: 'mcpToolCall',
                server: 'bot-combinator',
                tool: 'bot_combinator_propose_target',
              },
            },
          }),
        );
        return { turn: { id: 'turn-1' } };
      }
      return {};
    };
    const denied = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: deniedRpc,
      commandRunner: installed,
      mcpBearerToken: TEST_MCP_TOKEN,
    });
    await expect(
      denied.run(
        'run-mcp-denied',
        { ...runRequest(), mcp: mcpConnection('run-mcp-denied') },
        vi.fn(),
      ),
    ).rejects.toThrow('forbidden tool item');
  });

  it('interrupts and rejects an unexpected tool item before accepting output', async () => {
    const rpc = authenticatedRpc();
    rpc.handler = (method) => {
      if (method === 'account/read') return { account: { type: 'chatgpt' } };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        setImmediate(() => {
          rpc.emit({
            method: 'item/started',
            params: { threadId: 'thread-1', item: { type: 'webSearch' } },
          });
        });
        return { turn: { id: 'turn-1' } };
      }
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
    });
    await expect(adapter.run('run-tool', runRequest(), vi.fn())).rejects.toThrow(
      'forbidden tool item',
    );
    expect(rpc.requests.some(({ method }) => method === 'turn/interrupt')).toBe(true);
  });

  it('supports cancellation and logout and fails closed without auth or binary', async () => {
    const rpc = authenticatedRpc();
    rpc.handler = (method) => {
      if (method === 'account/read') return { account: { type: 'chatgpt' } };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') return { turn: { id: 'turn-1' } };
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc,
      commandRunner: installed,
    });
    const pending = adapter.run('run-cancel', runRequest(), vi.fn());
    expect(await adapter.cancel('run-cancel')).toBe(true);
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(await adapter.cancel('missing')).toBe(false);
    await adapter.logout();
    expect(rpc.requests.some(({ method }) => method === 'account/logout')).toBe(true);

    const unauthRpc = new FakeRpc();
    unauthRpc.handler = (method) =>
      method === 'account/read' ? { account: null, requiresOpenaiAuth: true } : {};
    const unauth = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: unauthRpc,
      commandRunner: installed,
    });
    await expect(unauth.run('run-no-auth', runRequest(), vi.fn())).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    });

    const missing: CommandRunner = async () => ({ exitCode: 127, stdout: '', stderr: 'not found' });
    const missingAdapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: new FakeRpc(),
      commandRunner: missing,
    });
    await expect(missingAdapter.detect()).resolves.toMatchObject({
      installed: false,
      authenticated: false,
    });
    expect(() => new CodexAgentAdapter({ workspaceDirectory: 'relative' })).toThrow('absolute');
  });

  it('fails closed on incomplete protocol responses and abnormal turn states', async () => {
    const cases: Array<{
      handler: (method: string) => unknown;
      message: string;
    }> = [
      {
        handler: (method) =>
          method === 'account/read'
            ? { account: { type: 'apiKey' } }
            : method === 'thread/start'
              ? {}
              : {},
        message: 'thread id',
      },
      {
        handler: (method) =>
          method === 'account/read'
            ? { account: { type: 'apiKey' } }
            : method === 'thread/start'
              ? { thread: { id: 'thread-1' } }
              : method === 'turn/start'
                ? {}
                : {},
        message: 'turn id',
      },
    ];
    for (const scenario of cases) {
      const rpc = new FakeRpc();
      rpc.handler = scenario.handler;
      const adapter = new CodexAgentAdapter({
        workspaceDirectory: '/tmp/bot-combinator-agent',
        rpc,
        commandRunner: installed,
      });
      await expect(adapter.run(`run-${scenario.message}`, runRequest(), vi.fn())).rejects.toThrow(
        scenario.message,
      );
    }

    const failedRpc = authenticatedRpc();
    failedRpc.handler = (method) => {
      if (method === 'account/read') return { account: { type: 'apiKey' } };
      if (method === 'thread/start') return { thread: { id: 'thread-1' } };
      if (method === 'turn/start') {
        setImmediate(() =>
          failedRpc.emit({
            method: 'turn/completed',
            params: {
              threadId: 'thread-1',
              turn: {
                status: 'failed',
                error: { message: 'provider rejected API_KEY=not-a-real-secret-value' },
              },
            },
          }),
        );
        return { turn: { id: 'turn-1' } };
      }
      return {};
    };
    const failed = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: failedRpc,
      commandRunner: installed,
    });
    await expect(failed.run('run-failed', runRequest(), vi.fn())).rejects.toThrow(
      'status failed: provider rejected API_KEY=[REDACTED]',
    );
    await expect(failed.run('wrong-provider', runRequest('claude'), vi.fn())).rejects.toThrow(
      'mismatch',
    );
  });

  it('reports account-read failures and rejects incomplete login challenges', async () => {
    const accountFailure = new FakeRpc();
    accountFailure.handler = (method) => {
      if (method === 'account/read') throw new Error('account unavailable');
      return {};
    };
    const adapter = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: accountFailure,
      commandRunner: installed,
    });
    await expect(adapter.detect()).resolves.toMatchObject({
      authenticated: false,
      authSource: 'unknown',
    });

    const incomplete = new FakeRpc();
    const login = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: incomplete,
      commandRunner: installed,
    });
    await expect(login.login({ provider: 'codex', mode: 'browser' })).rejects.toThrow(
      'complete browser',
    );
    await expect(login.login({ provider: 'codex', mode: 'device-code' })).rejects.toThrow(
      'complete device-code',
    );

    const throwingRunner: CommandRunner = async () => {
      throw new Error('spawn failed');
    };
    const missing = new CodexAgentAdapter({
      workspaceDirectory: '/tmp/bot-combinator-agent',
      rpc: new FakeRpc(),
      commandRunner: throwingRunner,
    });
    await expect(missing.detect()).resolves.toMatchObject({
      installed: false,
      detail: 'spawn failed',
    });
  });
});
