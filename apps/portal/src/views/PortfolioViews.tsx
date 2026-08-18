import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Filter,
  GalleryHorizontalEnd,
  Link2,
  MailPlus,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { usePortal } from '../state/PortalContext';
import type {
  CreateCohortInput,
  CreateProjectInput,
  InviteInput,
  ManagedPortalRole,
  PortalProject,
  PortalWorkspace,
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
  formatDate,
  relativeDate,
  titleCase,
} from '../components/Primitives';

export function ProjectsView({
  workspace,
  onOpenProject,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (id: string) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canOperate = isKlineoOperatorRole(workspace.user.role);
  const filtered = workspace.projects.filter(
    (project) =>
      (stage === 'all' || project.stage === stage) &&
      `${project.name} ${project.tagline} ${project.cohortName ?? ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const title = isKlineoRole(workspace.user.role)
    ? 'Projects'
    : isBotChainRole(workspace.user.role)
      ? 'Approved projects'
      : 'Product workspace';
  return (
    <div className="view-enter stack stack--section">
      <header className="view-header">
        <div>
          <span className="eyebrow">Portfolio</span>
          <h1>{title}</h1>
          <p>
            {isKlineoRole(workspace.user.role)
              ? 'Every project from screening through graduation, with current readiness and delivery state.'
              : isBotChainRole(workspace.user.role)
                ? 'Only projects with approved partner-visible progress or showcase items.'
                : 'Your project profile, product proof, milestones, and submission history.'}
          </p>
        </div>
        {canOperate ? (
          <div className="view-header-actions">
            <Button icon={<UserPlus aria-hidden="true" />} onClick={() => setInviteOpen(true)}>
              Invite member
            </Button>
            <Button
              tone="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setCreateOpen(true)}
            >
              Add project
            </Button>
          </div>
        ) : null}
      </header>
      <div className="filter-bar">
        <label>
          <Search aria-hidden="true" />
          <input
            aria-label="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects…"
          />
        </label>
        <label>
          <Filter aria-hidden="true" />
          <select
            aria-label="Filter projects by stage"
            value={stage}
            onChange={(event) => setStage(event.target.value)}
          >
            <option value="all">All stages</option>
            {Array.from(new Set(workspace.projects.map((project) => project.stage))).map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </select>
        </label>
        <span>{filtered.length} visible</span>
      </div>
      <section className="portfolio-list">
        {filtered.map((project) => {
          const openBlockers = workspace.blockers.filter(
            (item) => item.projectId === project.id && item.status !== 'resolved',
          ).length;
          const openReviews = workspace.reviewRequests.filter(
            (item) =>
              item.projectId === project.id && !['approved', 'closed'].includes(item.status),
          ).length;
          return (
            <button type="button" key={project.id} onClick={() => onOpenProject(project.id)}>
              <span className="portfolio-project-mark" style={{ background: project.accent }}>
                {project.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="portfolio-project-copy">
                <small>{project.cohortName ?? 'No cohort'}</small>
                <strong>{project.name}</strong>
                <p>{project.tagline}</p>
              </span>
              <span className="portfolio-project-stage">
                <Badge tone="neutral">{titleCase(project.stage)}</Badge>
                <small>Updated {relativeDate(project.lastUpdateAt).toLowerCase()}</small>
              </span>
              <span className="portfolio-project-progress">
                <ProgressBar label="Progress" value={project.progressPercent} />
              </span>
              <span className="portfolio-project-signals">
                <i>
                  <span className={`signal-dot is-${project.integrationReadiness}`} />
                  Integration <strong>{titleCase(project.integrationReadiness)}</strong>
                </i>
                <i>
                  <span className={`signal-dot is-${project.liquidityReadiness}`} />
                  Liquidity <strong>{titleCase(project.liquidityReadiness)}</strong>
                </i>
                <i>
                  <span className={`signal-dot is-${project.launchReadiness}`} />
                  Launch <strong>{titleCase(project.launchReadiness)}</strong>
                </i>
              </span>
              <span className="portfolio-project-alerts">
                {openBlockers ? (
                  <i className="is-alert">
                    <AlertTriangle aria-hidden="true" />
                    {openBlockers}
                  </i>
                ) : (
                  <i>
                    <CheckCircle2 aria-hidden="true" />
                    Clear
                  </i>
                )}
                {openReviews ? (
                  <i>
                    <MessageSquareText aria-hidden="true" />
                    {openReviews}
                  </i>
                ) : null}
              </span>
              <ArrowRight aria-hidden="true" />
            </button>
          );
        })}
        {!filtered.length ? (
          <EmptyState title="No matching projects" detail="Adjust the search or stage filter." />
        ) : null}
      </section>
      <InviteDialog
        open={inviteOpen}
        projects={workspace.projects}
        onClose={() => setInviteOpen(false)}
      />
      <CreateProjectDialog
        open={createOpen}
        workspace={workspace}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

export function ReviewsView({ workspace }: { workspace: PortalWorkspace }): React.JSX.Element {
  const { decideVisibility, decideReview } = usePortal();
  const pendingApprovals = workspace.visibilityApprovals.filter(
    (item) => item.status === 'requested',
  );
  const activeReviews = workspace.reviewRequests.filter(
    (item) => !['approved', 'closed'].includes(item.status),
  );
  const isKlineo = isKlineoRole(workspace.user.role);
  const isProject = isProjectRole(workspace.user.role);
  return (
    <div className="view-enter stack stack--section">
      <header className="view-header">
        <div>
          <span className="eyebrow">Review workflow</span>
          <h1>{isKlineo ? 'Review queue' : 'Reviews & sharing'}</h1>
          <p>
            {isKlineo
              ? 'Resolve product feedback, gate requests, and every transition to BOT Chain or public visibility.'
              : 'Track Klineo feedback and every request to share beyond the project workspace.'}
          </p>
        </div>
        <Badge tone={pendingApprovals.length + activeReviews.length ? 'warning' : 'success'} dot>
          {pendingApprovals.length + activeReviews.length} active
        </Badge>
      </header>
      {pendingApprovals.length || isKlineo ? (
        <section className="approval-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Disclosure control</span>
              <h2>Visibility approvals</h2>
              <p>
                A project lead requests sharing; Klineo approves or rejects it. Every decision is
                audited.
              </p>
            </div>
          </div>
          {pendingApprovals.length ? (
            <div className="approval-list">
              {pendingApprovals.map((approval) => {
                const project = workspace.projects.find((item) => item.id === approval.projectId);
                return (
                  <article key={approval.id}>
                    <span className="approval-path">
                      <i>{titleCase(approval.fromVisibility)}</i>
                      <ArrowRight aria-hidden="true" />
                      <strong>{titleCase(approval.toVisibility)}</strong>
                    </span>
                    <div>
                      <small>{titleCase(approval.subjectType)}</small>
                      <h3>{project?.name ?? 'Project'} disclosure request</h3>
                      <p>
                        Requested by {approval.requestedByName} on{' '}
                        {formatDate(approval.requestedAt, true)}
                      </p>
                    </div>
                    {isKlineo ? (
                      <div className="approval-actions">
                        <Button
                          size="small"
                          tone="danger"
                          icon={<XCircle aria-hidden="true" />}
                          onClick={() => void decideVisibility(approval.id, 'rejected')}
                        >
                          Reject
                        </Button>
                        <Button
                          size="small"
                          tone="primary"
                          icon={<CheckCircle2 aria-hidden="true" />}
                          onClick={() => void decideVisibility(approval.id, 'approved')}
                        >
                          Approve share
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="warning">Waiting on Klineo</Badge>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No pending disclosures"
              detail="There are no requests to broaden record visibility."
            />
          )}
        </section>
      ) : null}
      <section className="review-queue-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Product & gate review</span>
            <h2>Open requests</h2>
          </div>
          <span>{activeReviews.length} items</span>
        </div>
        {activeReviews.length ? (
          <div className="review-queue-table">
            <div className="review-queue-head">
              <span>Request</span>
              <span>Project</span>
              <span>Requested</span>
              <span>Due</span>
              <span>Status</span>
              <span />
            </div>
            {activeReviews.map((review) => {
              const project = workspace.projects.find((item) => item.id === review.projectId);
              return (
                <article key={review.id}>
                  <span>
                    <i className={`review-type review-type--${review.subjectType}`}>
                      <FileText aria-hidden="true" />
                    </i>
                    <span>
                      <strong>{review.title}</strong>
                      <small>{titleCase(review.subjectType)}</small>
                    </span>
                  </span>
                  <strong>{project?.name ?? 'Project'}</strong>
                  <span>
                    {review.requestedByName}
                    <small>{formatDate(review.requestedAt)}</small>
                  </span>
                  <span>{formatDate(review.dueAt)}</span>
                  <StatusBadge status={review.status} />
                  {isKlineo ? (
                    <span className="review-row-actions">
                      <Button
                        size="small"
                        tone="quiet"
                        onClick={() => void decideReview(review.id, 'changes_requested')}
                      >
                        Request changes
                      </Button>
                      <Button
                        size="small"
                        tone="primary"
                        onClick={() => void decideReview(review.id, 'approved')}
                      >
                        Approve
                      </Button>
                    </span>
                  ) : (
                    <span>
                      <small>{review.assignedToName ?? 'Klineo queue'}</small>
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No open reviews"
            detail={isProject ? 'Nothing is waiting on Klineo.' : 'The review queue is clear.'}
          />
        )}
      </section>
    </div>
  );
}

export function CohortsView({ workspace }: { workspace: PortalWorkspace }): React.JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const canOperate = isKlineoOperatorRole(workspace.user.role);
  return (
    <div className="view-enter stack stack--section">
      <header className="view-header">
        <div>
          <span className="eyebrow">Program schedule</span>
          <h1>Cohorts</h1>
          <p>Shared deadlines and readiness sequencing across the active program.</p>
        </div>
        {canOperate ? (
          <Button
            tone="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            New cohort
          </Button>
        ) : null}
      </header>
      <div className="cohort-list">
        {workspace.cohorts.map((cohort) => {
          const projects = workspace.projects.filter((project) =>
            cohort.projectIds.includes(project.id),
          );
          const average = projects.length
            ? Math.round(
                projects.reduce((sum, project) => sum + project.progressPercent, 0) /
                  projects.length,
              )
            : 0;
          return (
            <section key={cohort.id}>
              <header>
                <div>
                  <span>
                    <UsersRound aria-hidden="true" />
                  </span>
                  <div>
                    <small>{titleCase(cohort.status)}</small>
                    <h2>{cohort.name}</h2>
                    <p>
                      {formatDate(cohort.startsOn)} → {formatDate(cohort.endsOn)}
                    </p>
                  </div>
                </div>
                <div>
                  <strong>{average}%</strong>
                  <small>Average progress</small>
                </div>
              </header>
              <div className="cohort-track">
                <span style={{ width: `${average}%` }} />
              </div>
              <div className="cohort-projects">
                {projects.map((project) => (
                  <article key={project.id}>
                    <span style={{ background: project.accent }}>
                      {project.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <strong>{project.name}</strong>
                      <small>{titleCase(project.stage)}</small>
                    </div>
                    <ProgressBar value={project.progressPercent} compact />
                    <span>
                      <StatusBadge status={project.launchReadiness} />
                    </span>
                  </article>
                ))}
              </div>
              <footer>
                <CalendarDays aria-hidden="true" />
                <span>
                  <strong>Next cohort checkpoint</strong>
                  <small>Launch readiness review · 21 Aug 2026</small>
                </span>
              </footer>
            </section>
          );
        })}
      </div>
      {!workspace.cohorts.length ? (
        <EmptyState title="No cohorts" detail="Create a cohort after projects are qualified." />
      ) : null}
      <CreateCohortDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateProjectDialog({
  open,
  workspace,
  onClose,
}: {
  open: boolean;
  workspace: PortalWorkspace;
  onClose: () => void;
}): React.JSX.Element {
  const { createProject } = usePortal();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [targetLaunchAt, setTargetLaunchAt] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    const input: CreateProjectInput = {
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      websiteUrl: websiteUrl.trim() || null,
      targetLaunchAt: targetLaunchAt || null,
      cohortId: cohortId || null,
    };
    setBusy(true);
    try {
      await createProject(input);
      setName('');
      setTagline('');
      setDescription('');
      setWebsiteUrl('');
      setTargetLaunchAt('');
      setCohortId('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create project workspace"
      description="Start a private collaboration space, then invite the project team into it."
      wide
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!name.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create workspace'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Project name">
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Cohort">
          <select
            className="select"
            value={cohortId}
            onChange={(event) => setCohortId(event.target.value)}
          >
            <option value="">No cohort yet</option>
            {workspace.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tagline" span>
          <input
            className="input"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            maxLength={180}
          />
        </Field>
        <Field label="Product description" span>
          <textarea
            className="textarea"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field label="Website">
          <input
            className="input"
            type="url"
            placeholder="https://"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
          />
        </Field>
        <Field label="Target launch">
          <input
            className="input"
            type="date"
            value={targetLaunchAt}
            onChange={(event) => setTargetLaunchAt(event.target.value)}
          />
        </Field>
        <div className="form-notice form-notice--span">
          <ShieldCheck aria-hidden="true" />
          <p>
            The workspace starts private. Adding a project does not expose any data to BOT Chain or
            the public showcase.
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function CreateCohortDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { createCohort } = usePortal();
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    const input: CreateCohortInput = {
      name: name.trim(),
      startsOn: startsOn || null,
      endsOn: endsOn || null,
    };
    setBusy(true);
    try {
      await createCohort(input);
      setName('');
      setStartsOn('');
      setEndsOn('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create cohort"
      description="Set the shared program window; projects can be assigned when their workspaces are created."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" disabled={!name.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create cohort'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Cohort name" span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Starts">
          <input
            className="input"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
        </Field>
        <Field label="Ends">
          <input
            className="input"
            type="date"
            min={startsOn || undefined}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function ShowcaseView({
  workspace,
  onOpenProject,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (id: string) => void;
}): React.JSX.Element {
  const [filter, setFilter] = useState<'all' | 'screenshot' | 'link'>('all');
  const items = workspace.showcaseItems.filter(
    (item) =>
      filter === 'all' ||
      (filter === 'screenshot' ? item.type === 'screenshot' : item.type !== 'screenshot'),
  );
  return (
    <div className="view-enter stack stack--section showcase-index">
      <header className="view-header">
        <div>
          <span className="eyebrow">Product gallery</span>
          <h1>{isBotChainRole(workspace.user.role) ? 'Approved showcase' : 'Program showcase'}</h1>
          <p>
            {isBotChainRole(workspace.user.role)
              ? 'Project-consented screenshots and links approved for BOT Chain.'
              : 'Review what teams are building and control where each item can appear.'}
          </p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={filter === 'all' ? 'is-active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={filter === 'screenshot' ? 'is-active' : ''}
            onClick={() => setFilter('screenshot')}
          >
            Screenshots
          </button>
          <button
            type="button"
            className={filter === 'link' ? 'is-active' : ''}
            onClick={() => setFilter('link')}
          >
            Links
          </button>
        </div>
      </header>
      <div className="showcase-index-grid">
        {items.map((item) => {
          const project = workspace.projects.find((candidate) => candidate.id === item.projectId);
          const image = item.assets[0]?.signedUrl;
          return (
            <article key={item.id}>
              {image ? (
                <button
                  type="button"
                  className="showcase-index-image"
                  onClick={() => onOpenProject(item.projectId)}
                >
                  <img src={image} alt={item.title} />
                  <span>
                    Open project <ArrowRight aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="showcase-index-placeholder"
                  onClick={() => onOpenProject(item.projectId)}
                >
                  <GalleryHorizontalEnd aria-hidden="true" />
                  <span>{titleCase(item.type)}</span>
                </button>
              )}
              <div>
                <header>
                  <span style={{ background: project?.accent }}>
                    {project?.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <small>{project?.name}</small>
                    <h2>{item.title}</h2>
                  </div>
                </header>
                <p>{item.description}</p>
                <footer>
                  <VisibilityBadge visibility={item.visibility} />
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <Link2 aria-hidden="true" /> Open
                    </a>
                  ) : null}
                </footer>
              </div>
            </article>
          );
        })}
      </div>
      {!items.length ? (
        <EmptyState title="No showcase items" detail="No items match this view and filter." />
      ) : null}
    </div>
  );
}

export function ActivityView({ workspace }: { workspace: PortalWorkspace }): React.JSX.Element {
  return (
    <div className="view-enter stack stack--section">
      <header className="view-header">
        <div>
          <span className="eyebrow">Accountability</span>
          <h1>Audit history</h1>
          <p>Append-only evidence of submissions, approvals, reviews, and disclosures.</p>
        </div>
        <Badge tone="success" dot>
          Integrity controls active
        </Badge>
      </header>
      <section className="audit-log">
        <div className="audit-log__head">
          <span>Event</span>
          <span>Project</span>
          <span>Actor</span>
          <span>Time</span>
          <span>Identifier</span>
        </div>
        {workspace.auditEvents.map((event) => {
          const project = workspace.projects.find((item) => item.id === event.projectId);
          return (
            <article key={event.id}>
              <span className="audit-event">
                <i>
                  <Activity aria-hidden="true" />
                </i>
                <span>
                  <strong>{titleCase(event.action)}</strong>
                  <small>{event.detail}</small>
                </span>
              </span>
              <span>{project?.name ?? 'Program'}</span>
              <span>
                <Avatar name={event.actorName} small />
                {event.actorName}
              </span>
              <span>{formatDate(event.createdAt, true)}</span>
              <code>{event.id.slice(0, 12)}</code>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function InviteDialog({
  open,
  projects,
  onClose,
}: {
  open: boolean;
  projects: PortalProject[];
  onClose: () => void;
}): React.JSX.Element {
  const { inviteMember } = usePortal();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<ManagedPortalRole>('project_member');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const isProjectRole = role === 'project_lead' || role === 'project_member';
  const submit = async (): Promise<void> => {
    if (!email.trim() || (isProjectRole && !projectId)) return;
    setBusy(true);
    const input: InviteInput = {
      email: email.trim(),
      fullName: fullName.trim(),
      projectId: isProjectRole ? projectId : null,
      role,
    };
    try {
      await inviteMember(input);
      setEmail('');
      setFullName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite portal member"
      description="Invitation-based access creates only the role and project membership selected here."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            icon={<MailPlus aria-hidden="true" />}
            disabled={!email.trim() || (isProjectRole && !projectId) || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Sending…' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name">
          <input
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Role">
          <select
            className="select"
            value={role}
            onChange={(event) => setRole(event.target.value as ManagedPortalRole)}
          >
            <optgroup label="Project">
              <option value="project_lead">Project lead</option>
              <option value="project_member">Project member</option>
            </optgroup>
            <optgroup label="Klineo">
              <option value="klineo_operator">Klineo operator</option>
              <option value="klineo_reviewer">Klineo reviewer</option>
            </optgroup>
            <optgroup label="BOT Chain">
              <option value="bot_chain_reviewer">BOT Chain reviewer</option>
              <option value="bot_chain_viewer">BOT Chain viewer</option>
            </optgroup>
          </select>
        </Field>
        {isProjectRole ? (
          <Field label="Project">
            <select
              className="select"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="form-notice">
            <ShieldCheck aria-hidden="true" />
            <p>
              {role.startsWith('bot_chain_')
                ? 'BOT Chain access is restricted to approved partner records.'
                : 'Klineo roles can operate across program projects.'}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
