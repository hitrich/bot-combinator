export const IPC_CHANNELS = {
  bootstrap: 'bot-combinator:bootstrap',
  command: 'bot-combinator:command',
  selectFile: 'bot-combinator:select-file',
  selectDirectory: 'bot-combinator:select-directory',
  openExternal: 'bot-combinator:open-external',
  revealPath: 'bot-combinator:reveal-path',
  copyText: 'bot-combinator:copy-text',
  openLegal: 'bot-combinator:open-legal',
  oauthCallback: 'bot-combinator:oauth-callback',
  agentEvent: 'bot-combinator:agent-event',
} as const;

export type InvestorKind =
  | 'venture_capital'
  | 'micro_vc'
  | 'angel'
  | 'angel_network'
  | 'scout'
  | 'accelerator'
  | 'venture_studio'
  | 'corporate_vc'
  | 'family_office'
  | 'syndicate'
  | 'crypto_fund'
  | 'solo_gp';

export type PipelineStage =
  | 'researching'
  | 'ready'
  | 'intro_requested'
  | 'contacted'
  | 'meeting'
  | 'diligence'
  | 'partner_meeting'
  | 'soft_circle'
  | 'committed'
  | 'passed'
  | 'not_now';

export type Confidence = 'verified' | 'supported' | 'inferred' | 'unknown' | 'stale';
export type ConnectorProvider = 'google' | 'microsoft';
export type AgentProvider = 'codex' | 'claude';

export interface MoneyRange {
  currency: 'USD';
  minimum: number | null;
  maximum: number | null;
  typical: number | null;
}

export interface SourceRef {
  id: string;
  title: string;
  url: string;
  publisher: string;
  observedAt: string;
  confidence: Confidence;
  rights: 'redistributable' | 'link_only' | 'local_research' | 'unknown';
}

export interface InvestorSummary {
  id: string;
  name: string;
  kind: InvestorKind;
  additionalKinds: InvestorKind[];
  headquarters: string | null;
  geographies: string[];
  stages: string[];
  sectors: string[];
  check: MoneyRange;
  fitScore: number;
  fitReasons: string[];
  expectedCheckUsd: number | null;
  confidence: Confidence;
  sourceCount: number;
  peopleCount: number;
  portfolioCount: number;
  target: boolean;
  pipelineStage: PipelineStage | null;
  nextAction: string | null;
  nextActionAt: string | null;
  lastMessageAt: string | null;
  conflict: 'none' | 'possible' | 'direct';
  updatedAt: string;
}

export interface PersonSummary {
  id: string;
  name: string;
  firmId: string | null;
  firmName: string | null;
  title: string | null;
  investorKinds: InvestorKind[];
  sectors: string[];
  workEmail: string | null;
  personalEmail: string | null;
  email: string | null;
  emailConfidence: Confidence;
  linkedinUrl: string | null;
  xUrl: string | null;
  target: boolean;
  contacted: boolean;
  replied: boolean;
  canSendInitial: boolean;
  suppressionReason: string | null;
  lastInteractionAt: string | null;
  nextAction: string | null;
}

export interface PortfolioExample {
  id: string;
  investorId: string;
  companyName: string;
  sector: string | null;
  round: string | null;
  announcedAt: string | null;
  source: SourceRef;
}

export interface InvestorDetail extends InvestorSummary {
  website: string | null;
  description: string | null;
  thesis: string | null;
  applicationUrl: string | null;
  contactEmail: string | null;
  leadBehavior: string | null;
  currentFund: string | null;
  people: PersonSummary[];
  portfolio: PortfolioExample[];
  sources: SourceRef[];
  activity: ActivityItem[];
}

export interface RoundState {
  id: string;
  companyName: string;
  companyOneLiner: string;
  stage: 'pre_seed' | 'seed' | 'series_a';
  targetAmount: number;
  committedAmount: number;
  softCircleAmount: number;
  targetCheck: MoneyRange;
  sectors: string[];
  geographies: string[];
  leadRequired: boolean;
  launchDate: string | null;
  targetCloseDate: string | null;
  narrative: string;
  status: 'planning' | 'active' | 'paused' | 'closed';
}

export interface PipelineColumn {
  stage: PipelineStage;
  label: string;
  targetIds: string[];
}

