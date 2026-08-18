import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { createDemoWorkspace } from '../lib/demo-data';
import { sanitizeShowcaseImage } from '../lib/images';
import {
  addComment as addCommentRemote,
  cancelPortalInvitation as cancelPortalInvitationRemote,
  createBlocker as createBlockerRemote,
  createCohort as createCohortRemote,
  createMilestone as createMilestoneRemote,
  createProject as createProjectRemote,
  createShowcase as createShowcaseRemote,
  decideReview as decideReviewRemote,
  decideVisibility as decideVisibilityRemote,
  getSession,
  importDesktopSubmission as importDesktopSubmissionRemote,
  inviteMember as inviteMemberRemote,
  loadPortalWorkspace,
  requestMagicLink,
  requestReview as requestReviewRemote,
  requestVisibility as requestVisibilityRemote,
  removePortalAccess as removePortalAccessRemote,
  reviewProjectApplication as reviewProjectApplicationRemote,
  revokeVisibility as revokeVisibilityRemote,
  signOut as signOutRemote,
  submitProgressUpdate as submitProgressUpdateRemote,
  submitProjectApplication as submitProjectApplicationRemote,
  updateDeliveryStatus as updateDeliveryStatusRemote,
  updatePortalAccess as updatePortalAccessRemote,
  updateProjectProfile as updateProjectProfileRemote,
  updateProjectStage as updateProjectStageRemote,
  uploadShowcaseScreenshot,
} from '../lib/portal-api';
import { demoMode, portalConfigured, supabase } from '../lib/supabase';
import type {
  BlockerInput,
  CreateCohortInput,
  CreateProjectInput,
  DeliveryStatusInput,
  InviteInput,
  MilestoneInput,
  PortalAccessMember,
  PortalComment,
  PortalRole,
  PortalWorkspace,
  ProgressUpdateInput,
  ProjectApplicationInput,
  ProjectProfileInput,
  ProjectStageInput,
  ReviewRequestInput,
  ReviewApplicationInput,
  ShowcaseInput,
  UpdateAccessInput,
  Visibility,
} from '../lib/types';

