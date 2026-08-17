import { useEffect, useState } from 'react';
import {
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileJson2,
  FileText,
  GalleryHorizontalEnd,
  GitBranch,
  Globe2,
  ImagePlus,
  Layers3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  PencilLine,
  PlayCircle,
  Plus,
  Rocket,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { usePortal } from '../state/PortalContext';
import type {
  Blocker,
  BlockerInput,
  DesktopSubmissionImport,
  MilestoneInput,
  MilestoneStatus,
  PortalComment,
  Milestone,
  PortalProject,
  ProgressUpdate,
  ProgressUpdateInput,
  ProjectProfileInput,
  ProjectStage,
  ReadinessState,
  ReviewRequest,
  ReviewRequestInput,
  ShowcaseInput,
  ShowcaseItem,
  Visibility,
} from '../lib/types';
import {
  isBotChainRole,
  isKlineoOperatorRole,
  isKlineoRole,
  isProjectRole,
} from '../lib/visibility';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  ProgressBar,
  StatusBadge,
  VisibilityBadge,
  cx,
  formatDate,
  relativeDate,
  titleCase,
} from '../components/Primitives';

type ProjectTab = 'overview' | 'updates' | 'milestones' | 'showcase' | 'reviews';
type ProjectAction = 'update' | 'showcase' | 'import' | null;

