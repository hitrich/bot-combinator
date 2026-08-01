import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OUTREACHR_MCP_TOOL_NAMES,
  createOutreachrMcpServer,
  type AccessRequest,
  type AuditEvent,
  type OutreachrMcpService,
  type ServiceInvocationContext,
} from '../src/index.js';

const NOW = '2026-07-31T12:00:00.000Z';
const AUDIT = {
  actor: 'codex' as const,
  sessionId: 'session-1',
  requestId: 'request-1',
  purpose: 'Prepare the founder morning brief',
  disclosedContextIds: [] as string[],
};

const investor = {
  id: 'investor:1',
  name: 'Ground Truth Ventures',
  kind: 'venture_capital' as const,
  additionalKinds: ['micro_vc' as const],
  headquarters: 'San Francisco, CA',
  geographies: ['United States'],
  stages: ['pre_seed', 'seed'],
  sectors: ['AI', 'developer tools'],
  check: { currency: 'USD' as const, minimum: 250_000, maximum: 2_000_000, typical: 750_000 },
  fitScore: 92,
  fitReasons: ['Stage, sector, and check fit'],
  confidence: 'verified' as const,
  website: 'https://example.com',
  description: 'Evidence-backed public description.',
  thesis: 'Back technical founders early.',
  linkedinUrl: 'https://www.linkedin.com/company/example',
  xUrl: 'https://x.com/example',
  sourceIds: ['source:1'],
  target: true,
  pipelineStage: 'ready' as const,
  nextAction: 'Request an introduction',
  privateNotes: 'The founder met this partner at a private dinner.',
};

const person = {
  id: 'person:1',
  name: 'Alex Rivera',
  firmId: investor.id,
  firmName: investor.name,
  title: 'Partner',
  investorKinds: ['venture_capital' as const],
  sectors: ['AI'],
  biography: 'Public biography.',
  linkedinUrl: 'https://www.linkedin.com/in/example',
  xUrl: 'https://x.com/person',
  sourceIds: ['source:2'],
  workEmail: 'alex@example.com',
  contactConfidence: 'verified' as const,
  target: true,
  contacted: false,
  replied: false,
  privateNotes: 'Private relationship note.',
};

const task = {
  id: 'task:1',
  title: 'Send deck after approval',
  notes: 'Private task notes',
  dueAt: NOW,
  status: 'open' as const,
  investorId: investor.id,
  personId: person.id,
  createdAt: NOW,
};

const proposal = {
  proposalId: 'proposal:1',
  status: 'pending_founder_approval' as const,
  summary: 'Move Ground Truth Ventures to meeting.',
  warnings: ['Founder approval is required.'],
  createdAt: NOW,
};