export interface WorkItem {
  id: string;
  kind: 'task' | 'approval' | 'meeting' | 'follow_up' | 'research' | 'source_review';
  title: string;
  detail: string;
  dueAt: string | null;
  investorId: string | null;
  personId: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'open' | 'done' | 'dismissed';
}

export interface TaskItem {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: 'open' | 'done' | 'dismissed';
  investorId: string | null;
  personId: string | null;
  createdAt: string;
}

export interface MeetingItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  provider: ConnectorProvider | 'manual';
  investorId: string | null;
  personIds: string[];
  location: string | null;
  agenda: string | null;
  notes: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
}

export interface ActivityItem {
  id: string;
  kind: 'email' | 'meeting' | 'note' | 'task' | 'stage' | 'source' | 'agent';
  title: string;
  detail: string | null;
  occurredAt: string;
  actor: 'founder' | 'system' | 'agent' | 'provider';
}

export interface MailEventItem {
  id: string;
  provider: ConnectorProvider;
  personId: string;
  personName: string;
  investorId: string | null;
  direction: 'inbound' | 'outbound';
  kind: 'message' | 'reply' | 'bounce' | 'hard_bounce' | 'complaint' | 'unsubscribe';
  subject: string;
  occurredAt: string;
  reviewedAt: string | null;
}

export interface SuppressionItem {
  id: string;
  scope: 'global' | 'email' | 'domain' | 'person' | 'firm';
  value: string;
  reason: string;
  source: 'founder' | 'unsubscribe' | 'bounce' | 'complaint' | 'policy' | 'import';
  active: boolean;
  updatedAt: string;
}

export interface CommunicationPolicy {
  sendingPaused: boolean;
  dailySendLimit: number;
  reservedToday: number;
  hourlySendLimit: number;
  reservedThisHour: number;
  recipientDomainDailyLimit: number;
  recipientDomainCooldownMinutes: number;
  postalAddress: string | null;
  optOutText: string;
}

export interface AuditIntegrityStatus {
  ok: boolean;
  entries: number;
  errorAt: number | null;
}

export interface DraftMessage {
  id: string;
  provider: ConnectorProvider;
  accountEmail: string;
  personId: string;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  threadId: string | null;
  kind: 'initial' | 'follow_up' | 'intro_request' | 'reply';
  contentHash: string;
  approvalState: 'draft' | 'approved' | 'sending' | 'sent' | 'blocked' | 'failed' | 'ambiguous';
  blockReason: string | null;
  canApprove: boolean;
  canSend: boolean;
  approvalBlockReasons: string[];
  sendBlockReasons: string[];
  approvedAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: 'company' | 'round' | 'narrative' | 'metrics' | 'disclosure' | 'other';
  content: string;
  updatedAt: string;
  sharePolicy: 'internal' | 'safe_for_outreach' | 'meeting_only' | 'diligence_only';
}

export type BotChainDocCategory =
  'start_here' | 'application' | 'integration' | 'bdex' | 'bo_wallet' | 'liquidity' | 'security';

export interface BotChainDocument {
  id: string;
  path: string;
  title: string;
  description: string;
  category: BotChainDocCategory;
  importance: 'required' | 'recommended' | 'reference';
  status: 'preview' | 'approved' | 'stale' | 'superseded';
  version: string;
  tags: string[];
  sourceOwner: string;
  sourceUrl: string | null;
  approvedAt: string | null;
  lastCheckedAt: string;
  rights: 'project_authored' | 'redistributable' | 'link_only' | 'unknown';
  visibility: 'applicant' | 'klineo_internal' | 'bot_chain_partner' | 'public';
  sha256: string;
  sizeBytes: number;
  content: string;
}

export interface BotChainDocsBundle {
  id: string;
  title: string;
  version: string;
  status: 'preview' | 'approved' | 'stale';
  owner: string;
  publishedAt: string;
  nextReviewAt: string | null;
  manifestSha256: string;
  documents: BotChainDocument[];
}

export type ProgramProjectStage =
  | 'sourced'
  | 'invited'
  | 'applied'
  | 'screening'
  | 'qualified'
  | 'cohort'
  | 'integration_ready'
  | 'liquidity_ready'
  | 'launch_scheduled'
  | 'live_market'
  | 'graduated'
  | 'on_hold'
  | 'declined'
  | 'withdrawn';

