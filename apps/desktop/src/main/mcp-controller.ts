import type { AgentMcpConnection, AgentProposal, AgentProvider } from '@bot-combinator/agents';
import type { PrivateField } from '@bot-combinator/mcp';

export type DesktopMcpReadScope = 'round' | 'company' | 'investors' | 'activity';

export interface DesktopMcpSessionRegistration {
  runId: string;
  provider: AgentProvider;
  purpose: string;
  readScopes: readonly DesktopMcpReadScope[];
  disclosedRecordIds: readonly string[];
  allowedPrivateFields: readonly PrivateField[];
  onProposal: (proposal: AgentProposal) => void | Promise<void>;
}

/** Narrow lifecycle surface consumed by the embedded provider runtime. */
export interface DesktopMcpController {
  readonly bearerToken: string;
  registerSession(registration: DesktopMcpSessionRegistration): AgentMcpConnection;
  unregisterSession(runId: string): void;
}
