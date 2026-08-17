import type { z } from 'zod';

import type {
  AccessGrant,
  AccessRequest,
  ActivityRecord,
  AuditContext,
  InvestorRecord,
  KnowledgeRecord,
  MeetingRecord,
  PersonRecord,
  PipelineItem,
  ProposalResult,
  RoundRecord,
  TaskRecord,
} from './schemas.js';
import type {
  activityListInputSchema,
  investorGetInputSchema,
  investorListInputSchema,
  investorSearchInputSchema,
  knowledgeListInputSchema,
  meetingListInputSchema,
  personGetInputSchema,
  personListInputSchema,
  personSearchInputSchema,
  pipelineInputSchema,
  proposeDraftInputSchema,
  proposeKnowledgeInputSchema,
  proposeMeetingInputSchema,
  proposeSourceReviewInputSchema,
  proposeStageInputSchema,
  proposeTargetInputSchema,
  proposeTaskInputSchema,
  roundInputSchema,
  taskListInputSchema,
} from './schemas.js';

export type RiskLevel = 'read' | 'proposal';
export type AuditPhase = 'requested' | 'succeeded' | 'failed';

export interface ServiceInvocationContext {
  invocationId: string;
  toolName: string;
  riskLevel: RiskLevel;
  audit: AuditContext;
  requestedAccess: AccessRequest;
  accessGrant: AccessGrant;
}

export interface AuditEvent {
  invocationId: string;
  toolName: string;
  riskLevel: RiskLevel;
  phase: AuditPhase;
  actor: AuditContext['actor'];
  sessionId: string;
  requestId: string;
  purpose: string;
  occurredAt: string;
  redactedRecordCount?: number;
  errorCode?: 'AUDIT_FAILURE' | 'AUTHORIZATION_FAILURE' | 'SERVICE_FAILURE' | 'OUTPUT_REJECTED';
}

export type InvestorPage = Page<InvestorRecord>;
export type PersonPage = Page<PersonRecord>;
export type PipelinePage = Page<PipelineItem>;
export type TaskPage = Page<TaskRecord>;
export type MeetingPage = Page<MeetingRecord>;
export type KnowledgePage = Page<KnowledgeRecord>;
export type ActivityPage = Page<ActivityRecord>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total?: number | undefined;
}

type ControlFields = 'audit' | 'access';
export type InvestorSearchQuery = Omit<z.infer<typeof investorSearchInputSchema>, ControlFields>;
export type InvestorListQuery = Omit<z.infer<typeof investorListInputSchema>, ControlFields>;
export type InvestorGetQuery = Omit<z.infer<typeof investorGetInputSchema>, ControlFields>;
export type PersonSearchQuery = Omit<z.infer<typeof personSearchInputSchema>, ControlFields>;
export type PersonListQuery = Omit<z.infer<typeof personListInputSchema>, ControlFields>;
export type PersonGetQuery = Omit<z.infer<typeof personGetInputSchema>, ControlFields>;
export type PipelineQuery = Omit<z.infer<typeof pipelineInputSchema>, ControlFields>;
export type RoundQuery = Omit<z.infer<typeof roundInputSchema>, ControlFields>;
export type TaskListQuery = Omit<z.infer<typeof taskListInputSchema>, ControlFields>;
export type MeetingListQuery = Omit<z.infer<typeof meetingListInputSchema>, ControlFields>;
export type KnowledgeListQuery = Omit<z.infer<typeof knowledgeListInputSchema>, ControlFields>;
export type ActivityListQuery = Omit<z.infer<typeof activityListInputSchema>, ControlFields>;
export type ProposeTargetInput = Omit<z.infer<typeof proposeTargetInputSchema>, ControlFields>;
export type ProposeStageInput = Omit<z.infer<typeof proposeStageInputSchema>, ControlFields>;
export type ProposeTaskInput = Omit<z.infer<typeof proposeTaskInputSchema>, ControlFields>;
export type ProposeMeetingInput = Omit<z.infer<typeof proposeMeetingInputSchema>, ControlFields>;
export type ProposeKnowledgeInput = Omit<
  z.infer<typeof proposeKnowledgeInputSchema>,
  ControlFields
>;
export type ProposeDraftInput = Omit<z.infer<typeof proposeDraftInputSchema>, ControlFields>;
export type ProposeSourceReviewInput = Omit<
  z.infer<typeof proposeSourceReviewInputSchema>,
  ControlFields
>;

/**
 * The Electron main process supplies this adapter. The MCP package never sees a
 * database handle, provider credential, OAuth token, filesystem path, or shell.
 * Every mutating method creates only a pending proposal for founder review.
 */
export interface BotCombinatorMcpService {
  authorizeAccess(
    request: AccessRequest,
    context: Omit<ServiceInvocationContext, 'accessGrant'>,
  ): Promise<AccessGrant>;
  recordAuditEvent(event: AuditEvent): Promise<void>;

  searchInvestors(
    query: InvestorSearchQuery,
    context: ServiceInvocationContext,
  ): Promise<InvestorPage>;
  listInvestors(query: InvestorListQuery, context: ServiceInvocationContext): Promise<InvestorPage>;
  getInvestor(query: InvestorGetQuery, context: ServiceInvocationContext): Promise<InvestorRecord>;
  searchPeople(query: PersonSearchQuery, context: ServiceInvocationContext): Promise<PersonPage>;
  listPeople(query: PersonListQuery, context: ServiceInvocationContext): Promise<PersonPage>;
  getPerson(query: PersonGetQuery, context: ServiceInvocationContext): Promise<PersonRecord>;
  getPipeline(query: PipelineQuery, context: ServiceInvocationContext): Promise<PipelinePage>;
  getRound(query: RoundQuery, context: ServiceInvocationContext): Promise<RoundRecord | null>;
  listTasks(query: TaskListQuery, context: ServiceInvocationContext): Promise<TaskPage>;
  listMeetings(query: MeetingListQuery, context: ServiceInvocationContext): Promise<MeetingPage>;
  listKnowledge(
    query: KnowledgeListQuery,
    context: ServiceInvocationContext,
  ): Promise<KnowledgePage>;
  listActivity(query: ActivityListQuery, context: ServiceInvocationContext): Promise<ActivityPage>;

  proposeTarget(
    input: ProposeTargetInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
  proposeStage(
    input: ProposeStageInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
  proposeTask(input: ProposeTaskInput, context: ServiceInvocationContext): Promise<ProposalResult>;
  proposeMeeting(
    input: ProposeMeetingInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
  proposeKnowledge(
    input: ProposeKnowledgeInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
  proposeDraft(
    input: ProposeDraftInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
  proposeSourceReview(
    input: ProposeSourceReviewInput,
    context: ServiceInvocationContext,
  ): Promise<ProposalResult>;
}

export interface BotCombinatorMcpServerOptions {
  name?: string;
  version?: string;
  now?: () => Date;
  createInvocationId?: () => string;
  /** Omitted exposes the package's complete host API; supplied disables every unlisted tool. */
  enabledTools?: readonly string[];
}