export type ProgramGateStatus =
  'not_started' | 'in_review' | 'needs_work' | 'passed' | 'blocked' | 'waived';

export interface ProgramGateDefinition {
  key: string;
  version: number;
  title: string;
  description: string;
  sortOrder: number;
}

export interface ProgramGateReview {
  id: string;
  projectId: string;
  gateKey: string;
  gateVersion: number;
  status: ProgramGateStatus;
  rationale: string | null;
  evidence: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface ProgramMilestone {
  id: string;
  projectId: string;
  cohortId: string | null;
  title: string;
  category:
    | 'onboarding'
    | 'product'
    | 'security'
    | 'integration'
    | 'bdex'
    | 'bo_wallet'
    | 'liquidity'
    | 'launch'
    | 'community'
    | 'reporting';
  owner: string | null;
  dueAt: string | null;
  evidenceRequired: string | null;
  evidence: string | null;
  status: 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ProgramMetricObservation {
  id: string;
  projectId: string | null;
  key: string;
  value: number;
  unit: string;
  observedAt: string;
  sourceLabel: string;
  quality: 'verified' | 'supported' | 'reported' | 'stale' | 'unknown';
  createdAt: string;
}

export interface ProgramProject {
  id: string;
  programId: string;
  name: string;
  website: string | null;
  description: string | null;
  stage: ProgramProjectStage;
  source: 'sourced' | 'application' | 'referral' | 'local';
  ownerName: string | null;
  ownerEmail: string | null;
  targetLaunchAt: string | null;
  launchedAt: string | null;
  cohortId: string | null;
  cohortName: string | null;
  gates: ProgramGateReview[];
  milestones: ProgramMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramCohort {
  id: string;
  programId: string;
  name: string;
  thesis: string | null;
  startsOn: string | null;
  endsOn: string | null;
  capacity: number | null;
  status: 'planning' | 'applications_open' | 'active' | 'completed' | 'cancelled';
  memberProjectIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramWorkspace {
  id: string;
  name: string;
  partnerName: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  grantPeriodStart: string | null;
  grantPeriodEnd: string | null;
  projects: ProgramProject[];
  cohorts: ProgramCohort[];
  gateDefinitions: ProgramGateDefinition[];
  metrics: ProgramMetricObservation[];
  summary: {
    totalProjects: number;
    activeCohortProjects: number;
    integrationReady: number;
    liquidityReady: number;
    liveMarkets: number;
    graduated: number;
    blockedGates: number;
    overdueMilestones: number;
  };
}

export interface PortalSubmissionBundle {
  schemaVersion: 1;
  exportedAt: string;
  source: {
    application: 'Bot Combinator Desktop';
    mode: 'explicit_program_submission';
  };
  privacy: {
    visibility: 'project_private' | 'project_and_klineo';
    omittedDataClasses: string[];
  };
  project: {
    localProjectId: string;
    name: string;
    website: string | null;
    description: string | null;
    stage: ProgramProjectStage;
    targetLaunchAt: string | null;
    cohortName: string | null;
  };
  submission: {
    gates: Array<{
      key: string;
      version: number;
      title: string;
      status: ProgramGateStatus;
      rationale: string | null;
      evidence: string | null;
      reviewedAt: string | null;
    }>;
    milestones: Array<{
      localMilestoneId: string;
      title: string;
      category: ProgramMilestone['category'];
      dueAt: string | null;
      status: ProgramMilestone['status'];
      evidenceRequired: string | null;
      evidence: string | null;
      updatedAt: string;
    }>;
  };
  canonicalPayload: string;
  contentDigest: string;
}

export interface ListItem {
  id: string;
  name: string;
  description: string | null;
  count: number;
  memberFirmIds: string[];
}

export interface ConnectorStatus {
  provider: ConnectorProvider;
  state: 'not_configured' | 'configured' | 'connecting' | 'connected' | 'error';
  accountEmail: string | null;
  scopes: string[];
  relationshipSync: boolean;
  lastSyncAt: string | null;
  error: string | null;
  encryptionAvailable: boolean;
}

export interface AgentStatus {
  provider: AgentProvider;
  state: 'not_installed' | 'signed_out' | 'ready' | 'running' | 'error';
  version: string | null;
  accountLabel: string | null;
  mode: 'embedded' | 'mcp_companion';
  /** True only after the founder explicitly confirms Anthropic approval on this device. */
  subscriptionAuthApproved: boolean;
  error: string | null;
}

export interface AgentContextGrant {
  provider: AgentProvider;
  contextClass: 'round' | 'company' | 'investors' | 'activity' | 'bot_chain_docs';
  grantedAt: string;
}

export type AgentProposalKind = 'draft' | 'task' | 'pipeline_move' | 'note' | 'research';

export interface AgentProposalPayload {
  kind: AgentProposalKind;
  title: string;
  rationale: string;
  investorId: string | null;
  payload: Record<string, unknown>;
}

export interface AgentEvent {
  runId: string;
  type: 'started' | 'message' | 'tool_proposal' | 'completed' | 'error';
  text: string;
  proposalId?: string;
  proposal?: AgentProposalPayload;
}

export interface AgentProposalItem extends AgentProposalPayload {
  id: string;
  agentRunId: string;
  provider: AgentProvider;
  status: 'pending';
  createdAt: string;
}

export interface AgentProposalReviewResult {
  id: string;
  status: 'accepted' | 'rejected';
  operation: 'applied' | 'rejected' | 'converted_to_task';
  appliedEntityType: 'task' | 'message' | 'target' | null;
  appliedEntityId: string | null;
}

export interface SourceReviewItem {
  id: string;
  entityName: string;
  field: string;
  currentValue: string | null;
  proposedValue: string;
  source: SourceRef;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AppBootstrap {
  appVersion: string;
  platform: 'darwin' | 'win32' | 'linux' | 'other';
  vaultPath: string;
  isFirstRun: boolean;
  seedVersion: string;
  seedSignatureStatus: string;
  round: RoundState | null;
  investors: InvestorSummary[];
  people: PersonSummary[];
  pipeline: PipelineColumn[];
  workItems: WorkItem[];
  tasks: TaskItem[];
  meetings: MeetingItem[];
  mailEvents: MailEventItem[];
  drafts: DraftMessage[];
  knowledge: KnowledgeItem[];
  botChainDocs: BotChainDocsBundle;
  ecosystemProgram: ProgramWorkspace;
  lists: ListItem[];
  sourceReview: SourceReviewItem[];
  connectors: ConnectorStatus[];
  agents: AgentStatus[];
  agentContextGrants: AgentContextGrant[];
  agentProposals: AgentProposalItem[];
  suppressions: SuppressionItem[];
  communicationPolicy: CommunicationPolicy;
  auditIntegrity: AuditIntegrityStatus;
  counts: {
    firms: number;
    people: number;
    targeted: number;
    contacted: number;
    meetings: number;
    commitments: number;
  };
}

export interface FounderSetupInput {
  founderName: string;
  founderEmail: string;
  companyName: string;
  companyOneLiner: string;
  stage: RoundState['stage'];
  targetAmount: number;
  targetCheckMinimum: number | null;
  targetCheckMaximum: number | null;
  sectors: string[];
  geographies: string[];
  narrative: string;
  postalAddress?: string;
}

export interface CommandMap {
  'onboarding.complete': FounderSetupInput;
  'investor.get': { id: string };
  'investor.create': {
    name: string;
    kind: InvestorKind;
    website?: string;
    headquarters?: string;
    description?: string;
  };
  'investor.target': { id: string; target: boolean };
  'person.contact.add':
    | {
        personId: string;
        kind: 'work_email' | 'linkedin' | 'x';
        value: string;
        visibility: 'private' | 'public';
        sourceUrl?: string;
        contributionEligible: boolean;
      }
    | {
        personId: string;
        kind: 'personal_email';
        value: string;
        visibility: 'private';
        contributionEligible: false;
      };
  'pipeline.move': { investorId: string; stage: PipelineStage };
  'pipeline.amount': { investorId: string; expectedCheckUsd: number | null };
  'pipeline.nextAction': {
    investorId: string;
    nextAction: string | null;
    nextActionAt: string | null;
  };
  'round.update': {
    stage: RoundState['stage'];
    targetAmount: number;
    targetCheckMinimum: number | null;
    targetCheckMaximum: number | null;
    sectors: string[];
    geographies: string[];
    narrative: string;
    status: RoundState['status'];
  };
  'task.create': Omit<TaskItem, 'id' | 'createdAt'>;
  'task.update': { id: string; status?: TaskItem['status']; title?: string; dueAt?: string | null };
  'meeting.create': Omit<MeetingItem, 'id'>;
  'meeting.update': { id: string; agenda: string | null; notes: string | null };
  'knowledge.save': Omit<KnowledgeItem, 'id' | 'updatedAt'> & { id?: string };
  'botChain.docs.export': {
    directory: string;
    mode: 'guide' | 'selected' | 'full';
    documentIds: string[];
  };
  'program.project.create': {
    name: string;
    website: string | null;
    description: string | null;
    source: ProgramProject['source'];
    ownerName: string | null;
    ownerEmail: string | null;
    targetLaunchAt: string | null;
  };
  'program.project.stage': {
    projectId: string;
    stage: ProgramProjectStage;
    reason: string;
  };
  'program.gate.review': {
    projectId: string;
    gateKey: string;
    status: ProgramGateStatus;
    rationale: string | null;
    evidence: string | null;
    reviewedBy: string | null;
  };
  'program.cohort.create': {
    name: string;
    thesis: string | null;
    startsOn: string | null;
    endsOn: string | null;
    capacity: number | null;
  };
  'program.cohort.assign': {
    cohortId: string;
    projectId: string;
    state: 'accepted' | 'active' | 'completed' | 'withdrawn';
  };
  'program.milestone.create': Omit<
    ProgramMilestone,
    'id' | 'status' | 'evidence' | 'createdAt' | 'updatedAt'
  >;
  'program.milestone.update': {
    id: string;
    status: ProgramMilestone['status'];
    evidence: string | null;
  };
  'program.metric.record': Omit<ProgramMetricObservation, 'id' | 'createdAt'>;
  'program.partnerReport.export': { directory: string };
  'program.portalSubmission.export': {
    directory: string;
    projectId: string;
    visibility: PortalSubmissionBundle['privacy']['visibility'];
    includeMilestones: boolean;
    includeGateReviews: boolean;
  };
  'list.create': {
    name: string;
    description: string | null;
    memberFirmIds?: string[];
  };
  'list.update': {
    id: string;
    name: string;
    description: string | null;
    memberFirmIds: string[];
  };
  'draft.create': Pick<DraftMessage, 'personId' | 'provider' | 'kind' | 'subject' | 'bodyText'> & {
    threadId?: string | null;
  };
  'draft.update': { id: string; subject?: string; bodyText?: string };
  'draft.approve': { id: string; expectedContentHash: string };
  'draft.send': { id: string; expectedContentHash: string };
  'source.review': { id: string; decision: 'accept' | 'reject' };
  'connector.configure': {
    provider: ConnectorProvider;
    clientId: string;
    tenantId?: string;
    relationshipSync: boolean;
  };
  'connector.connect': { provider: ConnectorProvider };
  'connector.disconnect': { provider: ConnectorProvider };
  'connector.test': { provider: ConnectorProvider };
  'connector.syncCalendar': { provider: ConnectorProvider };
  'connector.syncMail': { provider: ConnectorProvider };
  'mail.review': { id: string };
  'communications.policy.update': {
    sendingPaused: boolean;
    dailySendLimit: number;
    hourlySendLimit: number;
    recipientDomainDailyLimit: number;
    recipientDomainCooldownMinutes: number;
    postalAddress: string | null;
    optOutText: string;
  };
  'suppression.add': {
    scope: SuppressionItem['scope'];
    value: string;
    reason: string;
  };
  'suppression.remove': { id: string };
  'agent.detect': { provider: AgentProvider };
  'agent.login': { provider: AgentProvider };
  'agent.logout': { provider: AgentProvider };
  'agent.credential.set': { provider: 'claude'; credential: string };
  'agent.credential.remove': { provider: 'claude' };
  'agent.subscription.set':
    | { provider: 'claude'; approved: true; approvalConfirmed: true }
    | { provider: 'claude'; approved: false };
  'agent.contextGrant.set': {
    provider: AgentProvider;
    contextClass: AgentContextGrant['contextClass'];
    granted: boolean;
  };
  'agent.run': {
    provider: AgentProvider;
    prompt: string;
    disclosedContextIds: AgentContextGrant['contextClass'][];
    botChainDocumentIds?: string[];
  };
  'agent.cancel': { runId: string };
  'agent.proposal.review': {
    id: string;
    decision: 'apply' | 'reject' | 'convert_to_task';
  };
  'backup.export': { directory: string; password: string };
  'backup.restore': { path: string; password: string };
  'contribution.export': { directory: string };
  'data.importSeed': { path: string };
  'data.exportCsv': { directory: string; kind: 'investors' | 'people' | 'pipeline' | 'activity' };
  'data.reset': { confirmation: 'DELETE' };
  search: { query: string };
}

export interface CommandResultMap {
  'onboarding.complete': AppBootstrap;
  'investor.get': InvestorDetail;
  'investor.create': InvestorSummary;
  'investor.target': AppBootstrap;
  'person.contact.add': PersonSummary;
  'pipeline.move': AppBootstrap;
  'pipeline.amount': InvestorSummary;
  'pipeline.nextAction': InvestorSummary;
  'round.update': RoundState;
  'task.create': TaskItem;
  'task.update': TaskItem;
  'meeting.create': MeetingItem;
  'meeting.update': MeetingItem;
  'knowledge.save': KnowledgeItem;
  'botChain.docs.export': {
    path: string;
    bundleVersion: string;
    manifestSha256: string;
    documentCount: number;
  };
  'program.project.create': ProgramWorkspace;
  'program.project.stage': ProgramWorkspace;
  'program.gate.review': ProgramWorkspace;
  'program.cohort.create': ProgramWorkspace;
  'program.cohort.assign': ProgramWorkspace;
  'program.milestone.create': ProgramWorkspace;
  'program.milestone.update': ProgramWorkspace;
  'program.metric.record': ProgramWorkspace;
  'program.partnerReport.export': { path: string };
  'program.portalSubmission.export': {
    path: string;
    contentDigest: string;
  };
  'list.create': ListItem;
  'list.update': ListItem;
  'draft.create': DraftMessage;
  'draft.update': DraftMessage;
  'draft.approve': DraftMessage;
  'draft.send': DraftMessage;
  'source.review': SourceReviewItem;
  'connector.configure': ConnectorStatus;
  'connector.connect': ConnectorStatus;
  'connector.disconnect': ConnectorStatus;
  'connector.test': ConnectorStatus;
  'connector.syncCalendar': AppBootstrap;
  'connector.syncMail': AppBootstrap;
  'mail.review': MailEventItem;
  'communications.policy.update': CommunicationPolicy;
  'suppression.add': SuppressionItem;
  'suppression.remove': SuppressionItem;
  'agent.detect': AgentStatus;
  'agent.login': AgentStatus;
  'agent.logout': AgentStatus;
  'agent.credential.set': AgentStatus;
  'agent.credential.remove': AgentStatus;
  'agent.subscription.set': AgentStatus;
  'agent.contextGrant.set': AgentContextGrant[];
  'agent.run': { runId: string };
  'agent.cancel': { cancelled: boolean };
  'agent.proposal.review': AgentProposalReviewResult;
  'backup.export': { path: string };
  'backup.restore': AppBootstrap;
  'contribution.export': { databasePath: string; diffPath: string };
  'data.importSeed': { imported: number; skipped: number; updated: number };
  'data.exportCsv': { path: string };
  'data.reset': { scheduled: true };
  search: Array<{
    id: string;
    kind: 'investor' | 'person' | 'task' | 'meeting' | 'knowledge';
    title: string;
    subtitle: string;
    href: string;
  }>;
}

export interface BotCombinatorBridge {
  bootstrap: () => Promise<AppBootstrap>;
  command: <K extends keyof CommandMap>(
    command: K,
    payload: CommandMap[K],
  ) => Promise<CommandResultMap[K]>;
  selectFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  revealPath: (path: string) => Promise<void>;
  copyText: (text: string) => Promise<void>;
  openLegal: (document: 'license' | 'notice' | 'third-party') => Promise<void>;
  onAgentEvent: (listener: (event: AgentEvent) => void) => () => void;
}

declare global {
  interface Window {
    botCombinator: BotCombinatorBridge;
  }
}
