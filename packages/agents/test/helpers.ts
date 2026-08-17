import { createAllowlist, grantCapability } from '../src/policy.js';
import { BOT_COMBINATOR_AGENT_MCP_TOOLS } from '../src/types.js';
import type {
  AgentCapability,
  AgentEventListener,
  AgentProvider,
  AgentProviderAdapter,
  AgentResult,
  AgentRunRequest,
  LoginChallenge,
  LoginRequest,
  ProviderDetection,
} from '../src/types.js';

export const TEST_MCP_TOKEN = 'test-bot-combinator-mcp-token-0123456789abcdef';

export function mcpConnection(sessionId: string) {
  return {
    serverName: 'bot-combinator' as const,
    url: 'http://127.0.0.1:43123/mcp',
    bearerToken: TEST_MCP_TOKEN,
    sessionId,
    auditPurpose: 'Propose a follow-up draft.',
    enabledTools: BOT_COMBINATOR_AGENT_MCP_TOOLS,
  };
}

export function allowlist(...capabilities: readonly AgentCapability[]) {
  let value = createAllowlist(new Date('2026-01-01T00:00:00.000Z'));
  capabilities.forEach((capability, index) => {
    value = grantCapability(value, {
      capability,
      id: `grant-${index}`,
      at: new Date(`2026-01-01T00:00:0${index + 1}.000Z`),
    });
  });
  return value;
}

export function runRequest(provider: AgentProvider = 'codex'): AgentRunRequest {
  return {
    provider,
    intent: 'Propose a follow-up draft.',
    allowlist: allowlist('read.investors', 'propose.draft'),
    context: [
      {
        id: 'context-1',
        capability: 'read.investors',
        investorId: 'investor-1',
        data: { name: 'Example Ventures', stage: 'seed' },
      },
    ],
  };
}

export const validRawResult = {
  summary: 'One draft proposed.',
  proposals: [
    {
      id: 'proposal-1',
      kind: 'draft',
      title: 'Follow up with Example Ventures',
      rationale: 'The founder met this investor last week.',
      investorId: 'investor-1',
      payload: { subject: 'Following up', body: 'Thank you for the conversation.' },
    },
  ],
} as const;

export const validResult: AgentResult = {
  summary: validRawResult.summary,
  proposals: [{ ...validRawResult.proposals[0], executable: false }],
};

export class FakeAdapter implements AgentProviderAdapter {
  readonly provider: AgentProvider;
  readonly detection: ProviderDetection;
  result: AgentResult = validResult;
  runError?: Error;
  cancelled: string[] = [];
  disposed = false;

  constructor(provider: AgentProvider = 'codex') {
    this.provider = provider;
    this.detection = {
      provider,
      installed: true,
      authenticated: true,
      authSource: provider === 'codex' ? 'chatgpt' : 'claude-code',
    };
  }

  async detect(): Promise<ProviderDetection> {
    return this.detection;
  }

  async status(): Promise<ProviderDetection> {
    return this.detection;
  }

  async login(request: LoginRequest): Promise<LoginChallenge> {
    return {
      provider: request.provider,
      kind: 'browser',
      url: 'https://example.test',
      instructions: 'Sign in.',
    };
  }

  async logout(): Promise<void> {}

  async run(
    runId: string,
    _request: AgentRunRequest,
    emit: AgentEventListener,
  ): Promise<AgentResult> {
    emit({ type: 'run.output_delta', runId, text: 'partial', at: '2026-01-01T00:00:00.000Z' });
    if (this.runError) throw this.runError;
    return this.result;
  }

  async cancel(runId: string): Promise<boolean> {
    this.cancelled.push(runId);
    return true;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}
