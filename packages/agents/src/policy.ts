import { randomUUID } from 'node:crypto';

import { AgentRuntimeError } from './errors.js';
import {
  AGENT_CAPABILITIES,
  type AgentCapability,
  type AgentContextRecord,
  type AgentGrant,
  type AgentGrantScope,
  type AgentProvider,
  type DurableAgentAllowlist,
  type ProposalKind,
} from './types.js';

const CAPABILITIES = new Set<string>(AGENT_CAPABILITIES);

const PROPOSAL_CAPABILITY: Readonly<Record<ProposalKind, AgentCapability>> = {
  draft: 'propose.draft',
  task: 'propose.task',
  pipeline_move: 'propose.pipeline_move',
  note: 'propose.note',
  research: 'propose.research',
};

export function createAllowlist(
  at = new Date(),
  grants: readonly AgentGrant[] = [],
): DurableAgentAllowlist {
  const allowlist: DurableAgentAllowlist = {
    version: 1,
    revision: 0,
    updatedAt: at.toISOString(),
    grants: [...grants],
  };
  validateAllowlist(allowlist);
  return allowlist;
}

export interface GrantCapabilityInput {
  readonly capability: AgentCapability;
  readonly provider?: AgentProvider | 'all';
  readonly scope?: AgentGrantScope;
  readonly id?: string;
  readonly at?: Date;
}

export function grantCapability(
  allowlist: DurableAgentAllowlist,
  input: GrantCapabilityInput,
): DurableAgentAllowlist {
  validateAllowlist(allowlist);
  if (!CAPABILITIES.has(input.capability)) {
    throw new AgentRuntimeError(
      'POLICY_DENIED',
      `Unknown agent capability: ${String(input.capability)}`,
    );
  }
  const at = input.at ?? new Date();
  const grant: AgentGrant = {
    id: input.id ?? randomUUID(),
    capability: input.capability,
    provider: input.provider ?? 'all',
    ...(input.scope ? { scope: normalizeScope(input.scope) } : {}),
    createdAt: at.toISOString(),
    createdBy: 'founder',
  };
  return {
    ...allowlist,
    revision: allowlist.revision + 1,
    updatedAt: at.toISOString(),
    grants: [...allowlist.grants, grant],
  };
}

export function revokeGrant(
  allowlist: DurableAgentAllowlist,
  grantId: string,
  reason?: string,
  at = new Date(),
): DurableAgentAllowlist {
  validateAllowlist(allowlist);
  let found = false;
  const grants = allowlist.grants.map((grant): AgentGrant => {
    if (grant.id !== grantId || grant.revokedAt) return grant;
    found = true;
    return {
      ...grant,
      revokedAt: at.toISOString(),
      revokedBy: 'founder',
      ...(reason ? { revokeReason: reason } : {}),
    };
  });
  if (!found) throw new AgentRuntimeError('POLICY_DENIED', `Active grant not found: ${grantId}`);
  return {
    ...allowlist,
    revision: allowlist.revision + 1,
    updatedAt: at.toISOString(),
    grants,
  };
}

export function validateAllowlist(allowlist: DurableAgentAllowlist): void {
  if (
    allowlist.version !== 1 ||
    !Number.isSafeInteger(allowlist.revision) ||
    allowlist.revision < 0
  ) {
    throw new AgentRuntimeError(
      'POLICY_DENIED',
      'The agent allowlist has an unsupported version or revision.',
    );
  }
  assertIsoDate(allowlist.updatedAt, 'allowlist updatedAt');
  const ids = new Set<string>();
  for (const grant of allowlist.grants) {
    if (!grant.id.trim() || ids.has(grant.id) || !CAPABILITIES.has(grant.capability)) {
      throw new AgentRuntimeError(
        'POLICY_DENIED',
        'The agent allowlist contains an invalid or duplicate grant.',
      );
    }
    ids.add(grant.id);
    if (grant.provider !== 'all' && grant.provider !== 'codex' && grant.provider !== 'claude') {
      throw new AgentRuntimeError('POLICY_DENIED', `Invalid provider on grant ${grant.id}.`);
    }
    if (grant.createdBy !== 'founder' || (grant.revokedAt && grant.revokedBy !== 'founder')) {
      throw new AgentRuntimeError('POLICY_DENIED', `Grant ${grant.id} is not founder-authorized.`);
    }
    assertIsoDate(grant.createdAt, `createdAt on grant ${grant.id}`);
    if (grant.revokedAt) {
      assertIsoDate(grant.revokedAt, `revokedAt on grant ${grant.id}`);
      if (Date.parse(grant.revokedAt) < Date.parse(grant.createdAt)) {
        throw new AgentRuntimeError(
          'POLICY_DENIED',
          `Grant ${grant.id} was revoked before it was created.`,
        );
      }
    }
    normalizeScope(grant.scope ?? {});
  }
}

export function hasCapability(
  allowlist: DurableAgentAllowlist,
  provider: AgentProvider,
  capability: AgentCapability,
  target?: { readonly roundId?: string; readonly investorId?: string },
): boolean {
  validateAllowlist(allowlist);
  return allowlist.grants.some(
    (grant) =>
      !grant.revokedAt &&
      grant.capability === capability &&
      (grant.provider === 'all' || grant.provider === provider) &&
      scopeAllows(grant.scope, target),
  );
}

export function requireCapability(
  allowlist: DurableAgentAllowlist,
  provider: AgentProvider,
  capability: AgentCapability,
  target?: { readonly roundId?: string; readonly investorId?: string },
): void {
  if (!hasCapability(allowlist, provider, capability, target)) {
    throw new AgentRuntimeError('POLICY_DENIED', `Agent is not allowed to use ${capability}.`);
  }
}

export function filterAuthorizedContext(
  records: readonly AgentContextRecord[],
  allowlist: DurableAgentAllowlist,
  provider: AgentProvider,
): readonly AgentContextRecord[] {
  validateAllowlist(allowlist);
  return records.filter((record) =>
    hasCapability(allowlist, provider, record.capability, {
      ...(record.roundId ? { roundId: record.roundId } : {}),
      ...(record.investorId ? { investorId: record.investorId } : {}),
    }),
  );
}

export function proposalCapability(kind: ProposalKind): AgentCapability {
  return PROPOSAL_CAPABILITY[kind];
}

function scopeAllows(
  scope: AgentGrantScope | undefined,
  target: { readonly roundId?: string; readonly investorId?: string } | undefined,
): boolean {
  if (!scope) return true;
  if (scope.roundIds?.length && (!target?.roundId || !scope.roundIds.includes(target.roundId)))
    return false;
  if (
    scope.investorIds?.length &&
    (!target?.investorId || !scope.investorIds.includes(target.investorId))
  ) {
    return false;
  }
  return true;
}

function normalizeScope(scope: AgentGrantScope): AgentGrantScope {
  const roundIds = normalizeIds(scope.roundIds);
  const investorIds = normalizeIds(scope.investorIds);
  return {
    ...(roundIds.length ? { roundIds } : {}),
    ...(investorIds.length ? { investorIds } : {}),
  };
}

function normalizeIds(ids: readonly string[] | undefined): readonly string[] {
  if (!ids) return [];
  if (ids.some((id) => !id.trim()))
    throw new AgentRuntimeError('POLICY_DENIED', 'Grant scopes cannot contain blank IDs.');
  return [...new Set(ids)].sort();
}

function assertIsoDate(value: string, field: string): void {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new AgentRuntimeError('POLICY_DENIED', `Invalid ${field}.`);
  }
}