function createService(): OutreachrMcpService & {
  audits: AuditEvent[];
  authorizeAccess: ReturnType<typeof vi.fn<OutreachrMcpService['authorizeAccess']>>;
  getInvestor: ReturnType<typeof vi.fn<OutreachrMcpService['getInvestor']>>;
  getPerson: ReturnType<typeof vi.fn<OutreachrMcpService['getPerson']>>;
  listTasks: ReturnType<typeof vi.fn<OutreachrMcpService['listTasks']>>;
  proposeStage: ReturnType<typeof vi.fn<OutreachrMcpService['proposeStage']>>;
} {
  const audits: AuditEvent[] = [];
  return {
    audits,
    authorizeAccess: vi.fn(async (request: AccessRequest) => request),
    recordAuditEvent: vi.fn(async (event: AuditEvent) => {
      audits.push(event);
    }),
    searchInvestors: vi.fn(async () => ({ items: [investor], nextCursor: null, total: 1 })),
    listInvestors: vi.fn(async () => ({ items: [investor], nextCursor: null, total: 1 })),
    getInvestor: vi.fn(async () => investor),
    searchPeople: vi.fn(async () => ({ items: [person], nextCursor: null, total: 1 })),
    listPeople: vi.fn(async () => ({ items: [person], nextCursor: null, total: 1 })),
    getPerson: vi.fn(async () => person),
    getPipeline: vi.fn(async () => ({
      items: [
        {
          id: 'pipeline:1',
          investorId: investor.id,
          investorName: investor.name,
          stage: 'ready' as const,
          nextAction: 'Request an introduction',
          nextActionAt: NOW,
          owner: 'founder' as const,
          privateNotes: 'Private pipeline notes',
        },
      ],
      nextCursor: null,
      total: 1,
    })),
    getRound: vi.fn(async () => ({
      id: 'round:1',
      companyName: 'Acme',
      companyOneLiner: 'Local-first software',
      stage: 'seed' as const,
      sectors: ['AI'],
      geographies: ['US'],
      status: 'active' as const,
      targetAmount: 3_000_000,
      committedAmount: 500_000,
      softCircleAmount: 250_000,
      targetCheck: {
        currency: 'USD' as const,
        minimum: 250_000,
        maximum: 1_000_000,
        typical: 500_000,
      },
      launchDate: NOW,
      targetCloseDate: '2026-10-31T12:00:00.000Z',
      narrative: 'Private round narrative',
    })),
    listTasks: vi.fn(async () => ({ items: [task], nextCursor: null, total: 1 })),
    listMeetings: vi.fn(async () => ({
      items: [
        {
          id: 'meeting:1',
          title: 'Partner meeting',
          startsAt: NOW,
          endsAt: '2026-07-31T12:30:00.000Z',
          status: 'upcoming' as const,
          investorId: investor.id,
          location: 'Video',
          attendeePersonIds: [person.id],
          agenda: 'Private agenda',
          notes: 'Private notes',
        },
      ],
      nextCursor: null,
      total: 1,
    })),
    listKnowledge: vi.fn(async () => ({
      items: [
        {
          id: 'knowledge:1',
          title: 'ARR metrics',
          category: 'metrics' as const,
          content: 'Private metrics',
          updatedAt: NOW,
          sharePolicy: 'internal' as const,
        },
      ],
      nextCursor: null,
      total: 1,
    })),
    listActivity: vi.fn(async () => ({
      items: [
        {
          id: 'activity:1',
          kind: 'note' as const,
          title: 'Founder note',
          detail: 'Private activity detail',
          occurredAt: NOW,
          actor: 'founder' as const,
          investorId: investor.id,
          personId: person.id,
        },
      ],
      nextCursor: null,
      total: 1,
    })),
    proposeTarget: vi.fn(async () => proposal),
    proposeStage: vi.fn(async () => proposal),
    proposeTask: vi.fn(async () => proposal),
    proposeMeeting: vi.fn(async () => proposal),
    proposeKnowledge: vi.fn(async () => proposal),
    proposeDraft: vi.fn(async () => proposal),
    proposeSourceReview: vi.fn(async () => proposal),
  };
}

interface Harness {
  client: Client;
  server: ReturnType<typeof createOutreachrMcpServer>;
  close: () => Promise<void>;
}

const openHarnesses: Harness[] = [];