interface Toast {
  id: string;
  tone: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

interface PortalContextValue {
  workspace: PortalWorkspace | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  demo: boolean;
  error: string | null;
  toasts: Toast[];
  refresh: () => Promise<void>;
  dismissToast: (id: string) => void;
  notify: (toast: Omit<Toast, 'id'>) => void;
  switchDemoRole: (role: PortalRole) => void;
  sendMagicLink: (email: string) => Promise<void>;
  submitApplication: (input: ProjectApplicationInput) => Promise<string>;
  signOut: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<void>;
  updateProjectProfile: (input: ProjectProfileInput) => Promise<void>;
  updateProjectStage: (input: ProjectStageInput) => Promise<void>;
  createMilestone: (input: MilestoneInput) => Promise<void>;
  createBlocker: (input: BlockerInput) => Promise<void>;
  updateDeliveryStatus: (input: DeliveryStatusInput) => Promise<void>;
  createCohort: (input: CreateCohortInput) => Promise<void>;
  submitProgress: (input: ProgressUpdateInput) => Promise<void>;
  createShowcase: (input: ShowcaseInput, file?: File) => Promise<void>;
  addComment: (input: {
    projectId: string;
    subjectType: PortalComment['subjectType'];
    subjectId: string;
    body: string;
    visibility: Visibility | 'klineo_internal';
  }) => Promise<void>;
  requestVisibility: (input: {
    projectId: string;
    subjectType: 'progress_update' | 'milestone' | 'blocker' | 'showcase_item';
    subjectId: string;
    toVisibility: 'bot_chain' | 'public';
  }) => Promise<void>;
  revokeVisibility: (input: {
    subjectType: 'progress_update' | 'milestone' | 'blocker' | 'showcase_item';
    subjectId: string;
  }) => Promise<void>;
  decideVisibility: (
    approvalId: string,
    decision: 'approved' | 'rejected',
    note?: string,
  ) => Promise<void>;
  decideReview: (
    reviewId: string,
    status: 'in_review' | 'changes_requested' | 'approved' | 'closed',
  ) => Promise<void>;
  requestReview: (input: ReviewRequestInput) => Promise<void>;
  importDesktopSubmission: (projectId: string, file: File) => Promise<void>;
  inviteMember: (input: InviteInput) => Promise<void>;
  updatePortalAccess: (input: UpdateAccessInput) => Promise<void>;
  removePortalAccess: (
    accessId: string,
    accessType: PortalAccessMember['accessType'],
  ) => Promise<void>;
  cancelPortalInvitation: (invitationId: string) => Promise<void>;
  reviewApplication: (input: ReviewApplicationInput) => Promise<void>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The action could not be completed.';
}

export function PortalProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [workspace, setWorkspace] = useState<PortalWorkspace | null>(() =>
    demoMode ? createDemoWorkspace() : null,
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!demoMode && portalConfigured);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    if (demoMode) return;
    setLoading(true);
    try {
      const next = await loadPortalWorkspace();
      setWorkspace(next);
      setError(null);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (demoMode || !supabase) return;
    let active = true;
    void getSession().then((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) void refresh();
      else setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void refresh();
      else {
        setWorkspace(null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const runRemote = useCallback(
    async (action: () => Promise<void>, title: string): Promise<void> => {
      try {
        await action();
        await refresh();
        notify({ tone: 'success', title });
      } catch (cause) {
        notify({ tone: 'error', title: 'Action failed', detail: message(cause) });
        throw cause;
      }
    },
    [notify, refresh],
  );

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      if (!demoMode) {
        await runRemote(
          () => createProjectRemote(input).then(() => undefined),
          'Project workspace created',
        );
        return;
      }
      const projectId = crypto.randomUUID();
      const slug =
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `project-${projectId.slice(0, 8)}`;
      setWorkspace((current) => {
        if (!current) return current;
        const cohort = current.cohorts.find((item) => item.id === input.cohortId);
        return {
          ...current,
          projects: [
            ...current.projects,
            {
              id: projectId,
              slug,
              name: input.name,
              tagline: input.tagline,
              description: input.description,
              stage: 'invited',
              progressPercent: 0,
              cohortName: cohort?.name ?? null,
              targetLaunchAt: input.targetLaunchAt,
              lastUpdateAt: null,
              websiteUrl: input.websiteUrl,
              demoUrl: null,
              repositoryUrl: null,
              videoUrl: null,
              documentationUrl: null,
              integrationReadiness: 'not_started',
              liquidityReadiness: 'not_started',
              launchReadiness: 'not_started',
              accent: '#d8ff62',
            },
          ],
          cohorts: current.cohorts.map((item) =>
            item.id === input.cohortId
              ? { ...item, projectIds: [...item.projectIds, projectId] }
              : item,
          ),
        };
      });
      notify({ tone: 'success', title: 'Project workspace created' });
    },
    [notify, runRemote],
  );

  const updateProjectProfile = useCallback(
    async (input: ProjectProfileInput) => {
      if (!demoMode) {
        await runRemote(() => updateProjectProfileRemote(input), 'Project profile updated');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              projects: current.projects.map((project) =>
                project.id === input.projectId ? { ...project, ...input } : project,
              ),
            }
          : current,
      );
      notify({ tone: 'success', title: 'Project profile updated' });
    },
    [notify, runRemote],
  );

  const updateProjectStage = useCallback(
    async (input: ProjectStageInput) => {
      if (!demoMode) {
        await runRemote(() => updateProjectStageRemote(input), 'Project stage updated');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              projects: current.projects.map((project) =>
                project.id === input.projectId ? { ...project, stage: input.stage } : project,
              ),
            }
          : current,
      );
      notify({ tone: 'success', title: 'Project stage updated' });
    },
    [notify, runRemote],
  );

