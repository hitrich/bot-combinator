import { z } from 'zod';

const boundedString = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

export const recordIdSchema = boundedString(160).regex(
  /^[\w:./@+-]+$/u,
  'Invalid record identifier',
);
export const cursorSchema = z.string().min(1).max(512);
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const urlSchema = z.string().url().max(2_048);

export const actorSchema = z.enum(['founder', 'codex', 'claude', 'mcp_client']);
export const privateFieldSchema = z.enum([
  'contact',
  'notes',
  'knowledge_content',
  'activity_detail',
  'meeting_attendees',
  'round_financials',
  'workflow',
]);

export const auditContextSchema = z
  .object({
    actor: actorSchema,
    sessionId: boundedString(160),
    requestId: boundedString(160),
    purpose: boundedString(500),
    disclosedContextIds: z.array(recordIdSchema).max(100).default([]),
  })
  .strict();

export const accessRequestSchema = z
  .object({
    recordIds: z.array(recordIdSchema).max(100).default([]),
    fields: z.array(privateFieldSchema).max(7).default([]),
  })
  .strict()
  .default({ recordIds: [], fields: [] });

export const accessGrantSchema = z
  .object({
    recordIds: z.array(recordIdSchema).max(100).default([]),
    fields: z.array(privateFieldSchema).max(7).default([]),
  })
  .strict();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  cursor: cursorSchema.optional(),
});

export const invocationInputSchema = z.object({
  audit: auditContextSchema,
  access: accessRequestSchema,
});

export const investorKindSchema = z.enum([
  'venture_capital',
  'micro_vc',
  'angel',
  'angel_network',
  'scout',
  'accelerator',
  'venture_studio',
  'corporate_vc',
  'family_office',
  'syndicate',
  'crypto_fund',
  'solo_gp',
]);

export const pipelineStageSchema = z.enum([
  'researching',
  'ready',
  'intro_requested',
  'contacted',
  'meeting',
  'diligence',
  'partner_meeting',
  'soft_circle',
  'committed',
  'passed',
  'not_now',
]);

export const confidenceSchema = z.enum(['verified', 'supported', 'inferred', 'unknown', 'stale']);
export const proposalStatusSchema = z.literal('pending_founder_approval');

export const moneyRangeSchema = z
  .object({
    currency: z.literal('USD'),
    minimum: z.number().nonnegative().finite().nullable(),
    maximum: z.number().nonnegative().finite().nullable(),
    typical: z.number().nonnegative().finite().nullable(),
  })
  .strict();

export const investorRecordSchema = z
  .object({
    id: recordIdSchema,
    name: boundedString(240),
    kind: investorKindSchema,
    additionalKinds: z.array(investorKindSchema).max(12).default([]),
    headquarters: optionalText(300),
    geographies: z.array(boundedString(120)).max(50).default([]),
    stages: z.array(boundedString(80)).max(20).default([]),
    sectors: z.array(boundedString(120)).max(100).default([]),
    check: moneyRangeSchema,
    fitScore: z.number().min(0).max(100).finite().nullable().optional(),
    fitReasons: z.array(boundedString(500)).max(20).optional(),
    confidence: confidenceSchema,
    website: urlSchema.nullable().optional(),
    description: optionalText(4_000),
    thesis: optionalText(4_000),
    linkedinUrl: urlSchema.nullable().optional(),
    xUrl: urlSchema.nullable().optional(),
    sourceIds: z.array(recordIdSchema).max(200).default([]),
    target: z.boolean().optional(),
    pipelineStage: pipelineStageSchema.nullable().optional(),
    nextAction: optionalText(1_000),
    privateNotes: optionalText(8_000),
  })
  .strict();

export const personRecordSchema = z
  .object({
    id: recordIdSchema,
    name: boundedString(240),
    firmId: recordIdSchema.nullable(),
    firmName: optionalText(240),
    title: optionalText(240),
    investorKinds: z.array(investorKindSchema).max(12).default([]),
    sectors: z.array(boundedString(120)).max(100).default([]),
    biography: optionalText(3_000),
    linkedinUrl: urlSchema.nullable().optional(),
    xUrl: urlSchema.nullable().optional(),
    sourceIds: z.array(recordIdSchema).max(200).default([]),
    workEmail: z.string().email().max(320).nullable().optional(),
    contactConfidence: confidenceSchema.optional(),
    target: z.boolean().optional(),
    contacted: z.boolean().optional(),
    replied: z.boolean().optional(),
    privateNotes: optionalText(8_000),
  })
  .strict();