async function connect(
  service: OutreachrMcpService,
  enabledTools?: readonly string[],
): Promise<Harness> {
  const server = createOutreachrMcpServer(service, {
    now: () => new Date(NOW),
    createInvocationId: () => '11111111-1111-4111-8111-111111111111',
    ...(enabledTools ? { enabledTools } : {}),
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const harness = {
    client,
    server,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
  openHarnesses.push(harness);
  return harness;
}

afterEach(async () => {
  await Promise.allSettled(openHarnesses.splice(0).map((harness) => harness.close()));
});

function publicArguments(extra: Record<string, unknown> = {}) {
  return { audit: AUDIT, access: { recordIds: [], fields: [] }, ...extra };
}

function disclosedArguments(
  recordIds: string[],
  fields: string[],
  extra: Record<string, unknown> = {},
) {
  return {
    audit: { ...AUDIT, disclosedContextIds: recordIds },
    access: { recordIds, fields },
    ...extra,
  };
}

function structured(result: Awaited<ReturnType<Client['callTool']>>) {
  expect(result.isError).not.toBe(true);
  return result.structuredContent as {
    ok: true;
    tool: string;
    audit: { redaction: string; redactedRecordCount: number; riskLevel: string };
    data: Record<string, unknown>;
  };
}

describe('tool discovery and hard capability boundary', () => {
  it('refuses to start with an incomplete injected adapter', () => {
    expect(() => createOutreachrMcpServer({} as OutreachrMcpService)).toThrow(
      'complete, injected service adapter',
    );
  });

  it('advertises exactly the documented read/proposal tools with machine-readable risk metadata', async () => {
    const { client } = await connect(createService());
    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      [...OUTREACHR_MCP_TOOL_NAMES].sort(),
    );
    expect(listed.tools).toHaveLength(19);
    for (const tool of listed.tools) {
      const meta = tool._meta as Record<string, unknown>;
      expect(meta['outreachr/riskLevel']).toMatch(/^(read|proposal)$/u);
      expect(meta['outreachr/privateDataDefault']).toBe('redacted');
      expect(meta['outreachr/auditContextRequired']).toBe(true);
      expect(meta['outreachr/forbiddenCapabilities']).toContain('message_send');
      expect(meta['outreachr/forbiddenCapabilities']).toContain('raw_sql');
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.openWorldHint).toBe(false);
    }
  });

  it('can expose a strict host-selected subset and disables every unlisted tool', async () => {
    const enabled = ['outreachr_search_investors', 'outreachr_propose_task'] as const;
    const { client } = await connect(createService(), enabled);
    await expect(client.listTools()).resolves.toMatchObject({
      tools: [
        expect.objectContaining({ name: 'outreachr_search_investors' }),
        expect.objectContaining({ name: 'outreachr_propose_task' }),
      ],
    });
    const disabled = await client.callTool({
      name: 'outreachr_propose_target',
      arguments: publicArguments({
        investorId: investor.id,
        target: true,
        reason: 'Should remain disabled.',
      }),
    });
    expect(disabled.isError).toBe(true);
    expect(JSON.stringify(disabled.content)).toContain('disabled');
    expect(() =>
      createOutreachrMcpServer(createService(), { enabledTools: ['outreachr_send_message'] }),
    ).toThrow('unknown tool');
  });

  it.each([
    'outreachr_send_message',
    'outreachr_approve_and_send',
    'outreachr_raw_sql',
    'outreachr_read_file',
    'outreachr_shell',
    'outreachr_get_oauth_token',
  ])('rejects absent forbidden tool %s at the MCP protocol boundary', async (name) => {
    const { client } = await connect(createService());
    const result = await client.callTool({ name, arguments: publicArguments() });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('not found');
  });
});

describe('validation, authorization, redaction, and audit', () => {
  it.each([
    {
      name: 'outreachr_search_investors',
      arguments: publicArguments({ query: 'AI', limit: 10, filters: {} }),
      expectedId: investor.id,
    },
    {
      name: 'outreachr_list_investors',
      arguments: publicArguments({ limit: 10, filters: {} }),
      expectedId: investor.id,
    },
    {
      name: 'outreachr_list_people',
      arguments: publicArguments({ limit: 10, filters: {} }),
      expectedId: person.id,
    },
  ])('executes bounded public list tool $name', async ({ name, arguments: args, expectedId }) => {
    const { client } = await connect(createService());
    const output = structured(await client.callTool({ name, arguments: args }));
    const items = output.data.items as Array<Record<string, unknown>>;
    expect(items[0]?.id).toBe(expectedId);
  });

  it.each([
    {
      name: 'outreachr_get_pipeline',
      ids: ['pipeline:1'],
      fields: ['notes'],
      arguments: { limit: 20, stages: [] },
      expectedId: 'pipeline:1',
      privateKey: 'privateNotes',
    },
    {
      name: 'outreachr_list_meetings',
      ids: ['meeting:1'],
      fields: ['meeting_attendees', 'notes'],
      arguments: { limit: 20, status: [] },
      expectedId: 'meeting:1',
      privateKey: 'agenda',
    },
    {
      name: 'outreachr_list_knowledge',
      ids: ['knowledge:1'],
      fields: ['knowledge_content'],
      arguments: { limit: 20, categories: [] },
      expectedId: 'knowledge:1',
      privateKey: 'content',
    },
    {
      name: 'outreachr_list_activity',
      ids: ['activity:1'],
      fields: ['activity_detail'],
      arguments: { limit: 20, kinds: [] },
      expectedId: 'activity:1',
      privateKey: 'detail',
    },
  ])(
    'returns only scoped workspace records and fields through $name',
    async ({ name, ids, fields, arguments: args, expectedId, privateKey }) => {
      const { client } = await connect(createService());
      const output = structured(
        await client.callTool({
          name,
          arguments: disclosedArguments(ids, fields, args),
        }),
      );
      const items = output.data.items as Array<Record<string, unknown>>;
      expect(items[0]?.id).toBe(expectedId);
      expect(items[0]).toHaveProperty(privateKey);
    },
  );

  it('reveals only the explicitly granted round fields', async () => {
    const { client } = await connect(createService());
    const output = structured(
      await client.callTool({
        name: 'outreachr_get_round',
        arguments: disclosedArguments(['round:1'], ['round_financials'], { roundId: 'round:1' }),
      }),
    );
    expect(output.data).toMatchObject({ id: 'round:1', targetAmount: 3_000_000 });
    expect(output.data).not.toHaveProperty('narrative');
    expect(output.audit.redactedRecordCount).toBe(1);
  });

  it('returns public investor facts while redacting workflow and notes by default', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });
    const output = structured(result);

    expect(output.data).toMatchObject({
      id: investor.id,
      name: investor.name,
      thesis: investor.thesis,
    });
    expect(output.data).not.toHaveProperty('target');
    expect(output.data).not.toHaveProperty('pipelineStage');
    expect(output.data).not.toHaveProperty('privateNotes');
    expect(output.audit.redaction).toBe('public_only');
    expect(service.audits.map((event) => event.phase)).toEqual(['requested', 'succeeded']);
  });

  it('redacts work email and private relationship state from person search by default', async () => {
    const { client } = await connect(createService());
    const result = await client.callTool({
      name: 'outreachr_search_people',
      arguments: publicArguments({ query: 'Alex', limit: 10, filters: {} }),
    });
    const output = structured(result);
    const items = output.data.items as Array<Record<string, unknown>>;

    expect(items[0]).toMatchObject({ id: person.id, name: person.name });
    expect(items[0]).not.toHaveProperty('workEmail');
    expect(items[0]).not.toHaveProperty('contacted');
    expect(items[0]).not.toHaveProperty('privateNotes');
    expect(output.audit.redactedRecordCount).toBe(1);
  });

  it('returns only an exact host-authorized private subset', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_person',
      arguments: disclosedArguments([person.id], ['contact', 'workflow'], { personId: person.id }),
    });
    const output = structured(result);

    expect(output.data.workEmail).toBe(person.workEmail);
    expect(output.data.contacted).toBe(false);
    expect(output.data).not.toHaveProperty('privateNotes');
    expect(output.audit.redaction).toBe('authorized_subset');
    const context = service.getPerson.mock.calls[0]?.[1] as ServiceInvocationContext;
    expect(context.accessGrant).toEqual({
      recordIds: [person.id],
      fields: ['contact', 'workflow'],
    });
  });

  it('omits workspace task records by default and reveals scoped records without their notes', async () => {
    const service = createService();
    const { client } = await connect(service);
    const defaultResult = structured(
      await client.callTool({
        name: 'outreachr_list_tasks',
        arguments: publicArguments({ limit: 20, status: [] }),
      }),
    );
    expect(defaultResult.data.items).toEqual([]);
    expect(defaultResult.audit.redactedRecordCount).toBe(1);

    const scopedResult = structured(
      await client.callTool({
        name: 'outreachr_list_tasks',
        arguments: disclosedArguments([task.id], [], { limit: 20, status: [] }),
      }),
    );
    const scopedItems = scopedResult.data.items as Array<Record<string, unknown>>;
    expect(scopedItems).toHaveLength(1);
    expect(scopedItems[0]).not.toHaveProperty('notes');
  });

  it('rejects an authorization grant broader than request and disclosure without calling the data method', async () => {
    const service = createService();
    service.authorizeAccess.mockResolvedValue({ recordIds: [person.id], fields: ['contact'] });
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(service.getInvestor).not.toHaveBeenCalled();
    expect(JSON.stringify(result.content)).toContain('AUTHORIZATION_FAILURE');
    expect(service.audits.at(-1)?.phase).toBe('failed');
  });

  it('fails closed when the host authorizer throws', async () => {
    const service = createService();
    service.authorizeAccess.mockRejectedValue(new Error('authorization backend unavailable'));
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('AUTHORIZATION_FAILURE');
    expect(service.getInvestor).not.toHaveBeenCalled();
  });

  it('converts adapter exceptions into a generic service failure without leaking the exception', async () => {
    const service = createService();
    service.getInvestor.mockRejectedValue(new Error('secret internal database detail'));
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('SERVICE_FAILURE');
    expect(JSON.stringify(result.content)).not.toContain('secret internal database detail');
  });

  it.each([
    ['outreachr_list_meetings', { limit: 20, status: [] }],
    ['outreachr_list_knowledge', { limit: 20, categories: [] }],
    ['outreachr_list_activity', { limit: 20, kinds: [] }],
  ])('omits undisclosed private records from %s', async (name, args) => {
    const { client } = await connect(createService());
    const output = structured(
      await client.callTool({ name, arguments: publicArguments(args as Record<string, unknown>) }),
    );
    expect(output.data.items).toEqual([]);
    expect(output.audit.redactedRecordCount).toBe(1);
  });

  it('rejects malformed or oversized service output without returning validation detail', async () => {
    const service = createService();
    service.getInvestor.mockResolvedValue({
      ...investor,
      leakedSecret: 'never return me',
    } as never);
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('OUTPUT_REJECTED');
    expect(JSON.stringify(result.content)).not.toContain('leakedSecret');
    expect(JSON.stringify(result.content)).not.toContain('never return me');
  });

  it('enforces requested page limits before invoking the service', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_list_investors',
      arguments: publicArguments({ limit: 51, filters: {} }),
    });

    expect(result.isError).toBe(true);
    expect(service.listInvestors).not.toHaveBeenCalled();
  });

  it('rejects unknown input keys before invoking the service', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({
        investorId: investor.id,
        rawSql: 'SELECT * FROM connector_configs',
      }),
    });

    expect(result.isError).toBe(true);
    expect(service.getInvestor).not.toHaveBeenCalled();
  });

  it('fails closed before data access when the initial audit write fails', async () => {
    const service = createService();
    vi.mocked(service.recordAuditEvent).mockRejectedValue(new Error('audit unavailable'));
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('AUDIT_FAILURE');
    expect(service.authorizeAccess).not.toHaveBeenCalled();
    expect(service.getInvestor).not.toHaveBeenCalled();
  });

  it('fails closed instead of releasing a response when the success audit write fails', async () => {
    const service = createService();
    vi.mocked(service.recordAuditEvent)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('audit unavailable'));
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_get_investor',
      arguments: publicArguments({ investorId: investor.id }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('AUDIT_FAILURE');
    expect(service.getInvestor).toHaveBeenCalledOnce();
  });
});