export function ProjectView({
  projectId,
  startAction,
  onActionConsumed,
  onBack,
}: {
  projectId: string;
  startAction: ProjectAction;
  onActionConsumed: () => void;
  onBack: () => void;
}): React.JSX.Element {
  const portal = usePortal();
  const workspace = portal.workspace;
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [updateOpen, setUpdateOpen] = useState(false);
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [commentSubject, setCommentSubject] = useState<{
    type: PortalComment['subjectType'];
    id: string;
    title: string;
    visibility: Visibility;
  } | null>(null);
  const [reviewSubject, setReviewSubject] = useState<{
    type: ReviewRequest['subjectType'];
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!startAction) return;
    if (startAction === 'update') setUpdateOpen(true);
    if (startAction === 'showcase') setShowcaseOpen(true);
    if (startAction === 'import') setImportOpen(true);
    onActionConsumed();
  }, [onActionConsumed, startAction]);

  if (!workspace) return <></>;
  const project = workspace.projects.find((item) => item.id === projectId);
  if (!project) {
    return (
      <EmptyState
        title="Project unavailable"
        detail="This project is not in your authorized view."
        action={<Button onClick={onBack}>Back to projects</Button>}
      />
    );
  }
  const updates = workspace.progressUpdates.filter((item) => item.projectId === project.id);
  const milestones = workspace.milestones.filter((item) => item.projectId === project.id);
  const blockers = workspace.blockers.filter((item) => item.projectId === project.id);
  const showcase = workspace.showcaseItems.filter((item) => item.projectId === project.id);
  const reviews = workspace.reviewRequests.filter((item) => item.projectId === project.id);
  const desktopImports = workspace.desktopSubmissionImports.filter(
    (item) => item.projectId === project.id,
  );
  const isProject = isProjectRole(workspace.user.role);
  const canEdit = isProject || isKlineoOperatorRole(workspace.user.role);
  const canManageStage = isKlineoOperatorRole(workspace.user.role);
  const canRequestVisibility = workspace.user.role === 'project_lead';

  return (
    <div className="view-enter project-workspace">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft aria-hidden="true" /> All projects
      </button>
      <header className="project-dossier-header">
        <div className="project-dossier-header__identity">
          <span style={{ background: project.accent }}>
            {project.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <small>{project.cohortName ?? 'Independent project'}</small>
            <h1>{project.name}</h1>
            <p>{project.tagline}</p>
          </div>
        </div>
        <div className="project-dossier-header__status">
          {canManageStage ? (
            <select
              className="project-stage-select"
              aria-label="Project stage"
              value={project.stage}
              onChange={(event) =>
                void portal.updateProjectStage({
                  projectId: project.id,
                  stage: event.target.value as ProjectStage,
                })
              }
            >
              {(
                [
                  'sourced',
                  'invited',
                  'applied',
                  'screening',
                  'qualified',
                  'cohort',
                  'integration_ready',
                  'liquidity_ready',
                  'launch_scheduled',
                  'live_market',
                  'graduated',
                  'on_hold',
                  'declined',
                  'withdrawn',
                ] as const
              ).map((stage) => (
                <option key={stage} value={stage}>
                  {titleCase(stage)}
                </option>
              ))}
            </select>
          ) : (
            <Badge tone="neutral">{titleCase(project.stage)}</Badge>
          )}
          <span>
            Last update <strong>{relativeDate(project.lastUpdateAt)}</strong>
          </span>
        </div>
        <div className="project-dossier-header__actions">
          {canEdit ? (
            <Button icon={<UploadCloud aria-hidden="true" />} onClick={() => setImportOpen(true)}>
              Import desktop submission
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              tone="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setUpdateOpen(true)}
            >
              Submit progress
            </Button>
          ) : null}
        </div>
      </header>

      <nav className="project-tabs" aria-label="Project sections">
        {(['overview', 'updates', 'milestones', 'showcase', 'reviews'] as const).map((item) => (
          <button
            type="button"
            key={item}
            className={tab === item ? 'is-active' : undefined}
            onClick={() => setTab(item)}
          >
            {titleCase(item)}
            {item === 'reviews' &&
            reviews.filter((review) => !['approved', 'closed'].includes(review.status)).length ? (
              <i>
                {reviews.filter((review) => !['approved', 'closed'].includes(review.status)).length}
              </i>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <ProjectOverview
          project={project}
          updates={updates}
          milestones={milestones}
          blockers={blockers}
          showcase={showcase}
          canEdit={canEdit}
          onEdit={() => setProfileOpen(true)}
          onTab={setTab}
        />
      ) : null}
      {tab === 'updates' ? (
        <UpdatesPanel
          project={project}
          updates={updates}
          comments={workspace.comments}
          canSubmit={canEdit}
          canRequestVisibility={canRequestVisibility}
          onSubmit={() => setUpdateOpen(true)}
          onComment={(id, title, visibility) =>
            setCommentSubject({ type: 'progress_update', id, title, visibility })
          }
          onRequestReview={(id, title) => setReviewSubject({ type: 'progress_update', id, title })}
          onRevokeVisibility={(subjectId) =>
            void portal.revokeVisibility({ subjectType: 'progress_update', subjectId })
          }
          onRequestVisibility={(subjectId, toVisibility) =>
            void portal.requestVisibility({
              projectId: project.id,
              subjectType: 'progress_update',
              subjectId,
              toVisibility,
            })
          }
        />
      ) : null}
      {tab === 'milestones' ? (
        <MilestonesPanel
          project={project}
          milestones={milestones}
          blockers={blockers}
          canEdit={canEdit}
          onAddMilestone={() => setMilestoneOpen(true)}
          onAddBlocker={() => setBlockerOpen(true)}
          onRequestReview={(id, title) => setReviewSubject({ type: 'milestone', id, title })}
          onUpdateStatus={(subjectType, subjectId, status) =>
            void portal.updateDeliveryStatus({ subjectType, subjectId, status })
          }
        />
      ) : null}
      {tab === 'showcase' ? (
        <ShowcasePanel
          project={project}
          items={showcase}
          canRequestVisibility={canRequestVisibility}
          canSubmit={canEdit}
          onAdd={() => setShowcaseOpen(true)}
          onComment={(id, title, visibility) =>
            setCommentSubject({ type: 'showcase_item', id, title, visibility })
          }
          onRequestReview={(id, title) => setReviewSubject({ type: 'showcase_item', id, title })}
          onRevokeVisibility={(subjectId) =>
            void portal.revokeVisibility({ subjectType: 'showcase_item', subjectId })
          }
          onRequestVisibility={(subjectId, toVisibility) =>
            void portal.requestVisibility({
              projectId: project.id,
              subjectType: 'showcase_item',
              subjectId,
              toVisibility,
            })
          }
        />
      ) : null}
      {tab === 'reviews' ? (
        <ProjectReviews
          project={project}
          reviews={reviews}
          comments={workspace.comments}
          desktopImports={desktopImports}
        />
      ) : null}

      <ProgressDialog open={updateOpen} project={project} onClose={() => setUpdateOpen(false)} />
      <ProjectProfileDialog
        open={profileOpen}
        project={project}
        onClose={() => setProfileOpen(false)}
      />
      <MilestoneDialog
        open={milestoneOpen}
        project={project}
        onClose={() => setMilestoneOpen(false)}
      />
      <BlockerDialog open={blockerOpen} project={project} onClose={() => setBlockerOpen(false)} />
      <ShowcaseDialog
        open={showcaseOpen}
        project={project}
        onClose={() => setShowcaseOpen(false)}
      />
      <ImportDialog open={importOpen} project={project} onClose={() => setImportOpen(false)} />
      <CommentDialog
        open={commentSubject !== null}
        project={project}
        subject={commentSubject}
        onClose={() => setCommentSubject(null)}
      />
      <ReviewDialog
        open={reviewSubject !== null}
        project={project}
        subject={reviewSubject}
        onClose={() => setReviewSubject(null)}
      />
    </div>
  );
}

function ProjectOverview({
  project,
  updates,
  milestones,
  blockers,
  showcase,
  canEdit,
  onEdit,
  onTab,
}: {
  project: PortalProject;
  updates: ProgressUpdate[];
  milestones: Milestone[];
  blockers: Blocker[];
  showcase: ShowcaseItem[];
  canEdit: boolean;
  onEdit: () => void;
  onTab: (tab: ProjectTab) => void;
}): React.JSX.Element {
  const latest = updates[0];
  const activeBlockers = blockers.filter((item) => item.status !== 'resolved');
  return (
    <div className="project-tab-content project-overview-grid">
      <section className="project-overview-main">
        <div className="project-narrative">
          <div className="project-narrative-heading">
            <span className="section-kicker">Product</span>
            {canEdit ? (
              <Button
                size="small"
                tone="quiet"
                icon={<PencilLine aria-hidden="true" />}
                onClick={onEdit}
              >
                Edit profile
              </Button>
            ) : null}
          </div>
          <h2>{project.description}</h2>
          <div className="project-link-row">
            {project.websiteUrl ? (
              <a href={project.websiteUrl} target="_blank" rel="noreferrer">
                <Globe2 aria-hidden="true" /> Website <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
            {project.demoUrl ? (
              <a href={project.demoUrl} target="_blank" rel="noreferrer">
                <PlayCircle aria-hidden="true" /> Live demo <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
            {project.repositoryUrl ? (
              <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                <GitBranch aria-hidden="true" /> Repository <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
            {project.documentationUrl ? (
              <a href={project.documentationUrl} target="_blank" rel="noreferrer">
                <FileText aria-hidden="true" /> Documentation <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        <section className="overview-progress">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Current state</span>
              <h2>Readiness</h2>
            </div>
            <strong>{project.progressPercent}%</strong>
          </div>
          <ProgressBar value={project.progressPercent} />
          <div className="readiness-ledger">
            <div>
              <Layers3 aria-hidden="true" />
              <span>
                <small>Integration readiness</small>
                <strong>{titleCase(project.integrationReadiness)}</strong>
              </span>
              <StatusBadge status={project.integrationReadiness} />
            </div>
            <div>
              <ShieldCheck aria-hidden="true" />
              <span>
                <small>Liquidity readiness</small>
                <strong>{titleCase(project.liquidityReadiness)}</strong>
              </span>
              <StatusBadge status={project.liquidityReadiness} />
            </div>
            <div>
              <Rocket aria-hidden="true" />
              <span>
                <small>Launch readiness</small>
                <strong>{titleCase(project.launchReadiness)}</strong>
              </span>
              <StatusBadge status={project.launchReadiness} />
            </div>
          </div>
        </section>
        <section className="overview-latest">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Latest immutable update</span>
              <h2>{latest?.title ?? 'No submissions yet'}</h2>
            </div>
            {latest ? <Badge tone="neutral">v{latest.version}</Badge> : null}
          </div>
          {latest ? (
            <>
              <p>{latest.summary}</p>
              <footer>
                <span>Submitted by {latest.submittedByName}</span>
                <span>{formatDate(latest.submittedAt, true)}</span>
                <VisibilityBadge visibility={latest.visibility} />
              </footer>
              <Button tone="quiet" onClick={() => onTab('updates')}>
                Open all updates <ArrowRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <EmptyState
              title="No update history"
              detail="The first submitted update will appear here."
            />
          )}
        </section>
      </section>
      <aside className="project-overview-side">
        <section className="launch-box">
          <CalendarClock aria-hidden="true" />
          <span>
            <small>Target launch</small>
            <strong>{formatDate(project.targetLaunchAt)}</strong>
          </span>
        </section>
        <section className="overview-blockers">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Risks</span>
              <h2>Open blockers</h2>
            </div>
            <Badge tone={activeBlockers.length ? 'danger' : 'success'}>
              {activeBlockers.length}
            </Badge>
          </div>
          {activeBlockers.length ? (
            activeBlockers.map((blocker) => (
              <article key={blocker.id}>
                <span className={`severity severity--${blocker.severity}`} />
                <div>
                  <strong>{blocker.title}</strong>
                  <p>{blocker.detail}</p>
                  <small>
                    {titleCase(blocker.severity)} · {blocker.ownerName ?? 'Unassigned'}
                  </small>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="No open blockers"
              detail="This project is clear of reported blockers."
            />
          )}
        </section>
        <section className="overview-counts">
          <button type="button" onClick={() => onTab('milestones')}>
            <span>
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <strong>
                {milestones.filter((item) => item.status === 'completed').length}/
                {milestones.length}
              </strong>
              <small>Milestones complete</small>
            </div>
            <ArrowRight aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onTab('showcase')}>
            <span>
              <GalleryHorizontalEnd aria-hidden="true" />
            </span>
            <div>
              <strong>{showcase.length}</strong>
              <small>Showcase items</small>
            </div>
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      </aside>
    </div>
  );
}

function UpdatesPanel({
  project,
  updates,
  comments,
  canSubmit,
  canRequestVisibility,
  onSubmit,
  onComment,
  onRequestReview,
  onRevokeVisibility,
  onRequestVisibility,
}: {
  project: PortalProject;
  updates: ProgressUpdate[];
  comments: PortalComment[];
  canSubmit: boolean;
  canRequestVisibility: boolean;
  onSubmit: () => void;
  onComment: (id: string, title: string, visibility: Visibility) => void;
  onRequestReview: (id: string, title: string) => void;
  onRevokeVisibility: (subjectId: string) => void;
  onRequestVisibility: (subjectId: string, visibility: 'bot_chain' | 'public') => void;
}): React.JSX.Element {
  return (
    <div className="project-tab-content stack stack--large">
      <div className="section-heading section-heading--page">
        <div>
          <span className="section-kicker">Version history</span>
          <h2>Progress updates</h2>
          <p>Submitted versions cannot be edited or deleted. Visibility changes remain audited.</p>
        </div>
        {canSubmit ? (
          <Button tone="primary" icon={<Plus aria-hidden="true" />} onClick={onSubmit}>
            Submit update
          </Button>
        ) : null}
      </div>
      {updates.length ? (
        <div className="updates-timeline">
          {updates.map((update, index) => {
            const updateComments = comments.filter((comment) => comment.subjectId === update.id);
            return (
              <article key={update.id} className={index === 0 ? 'is-latest' : undefined}>
                <div className="timeline-rail">
                  <span>{update.version}</span>
                  <i />
                </div>
                <div className="update-entry">
                  <header>
                    <div>
                      <small>
                        VERSION {update.version} · {formatDate(update.submittedAt, true)}
                      </small>
                      <h3>{update.title}</h3>
                    </div>
                    <VisibilityBadge visibility={update.visibility} />
                  </header>
                  <p>{update.summary}</p>
                  <div className="update-columns">
                    <div>
                      <strong>Completed</strong>
                      <ul>
                        {update.accomplishments.map((item) => (
                          <li key={item}>
                            <Check aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Next</strong>
                      <ul>
                        {update.nextSteps.map((item) => (
                          <li key={item}>
                            <ArrowRight aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="update-readiness">
                    <span>
                      Progress <strong>{update.progressPercent}%</strong>
                    </span>
                    <span>
                      Integration <StatusBadge status={update.integrationReadiness} />
                    </span>
                    <span>
                      Liquidity <StatusBadge status={update.liquidityReadiness} />
                    </span>
                    <span>
                      Launch <StatusBadge status={update.launchReadiness} />
                    </span>
                  </div>
                  <footer>
                    <div className="digest">
                      <LockKeyhole aria-hidden="true" />
                      <span>
                        <small>Content digest</small>
                        <code>{update.contentDigest}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(update.contentDigest)}
                        aria-label="Copy digest"
                      >
                        <Copy aria-hidden="true" />
                      </button>
                    </div>
                    <div className="entry-actions">
                      <Button
                        size="small"
                        tone="quiet"
                        icon={<MessageSquareText aria-hidden="true" />}
                        onClick={() => onComment(update.id, update.title, update.visibility)}
                      >
                        Comment {updateComments.length ? `(${updateComments.length})` : ''}
                      </Button>
                      {canSubmit ? (
                        <Button
                          size="small"
                          tone="quiet"
                          onClick={() => onRequestReview(update.id, update.title)}
                        >
                          Request review
                        </Button>
                      ) : null}
                      {canRequestVisibility && update.visibility === 'project_and_klineo' ? (
                        <Button
                          size="small"
                          onClick={() => onRequestVisibility(update.id, 'bot_chain')}
                        >
                          Request BOT Chain share
                        </Button>
                      ) : null}
                      {canRequestVisibility && update.visibility === 'bot_chain' ? (
                        <Button
                          size="small"
                          onClick={() => onRequestVisibility(update.id, 'public')}
                        >
                          Request public share
                        </Button>
                      ) : null}
                      {canRequestVisibility &&
                      (update.visibility === 'bot_chain' || update.visibility === 'public') ? (
                        <Button
                          size="small"
                          tone="quiet"
                          onClick={() => onRevokeVisibility(update.id)}
                        >
                          Return to Klineo only
                        </Button>
                      ) : null}
                    </div>
                  </footer>
                  {updateComments.length ? <DiscussionPreview comments={updateComments} /> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No progress updates"
          detail={`Submit ${project.name}’s first immutable progress version.`}
          action={
            canSubmit ? (
              <Button tone="primary" onClick={onSubmit}>
                Submit first update
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function MilestonesPanel({
  project,
  milestones,
  blockers,
  canEdit,
  onAddMilestone,
  onAddBlocker,
  onRequestReview,
  onUpdateStatus,
}: {
  project: PortalProject;
  milestones: Milestone[];
  blockers: Blocker[];
  canEdit: boolean;
  onAddMilestone: () => void;
  onAddBlocker: () => void;
  onRequestReview: (id: string, title: string) => void;
  onUpdateStatus: (
    subjectType: 'milestone' | 'blocker',
    subjectId: string,
    status: MilestoneStatus | Blocker['status'],
  ) => void;
}): React.JSX.Element {
  return (
    <div className="project-tab-content stack stack--section">
      <div className="section-heading section-heading--page">
        <div>
          <span className="section-kicker">Delivery plan</span>
          <h2>Milestones & blockers</h2>
          <p>Concrete outcomes, due dates, evidence, and risks for {project.name}.</p>
        </div>
        {canEdit ? (
          <div className="section-heading-actions">
            <Button icon={<AlertOctagon aria-hidden="true" />} onClick={onAddBlocker}>
              Report blocker
            </Button>
            <Button tone="primary" icon={<Plus aria-hidden="true" />} onClick={onAddMilestone}>
              Add milestone
            </Button>
          </div>
        ) : null}
      </div>
      <section className="milestone-table">
        <div className="milestone-table__head">
          <span>Milestone</span>
          <span>Owner</span>
          <span>Due</span>
          <span>Status</span>
          <span>Visibility</span>
          <span>Evidence</span>
        </div>
        {milestones.map((milestone) => (
          <div className="milestone-row" key={milestone.id}>
            <span>
              <i className={`task-state task-state--${milestone.status}`} />
              <span>
                <strong>{milestone.title}</strong>
                <small>{milestone.category}</small>
              </span>
            </span>
            <span>{milestone.ownerName ?? 'Unassigned'}</span>
            <span>{formatDate(milestone.dueAt)}</span>
            {canEdit ? (
              <select
                className="delivery-status-select"
                aria-label={`Status for ${milestone.title}`}
                value={milestone.status}
                onChange={(event) =>
                  onUpdateStatus('milestone', milestone.id, event.target.value as MilestoneStatus)
                }
              >
                {(['not_started', 'in_progress', 'blocked', 'completed', 'cancelled'] as const).map(
                  (status) => (
                    <option key={status} value={status}>
                      {titleCase(status)}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <StatusBadge status={milestone.status} />
            )}
            <VisibilityBadge visibility={milestone.visibility} />
            <span className="milestone-evidence">
              {milestone.evidenceUrl ? (
                <a href={milestone.evidenceUrl} target="_blank" rel="noreferrer">
                  Open <ExternalLink aria-hidden="true" />
                </a>
              ) : (
                <small>Pending</small>
              )}
              {canEdit ? (
                <Button
                  size="small"
                  tone="quiet"
                  onClick={() => onRequestReview(milestone.id, milestone.title)}
                >
                  Review
                </Button>
              ) : null}
            </span>
          </div>
        ))}
        {!milestones.length ? (
          <EmptyState
            title="No milestones"
            detail="Klineo and the project team have not recorded milestones yet."
          />
        ) : null}
      </section>
      <section className="blocker-board">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Risk register</span>
            <h2>Blockers</h2>
          </div>
          <Badge tone={blockers.some((item) => item.status !== 'resolved') ? 'danger' : 'success'}>
            {blockers.filter((item) => item.status !== 'resolved').length} open
          </Badge>
        </div>
        <div>
          {blockers.map((blocker) => (
            <article
              key={blocker.id}
              className={blocker.status === 'resolved' ? 'is-resolved' : undefined}
            >
              <span className={`severity severity--${blocker.severity}`}>
                <AlertOctagon aria-hidden="true" />
              </span>
              <div>
                <small>
                  {titleCase(blocker.severity)} · {titleCase(blocker.status)}
                </small>
                <h3>{blocker.title}</h3>
                <p>{blocker.detail}</p>
                <footer>
                  <span>Owner: {blocker.ownerName ?? 'Unassigned'}</span>
                  <VisibilityBadge visibility={blocker.visibility} />
                  {canEdit ? (
                    <select
                      className="delivery-status-select"
                      aria-label={`Status for ${blocker.title}`}
                      value={blocker.status}
                      onChange={(event) =>
                        onUpdateStatus(
                          'blocker',
                          blocker.id,
                          event.target.value as Blocker['status'],
                        )
                      }
                    >
                      {(['open', 'monitoring', 'resolved'] as const).map((status) => (
                        <option key={status} value={status}>
                          {titleCase(status)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShowcasePanel({
  project,
  items,
  canRequestVisibility,
  canSubmit,
  onAdd,
  onComment,
  onRequestReview,
  onRevokeVisibility,
  onRequestVisibility,
}: {
  project: PortalProject;
  items: ShowcaseItem[];
  canRequestVisibility: boolean;
  canSubmit: boolean;
  onAdd: () => void;
  onComment: (id: string, title: string, visibility: Visibility) => void;
  onRequestReview: (id: string, title: string) => void;
  onRevokeVisibility: (subjectId: string) => void;
  onRequestVisibility: (subjectId: string, visibility: 'bot_chain' | 'public') => void;
}): React.JSX.Element {
  return (
    <div className="project-tab-content stack stack--large">
      <div className="section-heading section-heading--page">
        <div>
          <span className="section-kicker">Product proof</span>
          <h2>Showcase</h2>
          <p>
            Screenshots and links remain private until the project explicitly requests broader
            sharing.
          </p>
        </div>
        {canSubmit ? (
          <Button tone="primary" icon={<ImagePlus aria-hidden="true" />} onClick={onAdd}>
            Add showcase item
          </Button>
        ) : null}
      </div>
      {items.length ? (
        <div className="showcase-gallery">
          {items.map((item) => (
            <article
              key={item.id}
              className={item.assets.length ? 'showcase-item--visual' : 'showcase-item--link'}
            >
              {item.assets[0]?.signedUrl ? (
                <a
                  className="showcase-image"
                  href={item.assets[0].signedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={item.assets[0].signedUrl} alt={`${project.name}: ${item.title}`} />
                  <span>
                    View full screenshot <ExternalLink aria-hidden="true" />
                  </span>
                </a>
              ) : (
                <div className="showcase-link-visual">
                  <ShowcaseIcon type={item.type} />
                  <span>{titleCase(item.type)}</span>
                </div>
              )}
              <div className="showcase-copy">
                <header>
                  <div>
                    <small>
                      {titleCase(item.type)} · {formatDate(item.createdAt)}
                    </small>
                    <h3>{item.title}</h3>
                  </div>
                  <StatusBadge status={item.status} />
                </header>
                <p>{item.description}</p>
                <div className="showcase-meta">
                  <VisibilityBadge visibility={item.visibility} />
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Open link <ExternalLink aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                <footer>
                  <Button
                    size="small"
                    tone="quiet"
                    icon={<MessageSquareText aria-hidden="true" />}
                    onClick={() => onComment(item.id, item.title, item.visibility)}
                  >
                    Comment
                  </Button>
                  {canSubmit ? (
                    <Button
                      size="small"
                      tone="quiet"
                      onClick={() => onRequestReview(item.id, item.title)}
                    >
                      Request review
                    </Button>
                  ) : null}
                  {canRequestVisibility && item.visibility === 'project_and_klineo' ? (
                    <Button size="small" onClick={() => onRequestVisibility(item.id, 'bot_chain')}>
                      Request BOT Chain share
                    </Button>
                  ) : null}
                  {canRequestVisibility && item.visibility === 'bot_chain' ? (
                    <Button size="small" onClick={() => onRequestVisibility(item.id, 'public')}>
                      Request public share
                    </Button>
                  ) : null}
                  {canRequestVisibility &&
                  (item.visibility === 'bot_chain' || item.visibility === 'public') ? (
                    <Button size="small" tone="quiet" onClick={() => onRevokeVisibility(item.id)}>
                      Return to Klineo only
                    </Button>
                  ) : null}
                </footer>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No showcase items"
          detail="Add a screenshot, demo, website, repository, video, or documentation link."
          action={
            canSubmit ? (
              <Button tone="primary" onClick={onAdd}>
                Add first item
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function ShowcaseIcon({ type }: { type: ShowcaseItem['type'] }): React.JSX.Element {
  if (type === 'video' || type === 'demo') return <PlayCircle aria-hidden="true" />;
  if (type === 'repository') return <GitBranch aria-hidden="true" />;
  if (type === 'documentation') return <FileText aria-hidden="true" />;
  if (type === 'website') return <Globe2 aria-hidden="true" />;
  return <GalleryHorizontalEnd aria-hidden="true" />;
}

function ProjectReviews({
  project,
  reviews,
  comments,
  desktopImports,
}: {
  project: PortalProject;
  reviews: ReviewRequest[];
  comments: PortalComment[];
  desktopImports: DesktopSubmissionImport[];
}): React.JSX.Element {
  return (
    <div className="project-tab-content stack stack--large">
      <div className="section-heading section-heading--page">
        <div>
          <span className="section-kicker">Klineo workflow</span>
          <h2>Reviews & requests</h2>
          <p>Gate reviews, product feedback, and change requests for {project.name}.</p>
        </div>
      </div>
      <div className="project-review-list">
        {reviews.map((review) => {
          const related = comments.filter(
            (comment) =>
              comment.subjectType === 'review_request' && comment.subjectId === review.id,
          );
          return (
            <article key={review.id}>
              <span className={`review-state review-state--${review.status}`}>
                <FlagIcon status={review.status} />
              </span>
              <div>
                <header>
                  <span>
                    <small>{titleCase(review.subjectType)}</small>
                    <h3>{review.title}</h3>
                  </span>
                  <StatusBadge status={review.status} />
                </header>
                <div className="review-meta">
                  <span>
                    Requested by <strong>{review.requestedByName}</strong>
                  </span>
                  <span>
                    Assigned to <strong>{review.assignedToName ?? 'Klineo queue'}</strong>
                  </span>
                  <span>
                    Due <strong>{formatDate(review.dueAt)}</strong>
                  </span>
                </div>
                {related.length ? <DiscussionPreview comments={related} /> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!reviews.length ? (
        <EmptyState title="No reviews" detail="There are no review requests for this project." />
      ) : null}
      <section className="desktop-submission-history">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Explicit desktop transfer</span>
            <h2>Verified submission history</h2>
          </div>
          <Badge tone="neutral">{desktopImports.length}</Badge>
        </div>
        {desktopImports.length ? (
          <div>
            {desktopImports.map((item) => (
              <article key={item.id}>
                <FileJson2 aria-hidden="true" />
                <span>
                  <strong>Desktop schema v{item.schemaVersion}</strong>
                  <small>
                    Imported {formatDate(item.importedAt, true)} · local project{' '}
                    {item.localProjectId}
                  </small>
                </span>
                <code>{item.contentDigest}</code>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No desktop submissions"
            detail="An explicit digest-verified import will appear here."
          />
        )}
      </section>
    </div>
  );
}

function FlagIcon({ status }: { status: string }): React.JSX.Element {
  return status === 'approved' ? (
    <CheckCircle2 aria-hidden="true" />
  ) : (
    <MessageSquareText aria-hidden="true" />
  );
}

function DiscussionPreview({ comments }: { comments: PortalComment[] }): React.JSX.Element {
  return (
    <div className="discussion-preview">
      {comments.map((comment) => (
        <div key={comment.id}>
          <Avatar name={comment.authorName} small />
          <span>
            <strong>
              {comment.authorName} <small>{titleCase(comment.authorRole)}</small>
            </strong>
            <p>{comment.body}</p>
            <time>{formatDate(comment.createdAt, true)}</time>
          </span>
        </div>
      ))}
    </div>
  );
}

function ProgressDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { submitProgress } = usePortal();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [accomplishments, setAccomplishments] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [progress, setProgress] = useState(project.progressPercent);
  const [integration, setIntegration] = useState<ReadinessState>(project.integrationReadiness);
  const [liquidity, setLiquidity] = useState<ReadinessState>(project.liquidityReadiness);
  const [launch, setLaunch] = useState<ReadinessState>(project.launchReadiness);
  const [visibility, setVisibility] = useState<Visibility>('project_and_klineo');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!title.trim() || !summary.trim()) return;
    setBusy(true);
    const input: ProgressUpdateInput = {
      projectId: project.id,
      title: title.trim(),
      summary: summary.trim(),
      accomplishments: accomplishments
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      nextSteps: nextSteps
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      progressPercent: progress,
      integrationReadiness: integration,
      liquidityReadiness: liquidity,
      launchReadiness: launch,
      visibility,
    };
    try {
      await submitProgress(input);
      setTitle('');
      setSummary('');
      setAccomplishments('');
      setNextSteps('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Submit weekly progress"
      description="This creates a new immutable version. Partner or public sharing is requested separately."
      wide
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={!title.trim() || !summary.trim() || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Submitting…' : 'Submit immutable update'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Update title">
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What changed this week?"
            autoFocus
          />
        </Field>
        <Field label="Progress" hint={`${progress}%`}>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
          />
        </Field>
        <Field label="Summary" span>
          <textarea
            className="textarea"
            rows={4}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Decision-ready summary of progress, evidence, and context."
          />
        </Field>
        <Field label="Completed" hint="One item per line">
          <textarea
            className="textarea"
            rows={5}
            value={accomplishments}
            onChange={(event) => setAccomplishments(event.target.value)}
          />
        </Field>
        <Field label="Next steps" hint="One item per line">
          <textarea
            className="textarea"
            rows={5}
            value={nextSteps}
            onChange={(event) => setNextSteps(event.target.value)}
          />
        </Field>
        <ReadinessSelect
          label="Integration readiness"
          value={integration}
          onChange={setIntegration}
        />
        <ReadinessSelect label="Liquidity readiness" value={liquidity} onChange={setLiquidity} />
        <ReadinessSelect label="Launch readiness" value={launch} onChange={setLaunch} />
        <Field label="Initial visibility">
          <select
            className="select"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="project_and_klineo">Project + Klineo (default)</option>
            <option value="project_private">Project only</option>
          </select>
        </Field>
        <div className="form-notice form-notice--span">
          <LockKeyhole aria-hidden="true" />
          <p>
            <strong>Private by default.</strong> BOT Chain and public visibility require a separate,
            audited approval after submission.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function ReadinessSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReadinessState;
  onChange: (value: ReadinessState) => void;
}): React.JSX.Element {
  return (
    <Field label={label}>
      <select
        className="select"
        value={value}
        onChange={(event) => onChange(event.target.value as ReadinessState)}
      >
        {(['not_started', 'in_progress', 'ready', 'blocked'] as const).map((state) => (
          <option key={state} value={state}>
            {titleCase(state)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ProjectProfileDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { updateProjectProfile } = usePortal();
  const [tagline, setTagline] = useState(project.tagline);
  const [description, setDescription] = useState(project.description);
  const [websiteUrl, setWebsiteUrl] = useState(project.websiteUrl ?? '');
  const [demoUrl, setDemoUrl] = useState(project.demoUrl ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(project.repositoryUrl ?? '');
  const [videoUrl, setVideoUrl] = useState(project.videoUrl ?? '');
  const [documentationUrl, setDocumentationUrl] = useState(project.documentationUrl ?? '');
  const [targetLaunchAt, setTargetLaunchAt] = useState(project.targetLaunchAt?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    const input: ProjectProfileInput = {
      projectId: project.id,
      tagline: tagline.trim(),
      description: description.trim(),
      websiteUrl: websiteUrl.trim() || null,
      demoUrl: demoUrl.trim() || null,
      repositoryUrl: repositoryUrl.trim() || null,
      videoUrl: videoUrl.trim() || null,
      documentationUrl: documentationUrl.trim() || null,
      targetLaunchAt: targetLaunchAt || null,
    };
    setBusy(true);
    try {
      await updateProjectProfile(input);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit project profile"
      description="Keep the product narrative and working links current for authorized reviewers."
      wide
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Tagline" span>
          <input
            className="input"
            value={tagline}
            maxLength={180}
            onChange={(event) => setTagline(event.target.value)}
          />
        </Field>
        <Field label="Description" span>
          <textarea
            className="textarea"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {(
          [
            ['Website', websiteUrl, setWebsiteUrl],
            ['Live demo', demoUrl, setDemoUrl],
            ['Repository', repositoryUrl, setRepositoryUrl],
            ['Video', videoUrl, setVideoUrl],
            ['Documentation', documentationUrl, setDocumentationUrl],
          ] as const
        ).map(([label, value, setter]) => (
          <Field key={label} label={label}>
            <input
              className="input"
              type="url"
              placeholder="https://"
              value={value}
              onChange={(event) => setter(event.target.value)}
            />
          </Field>
        ))}
        <Field label="Target launch">
          <input
            className="input"
            type="date"
            value={targetLaunchAt}
            onChange={(event) => setTargetLaunchAt(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function MilestoneDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { createMilestone } = usePortal();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Product');
  const [dueAt, setDueAt] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [visibility, setVisibility] = useState<MilestoneInput['visibility']>('project_and_klineo');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!title.trim()) return;
    const input: MilestoneInput = {
      projectId: project.id,
      title: title.trim(),
      category: category.trim() || 'Product',
      dueAt: dueAt || null,
      ownerName: ownerName.trim() || null,
      evidenceUrl: evidenceUrl.trim() || null,
      visibility,
    };
    setBusy(true);
    try {
      await createMilestone(input);
      setTitle('');
      setDueAt('');
      setOwnerName('');
      setEvidenceUrl('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add milestone"
      description="Record a concrete outcome, owner, deadline, and optional evidence link."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!title.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Adding…' : 'Add milestone'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Milestone" span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Category">
          <input
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          />
        </Field>
        <Field label="Owner">
          <input
            className="input"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
          />
        </Field>
        <Field label="Due date">
          <input
            className="input"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>
        <Field label="Visibility">
          <select
            className="select"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as MilestoneInput['visibility'])}
          >
            <option value="project_and_klineo">Project + Klineo (default)</option>
            <option value="project_private">Project only</option>
          </select>
        </Field>
        <Field label="Evidence URL" span>
          <input
            className="input"
            type="url"
            placeholder="https://"
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function BlockerDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { createBlocker } = usePortal();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [severity, setSeverity] = useState<Blocker['severity']>('medium');
  const [visibility, setVisibility] = useState<BlockerInput['visibility']>('project_and_klineo');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!title.trim()) return;
    const input: BlockerInput = {
      projectId: project.id,
      title: title.trim(),
      detail: detail.trim(),
      severity,
      ownerName: ownerName.trim() || null,
      visibility,
    };
    setBusy(true);
    try {
      await createBlocker(input);
      setTitle('');
      setDetail('');
      setOwnerName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Report blocker"
      description="Make the risk visible to the people who can help without broadening its audience."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!title.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Reporting…' : 'Report blocker'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Blocker" span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Severity">
          <select
            className="select"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Blocker['severity'])}
          >
            {(['low', 'medium', 'high', 'critical'] as const).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner">
          <input
            className="input"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
          />
        </Field>
        <Field label="Detail" span>
          <textarea
            className="textarea"
            rows={5}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        </Field>
        <Field label="Visibility" span>
          <select
            className="select"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as BlockerInput['visibility'])}
          >
            <option value="project_and_klineo">Project + Klineo (default)</option>
            <option value="project_private">Project only</option>
          </select>
        </Field>
      </div>
    </Dialog>
  );
}

function ReviewDialog({
  open,
  project,
  subject,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  subject: { type: ReviewRequest['subjectType']; id: string; title: string } | null;
  onClose: () => void;
}): React.JSX.Element {
  const { requestReview } = usePortal();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && subject) setTitle(`Review: ${subject.title}`);
  }, [open, subject]);
  const submit = async (): Promise<void> => {
    if (!subject || !title.trim()) return;
    const input: ReviewRequestInput = {
      projectId: project.id,
      subjectType: subject.type,
      subjectId: subject.id,
      title: title.trim(),
      dueAt: dueAt || null,
    };
    setBusy(true);
    try {
      await requestReview(input);
      setTitle('');
      setDueAt('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request Klineo review"
      description="Create a trackable review request for this exact submitted record."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={!subject || !title.trim() || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Requesting…' : 'Request review'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Review title" span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Requested by">
          <input className="input" value={project.name} disabled />
        </Field>
        <Field label="Due date">
          <input
            className="input"
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function ShowcaseDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { createShowcase } = usePortal();
  const [type, setType] = useState<ShowcaseItem['type']>('screenshot');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('project_and_klineo');
  const [busy, setBusy] = useState(false);
  const ready = title.trim() && (type === 'screenshot' ? file : url.trim());
  const submit = async (): Promise<void> => {
    if (!ready) return;
    setBusy(true);
    const input: ShowcaseInput = {
      projectId: project.id,
      type,
      title: title.trim(),
      description: description.trim(),
      url: type === 'screenshot' ? null : url.trim(),
      visibility,
    };
    try {
      await createShowcase(input, file ?? undefined);
      setTitle('');
      setDescription('');
      setUrl('');
      setFile(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add showcase item"
      description="Share product proof with Klineo first, then request partner or public approval."
      wide
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? 'Preparing…' : 'Submit to Klineo'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Item type">
          <select
            className="select"
            value={type}
            onChange={(event) => {
              setType(event.target.value as ShowcaseItem['type']);
              setFile(null);
            }}
          >
            {(
              ['screenshot', 'demo', 'website', 'repository', 'video', 'documentation'] as const
            ).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visibility">
          <select
            className="select"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
          >
            <option value="project_and_klineo">Project + Klineo (default)</option>
            <option value="project_private">Project only</option>
          </select>
        </Field>
        <Field label="Title" span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What should reviewers notice?"
          />
        </Field>
        <Field label="Description" span>
          <textarea
            className="textarea"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain what this demonstrates and where reviewers should focus."
          />
        </Field>
        {type === 'screenshot' ? (
          <Field label="Screenshot" span>
            <label className={cx('file-drop', file && 'has-file')}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <ImagePlus aria-hidden="true" />
              <span>
                <strong>{file?.name ?? 'Choose a product screenshot'}</strong>
                <small>
                  {file
                    ? `${Math.round(file.size / 1024)} KB · re-encoded before upload`
                    : 'JPEG, PNG, WebP, or AVIF · 10 MB maximum'}
                </small>
              </span>
            </label>
          </Field>
        ) : (
          <Field label={`${titleCase(type)} URL`} span>
            <div className="input-with-icon">
              <Link2 aria-hidden="true" />
              <input
                className="input"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
              />
            </div>
          </Field>
        )}
        <div className="form-notice form-notice--span">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>Screenshot protection.</strong> Images are validated, resized, and re-encoded to
            remove EXIF metadata before a signed upload.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function ImportDialog({
  open,
  project,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  onClose: () => void;
}): React.JSX.Element {
  const { importDesktopSubmission } = usePortal();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!file) return;
    setBusy(true);
    try {
      await importDesktopSubmission(project.id, file);
      setFile(null);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import desktop submission"
      description="Only an explicit Bot Combinator submission package is accepted. The portal verifies its content digest before recording it."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!file || busy} onClick={() => void submit()}>
            {busy ? 'Verifying…' : 'Verify and import'}
          </Button>
        </>
      }
    >
      <label className={cx('file-drop file-drop--json', file && 'has-file')}>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <FileJson2 aria-hidden="true" />
        <span>
          <strong>{file?.name ?? 'Choose submission JSON'}</strong>
          <small>
            {file
              ? 'Ready for digest verification'
              : 'Exported intentionally from the private desktop vault'}
          </small>
        </span>
      </label>
      <div className="import-boundary">
        <LockKeyhole aria-hidden="true" />
        <p>
          The package never contains investor records, credentials, private notes, email history, or
          agent transcripts.
        </p>
      </div>
    </Dialog>
  );
}

function CommentDialog({
  open,
  project,
  subject,
  onClose,
}: {
  open: boolean;
  project: PortalProject;
  subject: {
    type: PortalComment['subjectType'];
    id: string;
    title: string;
    visibility: Visibility;
  } | null;
  onClose: () => void;
}): React.JSX.Element {
  const { workspace, addComment } = usePortal();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<Visibility | 'klineo_internal'>(
    'project_and_klineo',
  );
  const [busy, setBusy] = useState(false);
  const isPartner = workspace ? isBotChainRole(workspace.user.role) : false;
  const isKlineo = workspace ? isKlineoRole(workspace.user.role) : false;
  useEffect(() => {
    if (open) {
      setVisibility(
        isPartner
          ? 'bot_chain'
          : subject?.visibility === 'project_private'
            ? 'project_private'
            : 'project_and_klineo',
      );
    }
  }, [isPartner, open, subject?.visibility]);
  const submit = async (): Promise<void> => {
    if (!subject || !body.trim()) return;
    setBusy(true);
    try {
      await addComment({
        projectId: project.id,
        subjectType: subject.type,
        subjectId: subject.id,
        body: body.trim(),
        visibility,
      });
      setBody('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add review comment"
      description={subject?.title}
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!body.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Adding…' : 'Add comment'}
          </Button>
        </>
      }
    >
      <div className="stack stack--large">
        <Field label="Comment">
          <textarea
            className="textarea"
            rows={6}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Audience">
          <select
            className="select"
            value={visibility}
            disabled={isPartner}
            onChange={(event) =>
              setVisibility(event.target.value as Visibility | 'klineo_internal')
            }
          >
            {!isPartner ? <option value="project_private">Project only</option> : null}
            {!isPartner && subject?.visibility !== 'project_private' ? (
              <option value="project_and_klineo">Project + Klineo</option>
            ) : null}
            {isPartner ? <option value="bot_chain">BOT Chain approved thread</option> : null}
            {isKlineo ? <option value="klineo_internal">Klineo internal note</option> : null}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}
