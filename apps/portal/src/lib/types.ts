export const VISIBILITIES = [
  'project_private',
  'project_and_klineo',
  'bot_chain',
  'public',
] as const;

export type Visibility = (typeof VISIBILITIES)[number];

export type PortalRole =
  | 'klineo_admin'
  | 'klineo_operator'
  | 'klineo_reviewer'
  | 'bot_chain_reviewer'
  | 'bot_chain_viewer'
  | 'project_lead'
  | 'project_member';

export type ProjectStage =
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

export type ReadinessState = 'not_started' | 'in_progress' | 'ready' | 'blocked';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export interface PortalUser {
  id: string;
  email: string;
  fullName: string;
  role: PortalRole;
  organizationName: string;
}

export interface PortalProject {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  stage: ProjectStage;
  progressPercent: number;
  cohortName: string | null;
  targetLaunchAt: string | null;
  lastUpdateAt: string | null;
  websiteUrl: string | null;
  demoUrl: string | null;
  repositoryUrl: string | null;
  videoUrl: string | null;
  documentationUrl: string | null;
  integrationReadiness: ReadinessState;
  liquidityReadiness: ReadinessState;
  launchReadiness: ReadinessState;
  accent: string;
}

export interface ProgressUpdate {
  id: string;
  projectId: string;
  version: number;
  title: string;
  summary: string;
  accomplishments: string[];
  nextSteps: string[];
  progressPercent: number;
  integrationReadiness: ReadinessState;
  liquidityReadiness: ReadinessState;
  launchReadiness: ReadinessState;
  visibility: Visibility;
  submittedAt: string;
  submittedByName: string;
  contentDigest: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  category: string;
  status: MilestoneStatus;
  dueAt: string | null;
  ownerName: string | null;
  evidenceUrl: string | null;
  visibility: Visibility;
}

export interface Blocker {
  id: string;
  projectId: string;
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'monitoring' | 'resolved';
  ownerName: string | null;
  visibility: Visibility;
  createdAt: string;
}

export interface ShowcaseAsset {
  id: string;
  showcaseItemId: string;
  projectId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  signedUrl: string | null;
}

export interface ShowcaseItem {
  id: string;
  projectId: string;
  type: 'screenshot' | 'demo' | 'website' | 'repository' | 'video' | 'documentation';
  title: string;
  description: string;
  url: string | null;
  visibility: Visibility;
  status: 'draft' | 'submitted' | 'approved' | 'changes_requested';
  createdAt: string;
  assets: ShowcaseAsset[];
}

export interface PortalComment {
  id: string;
  projectId: string;
  subjectType: 'project' | 'progress_update' | 'milestone' | 'showcase_item' | 'review_request';
  subjectId: string;
  body: string;
  authorName: string;
  authorRole: PortalRole;
  visibility: Visibility | 'klineo_internal';
  createdAt: string;
}

export interface ReviewRequest {
  id: string;
  projectId: string;
  subjectType: 'progress_update' | 'milestone' | 'showcase_item' | 'gate';
  subjectId: string;
  title: string;
  status: 'requested' | 'in_review' | 'changes_requested' | 'approved' | 'closed';
  requestedAt: string;
  dueAt: string | null;
  requestedByName: string;
  assignedToName: string | null;
}

export interface VisibilityApproval {
  id: string;
  projectId: string;
  subjectType: 'progress_update' | 'milestone' | 'blocker' | 'showcase_item';
  subjectId: string;
  fromVisibility: Visibility;
  toVisibility: Visibility;
  status: 'requested' | 'approved' | 'rejected' | 'revoked';
  requestedByName: string;
  requestedAt: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface Cohort {
  id: string;
  name: string;
  status: 'planning' | 'applications_open' | 'active' | 'completed';
  startsOn: string | null;
  endsOn: string | null;
  projectIds: string[];
}

export interface AuditEvent {
  id: string;
  projectId: string | null;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface DesktopSubmissionImport {
  id: string;
  projectId: string;
  localProjectId: string;
  schemaVersion: number;
  contentDigest: string;
  importedAt: string;
}

export interface PortalWorkspace {
  user: PortalUser;
  projects: PortalProject[];
  progressUpdates: ProgressUpdate[];
  milestones: Milestone[];
  blockers: Blocker[];
  showcaseItems: ShowcaseItem[];
  comments: PortalComment[];
  reviewRequests: ReviewRequest[];
  visibilityApprovals: VisibilityApproval[];
  cohorts: Cohort[];
  desktopSubmissionImports: DesktopSubmissionImport[];
  auditEvents: AuditEvent[];
}

export interface PublicShowcaseData {
  projects: PortalProject[];
  showcaseItems: ShowcaseItem[];
}

export interface ProgressUpdateInput {
  projectId: string;
  title: string;
  summary: string;
  accomplishments: string[];
  nextSteps: string[];
  progressPercent: number;
  integrationReadiness: ReadinessState;
  liquidityReadiness: ReadinessState;
  launchReadiness: ReadinessState;
  visibility: Visibility;
}

export interface ShowcaseInput {
  projectId: string;
  type: ShowcaseItem['type'];
  title: string;
  description: string;
  url: string | null;
  visibility: Visibility;
}

export interface InviteInput {
  email: string;
  fullName: string;
  projectId: string | null;
  role: PortalRole;
}

export interface CreateProjectInput {
  name: string;
  tagline: string;
  description: string;
  websiteUrl: string | null;
  targetLaunchAt: string | null;
  cohortId: string | null;
}

export interface ProjectProfileInput {
  projectId: string;
  tagline: string;
  description: string;
  websiteUrl: string | null;
  demoUrl: string | null;
  repositoryUrl: string | null;
  videoUrl: string | null;
  documentationUrl: string | null;
  targetLaunchAt: string | null;
}

export interface ProjectStageInput {
  projectId: string;
  stage: ProjectStage;
}

export interface MilestoneInput {
  projectId: string;
  title: string;
  category: string;
  dueAt: string | null;
  ownerName: string | null;
  evidenceUrl: string | null;
  visibility: 'project_private' | 'project_and_klineo';
}

export interface BlockerInput {
  projectId: string;
  title: string;
  detail: string;
  severity: Blocker['severity'];
  ownerName: string | null;
  visibility: 'project_private' | 'project_and_klineo';
}

export interface DeliveryStatusInput {
  subjectType: 'milestone' | 'blocker';
  subjectId: string;
  status: MilestoneStatus | Blocker['status'];
}

export interface ReviewRequestInput {
  projectId: string;
  subjectType: ReviewRequest['subjectType'];
  subjectId: string;
  title: string;
  dueAt: string | null;
}

export interface CreateCohortInput {
  name: string;
  startsOn: string | null;
  endsOn: string | null;
}