describe('proposal-only mutations', () => {
  it.each([
    {
      name: 'outreachr_propose_target',
      ids: [investor.id],
      arguments: {
        investorId: investor.id,
        target: true,
        reason: 'The investor matches the founder-approved round profile.',
      },
    },
    {
      name: 'outreachr_propose_task',
      ids: [investor.id, person.id],
      arguments: {
        title: 'Prepare meeting brief',
        notes: 'Use only verified evidence.',
        dueAt: NOW,
        investorId: investor.id,
        personId: person.id,
        reason: 'The founder requested a preparation task.',
      },
    },
    {
      name: 'outreachr_propose_meeting',
      ids: [investor.id, person.id],
      arguments: {
        title: 'Partner meeting',
        startsAt: NOW,
        endsAt: '2026-07-31T12:30:00.000Z',
        investorId: investor.id,
        attendeePersonIds: [person.id],
        agenda: 'Discuss company and round fit.',
        reason: 'Prepare a meeting proposal for founder approval.',
      },
    },
    {
      name: 'outreachr_propose_knowledge',
      ids: [],
      arguments: {
        title: 'Approved company summary',
        category: 'company',
        content: 'Founder-reviewed company summary.',
        sharePolicy: 'safe_for_outreach',
        reason: 'Prepare a new knowledge proposal.',
      },
    },
    {
      name: 'outreachr_propose_draft',
      ids: [person.id],
      arguments: {
        personId: person.id,
        provider: 'google',
        kind: 'initial',
        subject: 'Seed round',
        bodyText: 'Hi Alex, here is a founder-reviewable draft.',
        reason: 'Prepare a message draft; do not send it.',
      },
    },
    {
      name: 'outreachr_propose_source_review',
      ids: ['review:1'],
      arguments: {
        reviewId: 'review:1',
        decision: 'accept',
        reason: 'The source directly supports the proposed value.',
      },
    },
  ])('creates only a pending proposal through $name', async ({ name, ids, arguments: args }) => {
    const service = createService();
    const { client } = await connect(service);
    const output = structured(
      await client.callTool({
        name,
        arguments: disclosedArguments(ids, [], args),
      }),
    );
    expect(output.data.status).toBe('pending_founder_approval');
    expect(output.audit.riskLevel).toBe('proposal');
  });

  it('creates a pending stage proposal for an exact authorized record and never applies a stage change', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_propose_stage',
      arguments: disclosedArguments([investor.id], [], {
        investorId: investor.id,
        stage: 'meeting',
        reason: 'The founder confirmed a scheduled meeting.',
      }),
    });
    const output = structured(result);

    expect(output.data).toMatchObject({
      proposalId: proposal.proposalId,
      status: 'pending_founder_approval',
    });
    expect(output.audit.riskLevel).toBe('proposal');
    expect(service.proposeStage).toHaveBeenCalledOnce();
  });

  it('rejects a proposal when its referenced record is outside the host grant', async () => {
    const service = createService();
    service.authorizeAccess.mockResolvedValue({ recordIds: [], fields: [] });
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_propose_stage',
      arguments: disclosedArguments([investor.id], [], {
        investorId: investor.id,
        stage: 'meeting',
        reason: 'Prepare a proposal only.',
      }),
    });

    expect(result.isError).toBe(true);
    expect(service.proposeStage).not.toHaveBeenCalled();
  });

  it('rejects a service response that claims a proposal was already applied', async () => {
    const service = createService();
    service.proposeStage.mockResolvedValue({ ...proposal, status: 'applied' } as never);
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_propose_stage',
      arguments: disclosedArguments([investor.id], [], {
        investorId: investor.id,
        stage: 'meeting',
        reason: 'Prepare a proposal only.',
      }),
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('OUTPUT_REJECTED');
  });

  it('rejects a meeting proposal whose end is not after its start', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_propose_meeting',
      arguments: disclosedArguments([investor.id], [], {
        title: 'Partner meeting',
        startsAt: NOW,
        endsAt: NOW,
        investorId: investor.id,
        attendeePersonIds: [],
        reason: 'Prepare a calendar proposal.',
      }),
    });

    expect(result.isError).toBe(true);
    expect(service.proposeMeeting).not.toHaveBeenCalled();
  });

  it('rejects a draft proposal body beyond the 20,000 character cap', async () => {
    const service = createService();
    const { client } = await connect(service);
    const result = await client.callTool({
      name: 'outreachr_propose_draft',
      arguments: disclosedArguments([person.id], [], {
        personId: person.id,
        provider: 'google',
        kind: 'initial',
        subject: 'Seed round',
        bodyText: 'x'.repeat(20_001),
        reason: 'Prepare a draft for founder review.',
      }),
    });

    expect(result.isError).toBe(true);
    expect(service.proposeDraft).not.toHaveBeenCalled();
  });
});