export const investorPageSchema = z
  .object({
    items: z.array(investorRecordSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const personPageSchema = z
  .object({
    items: z.array(personRecordSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const pipelineItemSchema = z
  .object({
    id: recordIdSchema,
    investorId: recordIdSchema,
    investorName: boundedString(240),
    stage: pipelineStageSchema,
    nextAction: optionalText(1_000),
    nextActionAt: isoDateTimeSchema.nullable().optional(),
    owner: z.literal('founder'),
    privateNotes: optionalText(8_000),
  })
  .strict();

export const pipelineResultSchema = z
  .object({
    items: z.array(pipelineItemSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const roundRecordSchema = z
  .object({
    id: recordIdSchema,
    companyName: boundedString(240),
    companyOneLiner: optionalText(1_000),
    stage: z.enum(['pre_seed', 'seed', 'series_a']),
    sectors: z.array(boundedString(120)).max(100).default([]),
    geographies: z.array(boundedString(120)).max(100).default([]),
    status: z.enum(['planning', 'active', 'paused', 'closed']),
    targetAmount: z.number().nonnegative().finite().optional(),
    committedAmount: z.number().nonnegative().finite().optional(),
    softCircleAmount: z.number().nonnegative().finite().optional(),
    targetCheck: moneyRangeSchema.optional(),
    launchDate: isoDateTimeSchema.nullable().optional(),
    targetCloseDate: isoDateTimeSchema.nullable().optional(),
    narrative: optionalText(8_000),
  })
  .strict();

export const taskRecordSchema = z
  .object({
    id: recordIdSchema,
    title: boundedString(300),
    notes: optionalText(8_000),
    dueAt: isoDateTimeSchema.nullable(),
    status: z.enum(['open', 'done', 'dismissed']),
    investorId: recordIdSchema.nullable(),
    personId: recordIdSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const taskPageSchema = z
  .object({
    items: z.array(taskRecordSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const meetingRecordSchema = z
  .object({
    id: recordIdSchema,
    title: boundedString(300),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    status: z.enum(['upcoming', 'completed', 'cancelled']),
    investorId: recordIdSchema.nullable(),
    location: optionalText(1_000),
    attendeePersonIds: z.array(recordIdSchema).max(50).optional(),
    agenda: optionalText(8_000),
    notes: optionalText(12_000),
  })
  .strict();

export const meetingPageSchema = z
  .object({
    items: z.array(meetingRecordSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const knowledgeRecordSchema = z
  .object({
    id: recordIdSchema,
    title: boundedString(300),
    category: z.enum(['company', 'round', 'narrative', 'metrics', 'disclosure', 'other']),
    content: z.string().max(20_000).optional(),
    updatedAt: isoDateTimeSchema,
    sharePolicy: z.enum(['internal', 'safe_for_outreach', 'meeting_only', 'diligence_only']),
  })
  .strict();

export const knowledgePageSchema = z
  .object({
    items: z.array(knowledgeRecordSchema).max(25),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const activityRecordSchema = z
  .object({
    id: recordIdSchema,
    kind: z.enum(['email', 'meeting', 'note', 'task', 'stage', 'source', 'agent']),
    title: boundedString(300),
    detail: optionalText(8_000),
    occurredAt: isoDateTimeSchema,
    actor: z.enum(['founder', 'system', 'agent', 'provider']),
    investorId: recordIdSchema.nullable().optional(),
    personId: recordIdSchema.nullable().optional(),
  })
  .strict();

export const activityPageSchema = z
  .object({
    items: z.array(activityRecordSchema).max(50),
    nextCursor: cursorSchema.nullable(),
    total: z.number().int().nonnegative().optional(),
  })
  .strict();

export const proposalResultSchema = z
  .object({
    proposalId: recordIdSchema,
    status: proposalStatusSchema,
    summary: boundedString(1_500),
    warnings: z.array(boundedString(1_000)).max(20).default([]),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const toolAuditResultSchema = z
  .object({
    invocationId: z.string().uuid(),
    requestId: boundedString(160),
    actor: actorSchema,
    riskLevel: z.enum(['read', 'proposal']),
    redaction: z.enum(['public_only', 'authorized_subset']),
    redactedRecordCount: z.number().int().nonnegative(),
  })
  .strict();

export function envelopeSchema<T extends z.ZodTypeAny>(data: T) {
  return z
    .object({
      ok: z.literal(true),
      tool: boundedString(128),
      audit: toolAuditResultSchema,
      data,
    })
    .strict();
}

export const listInputSchema = invocationInputSchema.merge(paginationSchema).strict();

export const investorFilterSchema = z
  .object({
    kinds: z.array(investorKindSchema).max(12).default([]),
    stages: z.array(boundedString(80)).max(20).default([]),
    sectors: z.array(boundedString(120)).max(50).default([]),
    geographies: z.array(boundedString(120)).max(50).default([]),
    targetOnly: z.boolean().default(false),
  })
  .strict()
  .default({ kinds: [], stages: [], sectors: [], geographies: [], targetOnly: false });

export const investorListInputSchema = listInputSchema
  .extend({ filters: investorFilterSchema })
  .strict();
export const investorSearchInputSchema = investorListInputSchema
  .extend({ query: boundedString(300) })
  .strict();
export const investorGetInputSchema = invocationInputSchema
  .extend({ investorId: recordIdSchema })
  .strict();

export const personFilterSchema = z
  .object({
    firmIds: z.array(recordIdSchema).max(50).default([]),
    sectors: z.array(boundedString(120)).max(50).default([]),
    targetOnly: z.boolean().default(false),
  })
  .strict()
  .default({ firmIds: [], sectors: [], targetOnly: false });

export const personListInputSchema = listInputSchema
  .extend({ filters: personFilterSchema })
  .strict();
export const personSearchInputSchema = personListInputSchema
  .extend({ query: boundedString(300) })
  .strict();
export const personGetInputSchema = invocationInputSchema
  .extend({ personId: recordIdSchema })
  .strict();

export const pipelineInputSchema = listInputSchema
  .extend({ stages: z.array(pipelineStageSchema).max(11).default([]) })
  .strict();
export const roundInputSchema = invocationInputSchema
  .extend({ roundId: recordIdSchema.optional() })
  .strict();
export const taskListInputSchema = listInputSchema
  .extend({
    status: z
      .array(z.enum(['open', 'done', 'dismissed']))
      .max(3)
      .default([]),
    investorId: recordIdSchema.optional(),
    personId: recordIdSchema.optional(),
  })
  .strict();
export const meetingListInputSchema = listInputSchema
  .extend({
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    status: z
      .array(z.enum(['upcoming', 'completed', 'cancelled']))
      .max(3)
      .default([]),
  })
  .strict();
export const knowledgeListInputSchema = invocationInputSchema
  .merge(paginationSchema.extend({ limit: z.number().int().min(1).max(25).default(20) }))
  .extend({
    categories: z
      .array(z.enum(['company', 'round', 'narrative', 'metrics', 'disclosure', 'other']))
      .max(6)
      .default([]),
  })
  .strict();
export const activityListInputSchema = listInputSchema
  .extend({
    investorId: recordIdSchema.optional(),
    personId: recordIdSchema.optional(),
    kinds: z
      .array(z.enum(['email', 'meeting', 'note', 'task', 'stage', 'source', 'agent']))
      .max(7)
      .default([]),
  })
  .strict();

const proposalBaseSchema = invocationInputSchema.extend({ reason: boundedString(1_500) });

export const proposeTargetInputSchema = proposalBaseSchema
  .extend({ investorId: recordIdSchema, target: z.boolean() })
  .strict();
export const proposeStageInputSchema = proposalBaseSchema
  .extend({ investorId: recordIdSchema, stage: pipelineStageSchema })
  .strict();
export const proposeTaskInputSchema = proposalBaseSchema
  .extend({
    title: boundedString(300),
    notes: optionalText(8_000),
    dueAt: isoDateTimeSchema.nullable().optional(),
    investorId: recordIdSchema.nullable().optional(),
    personId: recordIdSchema.nullable().optional(),
  })
  .strict();
export const proposeMeetingInputSchema = proposalBaseSchema
  .extend({
    title: boundedString(300),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    investorId: recordIdSchema.nullable().optional(),
    attendeePersonIds: z.array(recordIdSchema).max(50).default([]),
    location: optionalText(1_000),
    agenda: optionalText(8_000),
  })
  .strict()
  .refine((input) => Date.parse(input.endsAt) > Date.parse(input.startsAt), {
    message: 'Meeting end must be after meeting start',
    path: ['endsAt'],
  });
export const proposeKnowledgeInputSchema = proposalBaseSchema
  .extend({
    id: recordIdSchema.optional(),
    title: boundedString(300),
    category: z.enum(['company', 'round', 'narrative', 'metrics', 'disclosure', 'other']),
    content: z.string().min(1).max(20_000),
    sharePolicy: z.enum(['internal', 'safe_for_outreach', 'meeting_only', 'diligence_only']),
  })
  .strict();
export const proposeDraftInputSchema = proposalBaseSchema
  .extend({
    personId: recordIdSchema,
    provider: z.enum(['google', 'microsoft']),
    kind: z.enum(['initial', 'follow_up', 'intro_request', 'reply']),
    subject: z.string().trim().min(1).max(998),
    bodyText: z.string().min(1).max(20_000),
  })
  .strict();
export const proposeSourceReviewInputSchema = proposalBaseSchema
  .extend({
    reviewId: recordIdSchema,
    decision: z.enum(['accept', 'reject']),
  })
  .strict();

export type AuditContext = z.infer<typeof auditContextSchema>;
export type AccessRequest = z.infer<typeof accessRequestSchema>;
export type AccessGrant = z.infer<typeof accessGrantSchema>;
export type PrivateField = z.infer<typeof privateFieldSchema>;
export type InvestorRecord = z.infer<typeof investorRecordSchema>;
export type PersonRecord = z.infer<typeof personRecordSchema>;
export type PipelineItem = z.infer<typeof pipelineItemSchema>;
export type RoundRecord = z.infer<typeof roundRecordSchema>;
export type TaskRecord = z.infer<typeof taskRecordSchema>;
export type MeetingRecord = z.infer<typeof meetingRecordSchema>;
export type KnowledgeRecord = z.infer<typeof knowledgeRecordSchema>;
export type ActivityRecord = z.infer<typeof activityRecordSchema>;
export type ProposalResult = z.infer<typeof proposalResultSchema>;