  const createMilestone = useCallback(
    async (input: MilestoneInput) => {
      if (!demoMode) {
        await runRemote(() => createMilestoneRemote(input), 'Milestone added');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              milestones: [
                ...current.milestones,
                {
                  ...input,
                  id: crypto.randomUUID(),
                  status: 'not_started',
                },
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Milestone added' });
    },
    [notify, runRemote],
  );

  const createBlocker = useCallback(
    async (input: BlockerInput) => {
      if (!demoMode) {
        await runRemote(() => createBlockerRemote(input), 'Blocker reported');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              blockers: [
                {
                  ...input,
                  id: crypto.randomUUID(),
                  status: 'open',
                  createdAt: new Date().toISOString(),
                },
                ...current.blockers,
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Blocker reported' });
    },
    [notify, runRemote],
  );

  const updateDeliveryStatus = useCallback(
    async (input: DeliveryStatusInput) => {
      if (!demoMode) {
        await runRemote(() => updateDeliveryStatusRemote(input), 'Delivery status updated');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              milestones:
                input.subjectType === 'milestone'
                  ? current.milestones.map((item) =>
                      item.id === input.subjectId
                        ? { ...item, status: input.status as (typeof item)['status'] }
                        : item,
                    )
                  : current.milestones,
              blockers:
                input.subjectType === 'blocker'
                  ? current.blockers.map((item) =>
                      item.id === input.subjectId
                        ? { ...item, status: input.status as (typeof item)['status'] }
                        : item,
                    )
                  : current.blockers,
            }
          : current,
      );
      notify({ tone: 'success', title: 'Delivery status updated' });
    },
    [notify, runRemote],
  );

  const createCohort = useCallback(
    async (input: CreateCohortInput) => {
      if (!demoMode) {
        await runRemote(() => createCohortRemote(input), 'Cohort created');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              cohorts: [
                ...current.cohorts,
                {
                  id: crypto.randomUUID(),
                  name: input.name,
                  status: 'planning',
                  startsOn: input.startsOn,
                  endsOn: input.endsOn,
                  projectIds: [],
                },
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Cohort created' });
    },
    [notify, runRemote],
  );

  const submitProgress = useCallback(
    async (input: ProgressUpdateInput) => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(() => submitProgressUpdateRemote(input), 'Progress update submitted');
        return;
      }
      const versions = workspace.progressUpdates
        .filter((item) => item.projectId === input.projectId)
        .map((item) => item.version);
      const submittedAt = new Date().toISOString();
      setWorkspace((current) => {
        if (!current) return current;
        return {
          ...current,
          projects: current.projects.map((project) =>
            project.id === input.projectId
              ? {
                  ...project,
                  progressPercent: input.progressPercent,
                  integrationReadiness: input.integrationReadiness,
                  liquidityReadiness: input.liquidityReadiness,
                  launchReadiness: input.launchReadiness,
                  lastUpdateAt: submittedAt,
                }
              : project,
          ),
          progressUpdates: [
            {
              ...input,
              id: crypto.randomUUID(),
              version: Math.max(0, ...versions) + 1,
              submittedAt,
              submittedByName: current.user.fullName,
              contentDigest: `sha256:demo-${crypto.randomUUID().replaceAll('-', '')}`,
            },
            ...current.progressUpdates,
          ],
        };
      });
      notify({
        tone: 'success',
        title: 'Progress update submitted',
        detail: 'Immutable vNext created.',
      });
    },
    [notify, runRemote, workspace],
  );

  const createShowcase = useCallback(
    async (input: ShowcaseInput, file?: File) => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(
          () =>
            file
              ? uploadShowcaseScreenshot(input, file, workspace.user.id)
              : createShowcaseRemote(input).then(() => undefined),
          'Showcase item submitted',
        );
        return;
      }
      let asset: PortalWorkspace['showcaseItems'][number]['assets'][number] | null = null;
      if (file) {
        const image = await sanitizeShowcaseImage(file);
        asset = {
          id: crypto.randomUUID(),
          showcaseItemId: '',
          projectId: input.projectId,
          storagePath: `demo/${image.file.name}`,
          fileName: image.file.name,
          mimeType: image.file.type,
          sizeBytes: image.file.size,
          width: image.width,
          height: image.height,
          signedUrl: URL.createObjectURL(image.file),
        };
      }
      const itemId = crypto.randomUUID();
      if (asset) asset.showcaseItemId = itemId;
      setWorkspace((current) =>
        current
          ? {
              ...current,
              showcaseItems: [
                {
                  ...input,
                  id: itemId,
                  status: 'submitted',
                  createdAt: new Date().toISOString(),
                  assets: asset ? [asset] : [],
                },
                ...current.showcaseItems,
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Showcase item submitted' });
    },
    [notify, runRemote, workspace],
  );

  const addComment = useCallback(
    async (input: {
      projectId: string;
      subjectType: PortalComment['subjectType'];
      subjectId: string;
      body: string;
      visibility: Visibility | 'klineo_internal';
    }) => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(() => addCommentRemote(input), 'Comment added');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              comments: [
                ...current.comments,
                {
                  ...input,
                  id: crypto.randomUUID(),
                  authorName: current.user.fullName,
                  authorRole: current.user.role,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Comment added' });
    },
    [notify, runRemote, workspace],
  );

  const requestVisibility = useCallback(
    async (input: {
      projectId: string;
      subjectType: 'progress_update' | 'milestone' | 'blocker' | 'showcase_item';
      subjectId: string;
      toVisibility: 'bot_chain' | 'public';
    }) => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(() => requestVisibilityRemote(input), 'Disclosure requested');
        return;
      }
      const subject =
        input.subjectType === 'showcase_item'
          ? workspace.showcaseItems.find((item) => item.id === input.subjectId)
          : input.subjectType === 'progress_update'
            ? workspace.progressUpdates.find((item) => item.id === input.subjectId)
            : input.subjectType === 'milestone'
              ? workspace.milestones.find((item) => item.id === input.subjectId)
              : workspace.blockers.find((item) => item.id === input.subjectId);
      if (!subject) return;
      setWorkspace((current) =>
        current
          ? {
              ...current,
              visibilityApprovals: [
                {
                  id: crypto.randomUUID(),
                  projectId: input.projectId,
                  subjectType: input.subjectType,
                  subjectId: input.subjectId,
                  fromVisibility: subject.visibility,
                  toVisibility: input.toVisibility,
                  status: 'requested',
                  requestedByName: current.user.fullName,
                  requestedAt: new Date().toISOString(),
                  decidedByName: null,
                  decidedAt: null,
                },
                ...current.visibilityApprovals,
              ],
            }
          : current,
      );
      notify({
        tone: 'success',
        title: 'Disclosure requested',
        detail: 'Klineo approval is now required.',
      });
    },
    [notify, runRemote, workspace],
  );

  const decideVisibility = useCallback(
    async (approvalId: string, decision: 'approved' | 'rejected', note = '') => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(
          () => decideVisibilityRemote({ approvalId, decision, note }),
          decision === 'approved' ? 'Disclosure approved' : 'Disclosure rejected',
        );
        return;
      }
      const approval = workspace.visibilityApprovals.find((item) => item.id === approvalId);
      if (!approval) return;
      setWorkspace((current) => {
        if (!current) return current;
        const updateSubject = <T extends { id: string; visibility: Visibility }>(items: T[]): T[] =>
          items.map((item) =>
            item.id === approval.subjectId && decision === 'approved'
              ? { ...item, visibility: approval.toVisibility }
              : item,
          );
        return {
          ...current,
          progressUpdates: updateSubject(current.progressUpdates),
          milestones: updateSubject(current.milestones),
          blockers: updateSubject(current.blockers),
          showcaseItems: updateSubject(current.showcaseItems).map((item) =>
            item.id === approval.subjectId && decision === 'approved'
              ? { ...item, status: 'approved' }
              : item,
          ),
          visibilityApprovals: current.visibilityApprovals.map((item) =>
            item.id === approvalId
              ? {
                  ...item,
                  status: decision,
                  decidedByName: current.user.fullName,
                  decidedAt: new Date().toISOString(),
                }
              : item,
          ),
        };
      });
      notify({
        tone: 'success',
        title: decision === 'approved' ? 'Disclosure approved' : 'Disclosure rejected',
      });
    },
    [notify, runRemote, workspace],
  );

  const revokeVisibility = useCallback(
    async (input: {
      subjectType: 'progress_update' | 'milestone' | 'blocker' | 'showcase_item';
      subjectId: string;
    }) => {
      if (!demoMode) {
        await runRemote(
          () => revokeVisibilityRemote({ ...input, toVisibility: 'project_and_klineo' }),
          'Shared visibility revoked',
        );
        return;
      }
      setWorkspace((current) => {
        if (!current) return current;
        const updateSubject = <T extends { id: string; visibility: Visibility }>(items: T[]): T[] =>
          items.map((item) =>
            item.id === input.subjectId
              ? { ...item, visibility: 'project_and_klineo' as const }
              : item,
          );
        return {
          ...current,
          progressUpdates: updateSubject(current.progressUpdates),
          milestones: updateSubject(current.milestones),
          blockers: updateSubject(current.blockers),
          showcaseItems: updateSubject(current.showcaseItems).map((item) =>
            item.id === input.subjectId ? { ...item, status: 'submitted' } : item,
          ),
          visibilityApprovals: current.visibilityApprovals.map((item) =>
            item.subjectType === input.subjectType &&
            item.subjectId === input.subjectId &&
            item.status === 'approved'
              ? { ...item, status: 'revoked' }
              : item,
          ),
        };
      });
      notify({ tone: 'success', title: 'Shared visibility revoked' });
    },
    [notify, runRemote],
  );

  const decideReview = useCallback(
    async (reviewId: string, status: 'in_review' | 'changes_requested' | 'approved' | 'closed') => {
      if (!demoMode) {
        await runRemote(() => decideReviewRemote({ reviewId, status }), 'Review updated');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              reviewRequests: current.reviewRequests.map((review) =>
                review.id === reviewId ? { ...review, status } : review,
              ),
            }
          : current,
      );
      notify({ tone: 'success', title: 'Review updated' });
    },
    [notify, runRemote],
  );

