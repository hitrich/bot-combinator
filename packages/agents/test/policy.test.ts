import { describe, expect, it } from 'vitest';

import { AgentRuntimeError } from '../src/errors.js';
import {
  createAllowlist,
  filterAuthorizedContext,
  grantCapability,
  hasCapability,
  proposalCapability,
  requireCapability,
  revokeGrant,
  validateAllowlist,
} from '../src/policy.js';

describe('durable agent allowlists', () => {
  it('records grants and revocations as immutable, revisioned founder decisions', () => {
    const initial = createAllowlist(new Date('2026-01-01T00:00:00Z'));
    const granted = grantCapability(initial, {
      id: 'grant-1',
      capability: 'read.investors',
      provider: 'codex',
      scope: { investorIds: ['b', 'a', 'a'] },
      at: new Date('2026-01-01T01:00:00Z'),
    });
    expect(initial.grants).toHaveLength(0);
    expect(granted).toMatchObject({
      revision: 1,
      grants: [{ id: 'grant-1', createdBy: 'founder' }],
    });
    expect(granted.grants[0]?.scope?.investorIds).toEqual(['a', 'b']);
    expect(hasCapability(granted, 'codex', 'read.investors', { investorId: 'a' })).toBe(true);
    expect(hasCapability(granted, 'claude', 'read.investors', { investorId: 'a' })).toBe(false);
    expect(hasCapability(granted, 'codex', 'read.investors', { investorId: 'c' })).toBe(false);

    const revoked = revokeGrant(
      granted,
      'grant-1',
      'Round ended',
      new Date('2026-01-02T00:00:00Z'),
    );
    expect(revoked.revision).toBe(2);
    expect(revoked.grants[0]).toMatchObject({ revokedBy: 'founder', revokeReason: 'Round ended' });
    expect(hasCapability(revoked, 'codex', 'read.investors', { investorId: 'a' })).toBe(false);
  });

  it('filters every context record by capability, provider, and scope', () => {
    let policy = createAllowlist();
    policy = grantCapability(policy, {
      id: 'read-a',
      capability: 'read.investors',
      provider: 'codex',
      scope: { investorIds: ['investor-a'] },
    });
    policy = grantCapability(policy, {
      id: 'read-tasks',
      capability: 'read.tasks',
      provider: 'all',
    });
    const records = [
      {
        id: 'a',
        capability: 'read.investors' as const,
        investorId: 'investor-a',
        data: 'included',
      },
      {
        id: 'b',
        capability: 'read.investors' as const,
        investorId: 'investor-b',
        data: 'excluded',
      },
      { id: 'c', capability: 'read.tasks' as const, data: 'included' },
      { id: 'd', capability: 'read.knowledge' as const, data: 'excluded' },
    ];
    expect(filterAuthorizedContext(records, policy, 'codex').map(({ id }) => id)).toEqual([
      'a',
      'c',
    ]);
    expect(filterAuthorizedContext(records, policy, 'claude').map(({ id }) => id)).toEqual(['c']);
  });

  it('fails closed for unknown, malformed, duplicated, or non-founder grants', () => {
    expect(() => grantCapability(createAllowlist(), { capability: 'send.email' as never })).toThrow(
      AgentRuntimeError,
    );
    expect(() => revokeGrant(createAllowlist(), 'missing')).toThrow('Active grant not found');
    expect(() =>
      validateAllowlist({
        version: 1,
        revision: 0,
        updatedAt: new Date().toISOString(),
        grants: [
          {
            id: 'x',
            capability: 'read.tasks',
            provider: 'all',
            createdAt: 'invalid',
            createdBy: 'founder',
          },
        ],
      }),
    ).toThrow('Invalid createdAt');
    expect(() =>
      validateAllowlist({
        version: 1,
        revision: 0,
        updatedAt: new Date().toISOString(),
        grants: [
          {
            id: 'x',
            capability: 'read.tasks',
            provider: 'all',
            createdAt: new Date().toISOString(),
            createdBy: 'founder',
          },
          {
            id: 'x',
            capability: 'read.tasks',
            provider: 'all',
            createdAt: new Date().toISOString(),
            createdBy: 'founder',
          },
        ],
      }),
    ).toThrow('invalid or duplicate');
  });

  it('requires scoped targets and maps every proposal kind to a safe capability', () => {
    let policy = createAllowlist();
    policy = grantCapability(policy, {
      id: 'round',
      capability: 'read.round',
      scope: { roundIds: ['round-1'] },
    });
    expect(() => requireCapability(policy, 'codex', 'read.round')).toThrow('not allowed');
    expect(hasCapability(policy, 'codex', 'read.round', { roundId: 'round-1' })).toBe(true);
    expect(proposalCapability('pipeline_move')).toBe('propose.pipeline_move');
  });
});
