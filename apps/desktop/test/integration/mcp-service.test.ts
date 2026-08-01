import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';

import { OUTREACHR_AGENT_MCP_PROPOSAL_TOOLS, type AgentProposal } from '@outreachr/agents';
import type { PrivateField } from '@outreachr/mcp';

import { DesktopMcpBridge } from '../../src/main/mcp-service';
import type { DesktopMcpReadScope } from '../../src/main/mcp-controller';
import type { VaultService } from '../../src/main/vault-service';
import {
  firstPersonWithoutEmail,
  initializedVault,
  onboard,
  removeTemporaryDirectory,
  temporaryDirectory,
} from '../helpers/vault';

interface OpenClient {
  client: Client;
  runId: string;
  purpose: string;
}

describe('DesktopMcpBridge loopback, disclosure, and proposal boundary', () => {
  const directories: string[] = [];
  const clients: Client[] = [];
  let vault: VaultService | undefined;
  let bridge: DesktopMcpBridge | undefined;

  afterEach(async () => {
    await Promise.allSettled(clients.splice(0).map((client) => client.close()));
    await bridge?.dispose();
    bridge = undefined;
    vault?.vault.close();
    vault = undefined;
    await Promise.all(directories.splice(0).map(removeTemporaryDirectory));
  });

  async function fixture(): Promise<{
    snapshot: Awaited<ReturnType<VaultService['bootstrap']>>;
  }> {
    const directory = await temporaryDirectory('desktop-mcp');
    directories.push(directory);
    vault = await initializedVault(directory);
    await onboard(vault);
    bridge = await DesktopMcpBridge.start({
      vault,
      appVersion: '0.1.0-test',
      createId: (() => {
        let value = 0;
        return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
      })(),
    });
    return { snapshot: await vault.bootstrap() };
  }

  async function openClient(options: {
    runId: string;
    purpose: string;
    readScopes: DesktopMcpReadScope[];
    disclosedRecordIds: string[];
    allowedPrivateFields?: PrivateField[];
    onProposal?: (proposal: AgentProposal) => void | Promise<void>;
  }): Promise<OpenClient> {
    if (!bridge) throw new Error('Bridge fixture has not started.');
    const connection = bridge.registerSession({
      runId: options.runId,
      provider: 'codex',
      purpose: options.purpose,
      readScopes: options.readScopes,
      disclosedRecordIds: options.disclosedRecordIds,
      allowedPrivateFields: options.allowedPrivateFields ?? [],
      onProposal: options.onProposal ?? (() => undefined),
    });
    const client = new Client(
      { name: 'outreachr-desktop-test', version: '1.0.0' },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(connection.url), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${connection.bearerToken}`,
          'X-Outreachr-Session': connection.sessionId,
        },
      },
    });
    await client.connect(transport);
    clients.push(client);
    return { client, runId: options.runId, purpose: options.purpose };
  }

  function audit(session: OpenClient, requestId: string, disclosedContextIds: string[] = []) {
    return {
      actor: 'codex' as const,
      sessionId: session.runId,
      requestId,
      purpose: session.purpose,
      disclosedContextIds,
    };
  }

  it('binds only loopback, authenticates every POST, limits methods/content, and unregisters runs', async () => {
    await fixture();
    if (!bridge) throw new Error('Missing bridge');
    const url = new URL(bridge.endpoint);
    expect(url.hostname).toBe('127.0.0.1');
    expect(url.pathname).toBe('/mcp');
    expect(bridge.bearerToken).toHaveLength(43);
    bridge.registerSession({
      runId: 'run:http-boundary',
      provider: 'codex',
      purpose: 'Validate HTTP boundary',
      readScopes: [],
      disclosedRecordIds: [],
      allowedPrivateFields: [],
      onProposal: () => undefined,
    });
    expect(() =>
      bridge!.registerSession({
        runId: ' run:http-boundary',
        provider: 'codex',
        purpose: 'Whitespace must not alias another run',
        readScopes: [],
        disclosedRecordIds: [],
        allowedPrivateFields: [],
        onProposal: () => undefined,
      }),
    ).toThrow('run ID is invalid');

    await expect(fetch(bridge.endpoint)).resolves.toMatchObject({ status: 405 });
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.bearerToken}`,
          'X-Outreachr-Session': 'run:missing',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${bridge.bearerToken}`,
          'X-Outreachr-Session': 'run:http-boundary',
        },
        body: '{}',
      }),
    ).resolves.toMatchObject({ status: 415 });
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.bearerToken}`,
          'X-Outreachr-Session': 'run:http-boundary',
          Origin: 'https://attacker.example',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    ).resolves.toMatchObject({ status: 403 });
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.bearerToken}`,
          'X-Outreachr-Session': 'run:http-boundary',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'resources/list', params: {} }),
      }),
    ).resolves.toMatchObject({ status: 400 });

    bridge.unregisterSession('run:http-boundary');
    await expect(
      fetch(bridge.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bridge.bearerToken}`,
          'X-Outreachr-Session': 'run:http-boundary',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      }),
    ).resolves.toMatchObject({ status: 401 });
  });

  it('discovers only scope-derived reads plus stage/task/draft proposals', async () => {
    const { snapshot } = await fixture();
    const investor = snapshot.investors[0]!;
    const session = await openClient({
      runId: 'run:discovery',
      purpose: 'Inspect strict MCP discovery',
      readScopes: ['round', 'company', 'investors', 'activity'],
      disclosedRecordIds: [investor.id],
      allowedPrivateFields: ['workflow'],
    });
    const listed = await session.client.listTools();
    expect(listed.tools).toHaveLength(15);
    expect(listed.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'outreachr_search_investors',
        'outreachr_list_activity',
        'outreachr_propose_stage',
        'outreachr_propose_task',
        'outreachr_propose_draft',
      ]),
    );
    expect(listed.tools.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        'outreachr_propose_target',
        'outreachr_propose_meeting',
        'outreachr_propose_knowledge',
        'outreachr_propose_source_review',
      ]),
    );

    const cases: Array<{
      runId: string;
      readScopes: DesktopMcpReadScope[];
      expectedReads: string[];
    }> = [
      { runId: 'none', readScopes: [], expectedReads: [] },
      {
        runId: 'round',
        readScopes: ['round'],
        expectedReads: ['outreachr_get_round'],
      },
      {
        runId: 'company',
        readScopes: ['company'],
        expectedReads: ['outreachr_list_knowledge'],
      },
      {
        runId: 'investors',
        readScopes: ['investors'],
        expectedReads: [
          'outreachr_search_investors',
          'outreachr_list_investors',
          'outreachr_get_investor',
          'outreachr_search_people',
          'outreachr_list_people',
          'outreachr_get_person',
          'outreachr_get_pipeline',
        ],
      },
      {
        runId: 'activity',
        readScopes: ['activity'],
        expectedReads: [
          'outreachr_list_tasks',
          'outreachr_list_meetings',
          'outreachr_list_activity',
        ],
      },
    ];
    for (const testCase of cases) {
      const scoped = await openClient({
        runId: `run:discovery:${testCase.runId}`,
        purpose: `Inspect ${testCase.runId} MCP discovery`,
        readScopes: testCase.readScopes,
        disclosedRecordIds: [],
      });
      const names = (await scoped.client.listTools()).tools.map((tool) => tool.name).sort();
      expect(names).toEqual(
        [...testCase.expectedReads, ...OUTREACHR_AGENT_MCP_PROPOSAL_TOOLS].sort(),
      );
    }

    await expect(
      session.client.callTool({
        name: 'outreachr_propose_target',
        arguments: {
          audit: audit(session, 'request:forbidden-proposal', [investor.id]),
          access: { recordIds: [investor.id], fields: [] },
          investorId: investor.id,
          target: true,
          reason: 'This method must stay disabled.',
        },
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['outreachr_list_investors', { limit: 10, filters: {} }],
    ['outreachr_search_investors', { query: 'AI', limit: 10, filters: {} }],
    ['outreachr_get_investor', { investorId: '__INVESTOR__' }],
    ['outreachr_list_people', { limit: 10, filters: {} }],
    ['outreachr_search_people', { query: 'Partner', limit: 10, filters: {} }],
    ['outreachr_get_person', { personId: '__PERSON__' }],
    ['outreachr_get_pipeline', { limit: 10, stages: [] }],
  ])('round-only scope blocks investor surface %s even with empty access', async (name, raw) => {
    const { snapshot } = await fixture();
    const investor = snapshot.investors[0]!;
    const person = snapshot.people[0]!;
    const round = snapshot.round!;
    const session = await openClient({
      runId: `run:round-only:${name}`,
      purpose: 'Use only disclosed round context',
      readScopes: ['round'],
      disclosedRecordIds: [round.id],
      allowedPrivateFields: ['round_financials'],
    });
    const args = JSON.parse(
      JSON.stringify(raw).replace('__INVESTOR__', investor.id).replace('__PERSON__', person.id),
    ) as Record<string, unknown>;
    await expect(
      session.client.callTool({
        name,
        arguments: {
          audit: audit(session, `request:round-only:${name}`),
          access: { recordIds: [], fields: [] },
          ...args,
        },
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['outreachr_get_round', {}],
    ['outreachr_list_knowledge', { limit: 10, categories: [] }],
    ['outreachr_list_tasks', { limit: 10, status: [] }],
    ['outreachr_list_meetings', { limit: 10, status: [] }],
    ['outreachr_list_activity', { limit: 10, kinds: [] }],
  ])('investors-only scope blocks non-investor surface %s', async (name, extra) => {
    const { snapshot } = await fixture();
    const investor = snapshot.investors[0]!;
    const session = await openClient({
      runId: `run:investors-only:${name}`,
      purpose: 'Use only disclosed investor context',
      readScopes: ['investors'],
      disclosedRecordIds: [investor.id],
      allowedPrivateFields: ['workflow'],
    });
    await expect(
      session.client.callTool({
        name,
        arguments: {
          audit: audit(session, `request:investors-only:${name}`),
          access: { recordIds: [], fields: [] },
          ...extra,
        },
      }),
    ).rejects.toThrow();
  });

  it('allows public investor facts only within investor scope and rejects forged audit/access', async () => {
    const { snapshot } = await fixture();
    const investor = snapshot.investors[0]!;
    const person =
      snapshot.people.find((item) => item.firmId === investor.id) ?? snapshot.people[0]!;
    const session = await openClient({
      runId: 'run:authorized-investors',
      purpose: 'Read founder-disclosed investor context',
      readScopes: ['investors'],
      disclosedRecordIds: [investor.id, person.id],
      allowedPrivateFields: ['workflow'],
    });
    const publicList = await session.client.callTool({
      name: 'outreachr_list_investors',
      arguments: {
        audit: audit(session, 'request:public-investor-list'),
        access: { recordIds: [], fields: [] },
        limit: 10,
        filters: {},
      },
    });
    expect(publicList.isError).not.toBe(true);
    expect(JSON.stringify(publicList.structuredContent)).toContain(investor.name);

    const publicPerson = await session.client.callTool({
      name: 'outreachr_get_person',
      arguments: {
        audit: audit(session, 'request:public-person'),
        access: { recordIds: [], fields: [] },
        personId: person.id,
      },
    });
    expect(publicPerson.isError).not.toBe(true);
    expect(publicPerson.structuredContent).not.toHaveProperty('data.workEmail');

    const forgedActor = await session.client.callTool({
      name: 'outreachr_list_investors',
      arguments: {
        audit: { ...audit(session, 'request:forged-actor'), actor: 'claude' },
        access: { recordIds: [], fields: [] },
        limit: 10,
        filters: {},
      },
    });
    expect(forgedActor.isError).toBe(true);
    expect(JSON.stringify(forgedActor.content)).toContain('AUDIT_FAILURE');

    const contactEscalation = await session.client.callTool({
      name: 'outreachr_get_person',
      arguments: {
        audit: audit(session, 'request:contact-escalation', [person.id]),
        access: { recordIds: [person.id], fields: ['contact'] },
        personId: person.id,
      },
    });
    expect(contactEscalation.isError).toBe(true);
    expect(JSON.stringify(contactEscalation.content)).toContain('AUTHORIZATION_FAILURE');
  });

  it('creates a durable pending stage proposal without applying, sending, or replaying', async () => {
    const { snapshot } = await fixture();
    if (!vault) throw new Error('Missing vault');
    const investor = snapshot.investors[0]!;
    const runId = 'run:durable-proposal';
    const createdAt = '2026-07-31T20:00:00.000Z';
    vault.repository.createAgentRun({
      id: runId,
      provider: 'codex',
      model: null,
      purpose: 'Propose a reviewed pipeline change',
      contextPolicy: { disclosedContextIds: ['investors'] },
      status: 'running',
      startedAt: createdAt,
      completedAt: null,
      errorDetail: null,
      createdAt,
    });
    await vault.persist();
    const beforeStage = investor.pipelineStage;
    const beforeMessages = Number(vault.vault.scalar('SELECT COUNT(*) FROM messages'));
    const beforeLedger = Number(vault.vault.scalar('SELECT COUNT(*) FROM send_ledger'));
    const session = await openClient({
      runId,
      purpose: 'Propose a reviewed pipeline change',
      readScopes: ['investors'],
      disclosedRecordIds: [investor.id],
      allowedPrivateFields: ['workflow'],
      onProposal: async (proposal) => {
        vault!.repository.createAgentProposal({
          id: proposal.id,
          agentRunId: runId,
          proposalType: proposal.kind,
          payload: {
            kind: proposal.kind,
            title: proposal.title,
            rationale: proposal.rationale,
            investorId: proposal.investorId ?? null,
            payload: proposal.payload,
          },
          status: 'pending',
          reviewedAt: null,
          createdAt,
        });
        await vault!.persist();
      },
    });
    const callArguments = {
      audit: audit(session, 'request:stage-proposal', [investor.id]),
      access: { recordIds: [investor.id], fields: [] },
      investorId: investor.id,
      stage: 'meeting',
      reason: 'A founder-reviewed meeting was confirmed.',
    };
    const result = await session.client.callTool({
      name: 'outreachr_propose_stage',
      arguments: callArguments,
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      data: { status: 'pending_founder_approval' },
    });
    expect(
      vault.vault.one<{ status: string; proposal_type: string }>(
        'SELECT status,proposal_type FROM agent_proposals WHERE agent_run_id=?',
        [runId],
      ),
    ).toEqual({ status: 'pending', proposal_type: 'pipeline_move' });
    expect(
      (await vault.bootstrap()).investors.find((item) => item.id === investor.id)?.pipelineStage,
    ).toBe(beforeStage);
    expect(Number(vault.vault.scalar('SELECT COUNT(*) FROM messages'))).toBe(beforeMessages);
    expect(Number(vault.vault.scalar('SELECT COUNT(*) FROM send_ledger'))).toBe(beforeLedger);

    const replay = await session.client.callTool({
      name: 'outreachr_propose_stage',
      arguments: callArguments,
    });
    expect(replay.isError).toBe(true);
    expect(JSON.stringify(replay.content)).toContain('AUDIT_FAILURE');
    expect(
      Number(
        vault.vault.scalar('SELECT COUNT(*) FROM agent_proposals WHERE agent_run_id=?', [runId]),
      ),
    ).toBe(1);
  });

  it('applies person-scoped MCP task proposals and reuses the founder-reviewed person target', async () => {
    await fixture();
    if (!vault) throw new Error('Missing vault');
    const person = firstPersonWithoutEmail(vault);
    const otherInvestor = (await vault.bootstrap()).investors.find(
      (investor) => investor.id !== person.firmId,
    );
    if (!otherInvestor) throw new Error('Missing alternate investor fixture');
    await vault.targetInvestor(person.firmId, true);
    const runId = 'run:person-task-proposals';
    const createdAt = '2026-07-31T21:00:00.000Z';
    vault.repository.createAgentRun({
      id: runId,
      provider: 'codex',
      model: null,
      purpose: 'Propose person-scoped founder tasks',
      contextPolicy: { disclosedContextIds: ['investors'] },
      status: 'running',
      startedAt: createdAt,
      completedAt: null,
      errorDetail: null,
      createdAt,
    });
    await vault.persist();
    const session = await openClient({
      runId,
      purpose: 'Propose person-scoped founder tasks',
      readScopes: ['investors'],
      disclosedRecordIds: [person.firmId, person.id, otherInvestor.id],
      allowedPrivateFields: ['workflow'],
      onProposal: async (proposal) => {
        vault!.repository.createAgentProposal({
          id: proposal.id,
          agentRunId: runId,
          proposalType: proposal.kind,
          payload: {
            kind: proposal.kind,
            title: proposal.title,
            rationale: proposal.rationale,
            investorId: proposal.investorId ?? null,
            payload: proposal.payload,
          },
          status: 'pending',
          reviewedAt: null,
          createdAt,
        });
        await vault!.persist();
      },
    });
    expect(
      Number(vault.vault.scalar('SELECT COUNT(*) FROM targets WHERE person_id=?', [person.id])),
    ).toBe(0);

    for (const [index, title] of ['Review partner thesis', 'Prepare partner questions'].entries()) {
      const result = await session.client.callTool({
        name: 'outreachr_propose_task',
        arguments: {
          audit: audit(session, `request:person-task:${index}`, [person.firmId, person.id]),
          access: { recordIds: [person.firmId, person.id], fields: [] },
          title,
          notes: 'This stays pending until the founder applies it.',
          investorId: person.firmId,
          personId: person.id,
          reason: 'The person is the correct owner of this next step.',
        },
      });
      expect(result.isError).not.toBe(true);
      const proposal = vault.vault.one<{ id: string }>(
        "SELECT id FROM agent_proposals WHERE agent_run_id=? AND status='pending' ORDER BY created_at,id LIMIT 1",
        [runId],
      );
      expect(proposal).not.toBeNull();
      await expect(
        vault.reviewAgentProposal({ id: proposal!.id, decision: 'apply' }),
      ).resolves.toMatchObject({ appliedEntityType: 'task', operation: 'applied' });
    }

    const snapshot = await vault.bootstrap();
    const personTasks = snapshot.tasks.filter((task) => task.personId === person.id);
    expect(personTasks).toHaveLength(2);
    expect(personTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Review partner thesis',
          investorId: person.firmId,
          personId: person.id,
        }),
        expect.objectContaining({
          title: 'Prepare partner questions',
          investorId: person.firmId,
          personId: person.id,
        }),
      ]),
    );
    expect(
      Number(
        vault.vault.scalar('SELECT COUNT(*) FROM targets WHERE person_id=? AND firm_id=?', [
          person.id,
          person.firmId,
        ]),
      ),
    ).toBe(1);

    const mismatched = await session.client.callTool({
      name: 'outreachr_propose_task',
      arguments: {
        audit: audit(session, 'request:person-task:mismatch', [otherInvestor.id, person.id]),
        access: { recordIds: [otherInvestor.id, person.id], fields: [] },
        title: 'Must not attach across firms',
        investorId: otherInvestor.id,
        personId: person.id,
        reason: 'Exercise founder-apply relationship validation.',
      },
    });
    expect(mismatched.isError).not.toBe(true);
    const mismatchedProposal = vault.vault.one<{ id: string }>(
      "SELECT id FROM agent_proposals WHERE agent_run_id=? AND status='pending' ORDER BY created_at,id LIMIT 1",
      [runId],
    );
    await expect(
      vault.reviewAgentProposal({ id: mismatchedProposal!.id, decision: 'apply' }),
    ).rejects.toThrow('does not belong to the selected investor');
  });
});