  const requestReview = useCallback(
    async (input: ReviewRequestInput) => {
      if (!workspace) return;
      if (!demoMode) {
        await runRemote(() => requestReviewRemote(input), 'Review requested');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              reviewRequests: [
                {
                  ...input,
                  id: crypto.randomUUID(),
                  status: 'requested',
                  requestedAt: new Date().toISOString(),
                  requestedByName: current.user.fullName,
                  assignedToName: null,
                },
                ...current.reviewRequests,
              ],
            }
          : current,
      );
      notify({ tone: 'success', title: 'Review requested' });
    },
    [notify, runRemote, workspace],
  );

  const importDesktopSubmission = useCallback(
    async (projectId: string, file: File) => {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (!demoMode) {
        await runRemote(
          () => importDesktopSubmissionRemote(projectId, parsed),
          'Desktop submission imported',
        );
        return;
      }
      if (parsed.schemaVersion !== 1 || typeof parsed.contentDigest !== 'string') {
        throw new Error('This is not a supported Bot Combinator portal submission.');
      }
      const project = parsed.project as Record<string, unknown> | undefined;
      const localProjectId =
        typeof project?.localProjectId === 'string' ? project.localProjectId : 'unknown';
      setWorkspace((current) =>
        current
          ? {
              ...current,
              desktopSubmissionImports: [
                {
                  id: crypto.randomUUID(),
                  projectId,
                  localProjectId,
                  schemaVersion: 1,
                  contentDigest: String(parsed.contentDigest),
                  importedAt: new Date().toISOString(),
                },
                ...current.desktopSubmissionImports,
              ],
            }
          : current,
      );
      notify({
        tone: 'success',
        title: 'Desktop submission verified',
        detail: `${String(parsed.contentDigest).slice(0, 24)}…`,
      });
    },
    [notify, runRemote],
  );

  const inviteMember = useCallback(
    async (input: InviteInput) => {
      if (!demoMode) {
        await runRemote(() => inviteMemberRemote(input), 'Invitation sent');
        return;
      }
      setWorkspace((current) => {
        if (!current) return current;
        const project = current.projects.find((item) => item.id === input.projectId);
        const organizationName = input.role.startsWith('bot_chain_')
          ? 'BOT Chain'
          : input.role.startsWith('klineo_')
            ? 'Klineo'
            : (project?.name ?? 'Project');
        return {
          ...current,
          pendingInvitations: [
            {
              id: crypto.randomUUID(),
              email: input.email,
              fullName: input.fullName,
              role: input.role,
              organizationName,
              projectId: project?.id ?? null,
              projectName: project?.name ?? null,
              invitedByName: current.user.fullName,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            },
            ...current.pendingInvitations.filter(
              (item) =>
                item.email.toLowerCase() !== input.email.toLowerCase() ||
                item.projectId !== (project?.id ?? null),
            ),
          ],
        };
      });
      notify({
        tone: 'success',
        title: 'Invitation sent',
        detail: `${input.email} · expires in 7 days`,
      });
    },
    [notify, runRemote],
  );

  const updatePortalAccess = useCallback(
    async (input: UpdateAccessInput) => {
      if (!demoMode) {
        await runRemote(() => updatePortalAccessRemote(input), 'Access updated');
        return;
      }
      setWorkspace((current) => {
        if (!current) return current;
        const project = current.projects.find((item) => item.id === input.projectId);
        const projectRole = input.role === 'project_lead' || input.role === 'project_member';
        return {
          ...current,
          accessMembers: current.accessMembers.map((member) =>
            member.id === input.accessId
              ? {
                  ...member,
                  accessType: projectRole ? 'project' : 'membership',
                  role: input.role,
                  organizationName: projectRole
                    ? (project?.name ?? member.organizationName)
                    : input.role.startsWith('bot_chain_')
                      ? 'BOT Chain'
                      : 'Klineo',
                  projectId: projectRole ? (project?.id ?? null) : null,
                  projectName: projectRole ? (project?.name ?? null) : null,
                }
              : member,
          ),
        };
      });
      notify({ tone: 'success', title: 'Access updated' });
    },
    [notify, runRemote],
  );

  const removePortalAccess = useCallback(
    async (accessId: string, accessType: PortalAccessMember['accessType']) => {
      if (!demoMode) {
        await runRemote(() => removePortalAccessRemote({ accessId, accessType }), 'Access removed');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              accessMembers: current.accessMembers.filter((member) => member.id !== accessId),
            }
          : current,
      );
      notify({ tone: 'success', title: 'Access removed' });
    },
    [notify, runRemote],
  );

  const cancelPortalInvitation = useCallback(
    async (invitationId: string) => {
      if (!demoMode) {
        await runRemote(() => cancelPortalInvitationRemote(invitationId), 'Invitation cancelled');
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              pendingInvitations: current.pendingInvitations.filter(
                (invitation) => invitation.id !== invitationId,
              ),
            }
          : current,
      );
      notify({ tone: 'success', title: 'Invitation cancelled' });
    },
    [notify, runRemote],
  );

  const reviewApplication = useCallback(
    async (input: ReviewApplicationInput) => {
      if (!demoMode) {
        await runRemote(
          () => reviewProjectApplicationRemote(input),
          `Application moved to ${input.status.replaceAll('_', ' ')}`,
        );
        return;
      }
      setWorkspace((current) =>
        current
          ? {
              ...current,
              applications: current.applications.map((application) =>
                application.id === input.applicationId
                  ? {
                      ...application,
                      status: input.status,
                      reviewerNote: input.reviewerNote || application.reviewerNote,
                      reviewedAt: new Date().toISOString(),
                      reviewedByName: current.user.fullName,
                      updatedAt: new Date().toISOString(),
                    }
                  : application,
              ),
            }
          : current,
      );
      notify({
        tone: 'success',
        title: `Application moved to ${input.status.replaceAll('_', ' ')}`,
      });
    },
    [notify, runRemote],
  );

  const value = useMemo<PortalContextValue>(
    () => ({
      workspace,
      session,
      loading,
      configured: portalConfigured,
      demo: demoMode,
      error,
      toasts,
      refresh,
      dismissToast,
      notify,
      switchDemoRole: (role) => setWorkspace(createDemoWorkspace(role)),
      sendMagicLink: requestMagicLink,
      submitApplication: submitProjectApplicationRemote,
      signOut: signOutRemote,
      createProject,
      updateProjectProfile,
      updateProjectStage,
      createMilestone,
      createBlocker,
      updateDeliveryStatus,
      createCohort,
      submitProgress,
      createShowcase,
      addComment,
      requestVisibility,
      revokeVisibility,
      decideVisibility,
      decideReview,
      requestReview,
      importDesktopSubmission,
      inviteMember,
      updatePortalAccess,
      removePortalAccess,
      cancelPortalInvitation,
      reviewApplication,
    }),
    [
      addComment,
      createBlocker,
      createCohort,
      createMilestone,
      createProject,
      createShowcase,
      decideReview,
      decideVisibility,
      dismissToast,
      error,
      importDesktopSubmission,
      inviteMember,
      updatePortalAccess,
      removePortalAccess,
      cancelPortalInvitation,
      loading,
      notify,
      refresh,
      requestVisibility,
      requestReview,
      reviewApplication,
      revokeVisibility,
      session,
      submitProgress,
      toasts,
      updateDeliveryStatus,
      updateProjectProfile,
      updateProjectStage,
      workspace,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value) throw new Error('usePortal must be used inside PortalProvider.');
  return value;
}
