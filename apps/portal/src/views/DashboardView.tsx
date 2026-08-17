import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  ExternalLink,
  Flag,
  Layers3,
  Mail,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { PortalProject, PortalWorkspace } from '../lib/types';
import { isBotChainRole, isKlineoRole } from '../lib/visibility';
import { usePortal } from '../state/PortalContext';
import {
  Badge,
  Button,
  EmptyState,
  ProgressBar,
  StatusBadge,
  formatDate,
  relativeDate,
  titleCase,
} from '../components/Primitives';

function overdue(
  project: PortalProject,
  milestones: PortalWorkspace['milestones'],
  referenceTime: number,
): number {
  return milestones.filter(
    (item) =>
      item.projectId === project.id &&
      item.dueAt &&
      new Date(item.dueAt).valueOf() < referenceTime &&
      !['completed', 'cancelled'].includes(item.status),
  ).length;
}

export function DashboardView({
  workspace,
  onOpenProject,
  onSubmitProgress,
  onOpenReviews,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (projectId: string) => void;
  onSubmitProgress: () => void;
  onOpenReviews: () => void;
}): React.JSX.Element {
  if (isKlineoRole(workspace.user.role)) {
    return (
      <KlineoDashboard
        workspace={workspace}
        onOpenProject={onOpenProject}
        onOpenReviews={onOpenReviews}
      />
    );
  }
  if (isBotChainRole(workspace.user.role)) {
    return <PartnerDashboard workspace={workspace} onOpenProject={onOpenProject} />;
  }
  return (
    <ProjectDashboard
      workspace={workspace}
      onOpenProject={onOpenProject}
      onSubmitProgress={onSubmitProgress}
      onOpenReviews={onOpenReviews}
    />
  );
}

function KlineoDashboard({
  workspace,
  onOpenProject,
  onOpenReviews,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (projectId: string) => void;
  onOpenReviews: () => void;
}): React.JSX.Element {
  const [renderedAt] = useState(() => Date.now());
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);
  const { reviewApplication } = usePortal();
  const activeProjects = workspace.projects.filter(
    (project) => !['graduated', 'on_hold'].includes(project.stage),
  );
  const averageProgress = activeProjects.length
    ? Math.round(
        activeProjects.reduce((total, project) => total + project.progressPercent, 0) /
          activeProjects.length,
      )
    : 0;
  const openBlockers = workspace.blockers.filter((item) => item.status !== 'resolved');
  const overdueMilestones = workspace.milestones.filter(
    (item) =>
      item.dueAt &&
      new Date(item.dueAt).valueOf() < renderedAt &&
      !['completed', 'cancelled'].includes(item.status),
  );
  const reviewQueue = workspace.reviewRequests.filter(
    (review) => !['approved', 'closed'].includes(review.status),
  );
  const disclosureQueue = workspace.visibilityApprovals.filter(
    (approval) => approval.status === 'requested',
  );
  const applicationQueue = workspace.applications.filter((application) =>
    ['submitted', 'in_review', 'interview'].includes(application.status),
  );
  const newApplications = workspace.applications.filter(
    (application) => application.status === 'submitted',
  );

  const moveApplication = async (
    applicationId: string,
    status: 'in_review' | 'interview' | 'accepted' | 'declined',
  ): Promise<void> => {
    setBusyApplicationId(applicationId);
    try {
      await reviewApplication({ applicationId, status, reviewerNote: '' });
    } finally {
      setBusyApplicationId(null);
    }
  };

  return (
    <div className="view-enter stack stack--section">
      <header className="view-header">
        <div>
          <span className="eyebrow">Program command center</span>
          <h1>Good morning, {workspace.user.fullName.split(' ')[0]}.</h1>
          <p>Every team’s current state, upcoming commitments, and decisions that need Klineo.</p>
        </div>
        <div className="view-header__meta">
          <span>
            <Clock3 aria-hidden="true" /> Updated just now
          </span>
          <Button
            tone="primary"
            icon={<MessageSquareText aria-hidden="true" />}
            onClick={onOpenReviews}
          >
            Open review queue
          </Button>
        </div>
      </header>

      <section className="metric-rail" aria-label="Program metrics">
        <article>
          <small>Active teams</small>
          <strong>{activeProjects.length}</strong>
          <span>{workspace.cohorts.filter((c) => c.status === 'active').length} active cohort</span>
        </article>
        <article className={newApplications.length ? 'metric--lime' : ''}>
          <small>New applications</small>
          <strong>{newApplications.length}</strong>
          <span>{applicationQueue.length} in selection</span>
        </article>
        <article>
          <small>Average progress</small>
          <strong>{averageProgress}%</strong>
          <span>Across active projects</span>
        </article>
        <article className={overdueMilestones.length ? 'metric--warn' : ''}>
          <small>Overdue milestones</small>
          <strong>{overdueMilestones.length}</strong>
          <span>{overdueMilestones.length ? 'Needs follow-up' : 'All on schedule'}</span>
        </article>
        <article className={openBlockers.length ? 'metric--warn' : ''}>
          <small>Open blockers</small>
          <strong>{openBlockers.length}</strong>
          <span>{openBlockers.filter((b) => b.severity === 'critical').length} critical</span>
        </article>
        <article>
          <small>Awaiting Klineo</small>
          <strong>{reviewQueue.length + disclosureQueue.length + applicationQueue.length}</strong>
          <span>{disclosureQueue.length} sharing decisions</span>
        </article>
      </section>

      <section className="application-queue">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Cohort intake</span>
            <h2>Project applications</h2>
          </div>
          <span>{applicationQueue.length} active · private to Klineo</span>
        </div>
        {workspace.applications.length ? (
          <div className="application-list">
            {workspace.applications.map((application) => (
              <article key={application.id}>
                <header>
                  <span className="application-mark">
                    {application.projectName.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <span>
                      <strong>{application.projectName}</strong>
                      <StatusBadge status={application.status} />
                    </span>
                    <small>
                      Submitted {relativeDate(application.submittedAt)} ·{' '}
                      {titleCase(application.productStage)}
                    </small>
                  </div>
                </header>
                <p>{application.productSummary}</p>
                <div className="application-meta">
                  <a href={`mailto:${application.applicantEmail}`}>
                    <Mail aria-hidden="true" />
                    <span>
                      <strong>{application.applicantName}</strong>
                      <small>
                        {application.roleTitle ?? 'Project contact'} · {application.applicantEmail}
                      </small>
                    </span>
                  </a>
                  <span>
                    <Layers3 aria-hidden="true" />
                    <span>
                      <strong>{application.teamSize ?? '—'}</strong>
                      <small>{application.teamSize === 1 ? 'team member' : 'team members'}</small>
                    </span>
                  </span>
                  {application.websiteUrl ? (
                    <a href={application.websiteUrl} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden="true" />
                      <span>
                        <strong>Product site</strong>
                        <small>Open in new tab</small>
                      </span>
                    </a>
                  ) : null}
                </div>
                <div className="application-goals">
                  <small>What they want from Bot Combinator</small>
                  <p>{application.programGoals}</p>
                </div>
                <footer>
                  <span>
                    {application.reviewedByName
                      ? `Last reviewed by ${application.reviewedByName}`
                      : `Reference BC-${application.id.slice(0, 8).toUpperCase()}`}
                  </span>
                  <div>
                    {application.status === 'submitted' ? (
                      <Button
                        size="small"
                        tone="primary"
                        disabled={busyApplicationId === application.id}
                        onClick={() => void moveApplication(application.id, 'in_review')}
                      >
                        Start review
                      </Button>
                    ) : null}
                    {application.status === 'in_review' ? (
                      <Button
                        size="small"
                        tone="primary"
                        disabled={busyApplicationId === application.id}
                        onClick={() => void moveApplication(application.id, 'interview')}
                      >
                        Move to interview
                      </Button>
                    ) : null}
                    {application.status === 'interview' ? (
                      <Button
                        size="small"
                        tone="primary"
                        disabled={busyApplicationId === application.id}
                        onClick={() => void moveApplication(application.id, 'accepted')}
                      >
                        Accept project
                      </Button>
                    ) : null}
                    {['in_review', 'interview'].includes(application.status) ? (
                      <Button
                        size="small"
                        tone="danger"
                        disabled={busyApplicationId === application.id}
                        onClick={() => void moveApplication(application.id, 'declined')}
                      >
                        Decline
                      </Button>
                    ) : null}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No applications yet"
            detail="New Bot Combinator applications will appear here as soon as they are submitted."
          />
        )}
      </section>

      <div className="dashboard-grid">
        <section className="project-ledger">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Portfolio</span>
              <h2>Team progress</h2>
            </div>
            <span>{workspace.projects.length} projects</span>
          </div>
          <div className="ledger-head">
            <span>Project</span>
            <span>Stage</span>
            <span>Progress</span>
            <span>Readiness</span>
            <span>Last update</span>
            <span />
          </div>
          <div className="ledger-body">
            {workspace.projects.map((project) => {
              const blockers = openBlockers.filter((item) => item.projectId === project.id);
              const late = overdue(project, workspace.milestones, renderedAt);
              return (
                <button type="button" key={project.id} onClick={() => onOpenProject(project.id)}>
                  <span className="project-cell">
                    <i style={{ background: project.accent }}>
                      {project.name.slice(0, 2).toUpperCase()}
                    </i>
                    <span>
                      <strong>{project.name}</strong>
                      <small>{project.cohortName ?? 'Unassigned'}</small>
                    </span>
                  </span>
                  <span>
                    <Badge tone="neutral">{titleCase(project.stage)}</Badge>
                  </span>
                  <span>
                    <ProgressBar value={project.progressPercent} compact />
                  </span>
                  <span className="readiness-dots" aria-label="Readiness status">
                    <i className={`is-${project.integrationReadiness}`} title="Integration" />
                    <i className={`is-${project.liquidityReadiness}`} title="Liquidity" />
                    <i className={`is-${project.launchReadiness}`} title="Launch" />
                  </span>
                  <span className="ledger-freshness">
                    <strong>{relativeDate(project.lastUpdateAt)}</strong>
                    {blockers.length || late ? (
                      <small className="text-warn">
                        {blockers.length} blockers · {late} late
                      </small>
                    ) : (
                      <small>On track</small>
                    )}
                  </span>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <aside className="decision-queue">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Decisions</span>
              <h2>Needs attention</h2>
            </div>
            <button type="button" onClick={onOpenReviews}>
              View all
            </button>
          </div>
          <div className="decision-list">
            {disclosureQueue.slice(0, 2).map((approval) => {
              const project = workspace.projects.find((item) => item.id === approval.projectId);
              return (
                <button type="button" key={approval.id} onClick={onOpenReviews}>
                  <span className="decision-icon decision-icon--share">
                    <Eye aria-hidden="true" />
                  </span>
                  <span>
                    <small>SHARING APPROVAL</small>
                    <strong>
                      {project?.name ?? 'Project'} → {titleCase(approval.toVisibility)}
                    </strong>
                    <p>Requested by {approval.requestedByName}</p>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
            {reviewQueue.slice(0, 3).map((review) => {
              const project = workspace.projects.find((item) => item.id === review.projectId);
              return (
                <button type="button" key={review.id} onClick={onOpenReviews}>
                  <span className="decision-icon">
                    <Flag aria-hidden="true" />
                  </span>
                  <span>
                    <small>{titleCase(review.subjectType)}</small>
                    <strong>{review.title}</strong>
                    <p>
                      {project?.name} · due {formatDate(review.dueAt)}
                    </p>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </button>
              );
            })}
            {!disclosureQueue.length && !reviewQueue.length ? (
              <EmptyState title="Queue clear" detail="There are no pending program decisions." />
            ) : null}
          </div>
        </aside>
      </div>

      <section className="signal-strip">
        <div>
          <Sparkles aria-hidden="true" />
          <span>
            <strong>Program signal</strong>
            <p>
              Fluent Markets completed liquidity rehearsal. Atlas Pay is next in the
              launch-readiness path.
            </p>
          </span>
        </div>
        <Button tone="quiet" onClick={() => onOpenProject('project-fluent')}>
          Open Fluent Markets <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}

function ProjectDashboard({
  workspace,
  onOpenProject,
  onSubmitProgress,
  onOpenReviews,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (projectId: string) => void;
  onSubmitProgress: () => void;
  onOpenReviews: () => void;
}): React.JSX.Element {
  const [renderedAt] = useState(() => Date.now());
  const project = workspace.projects[0];
  if (!project)
    return (
      <EmptyState
        title="No project assigned"
        detail="Ask Klineo to add you to a project workspace."
      />
    );
  const updates = workspace.progressUpdates.filter((item) => item.projectId === project.id);
  const milestones = workspace.milestones.filter((item) => item.projectId === project.id);
  const blockers = workspace.blockers.filter(
    (item) => item.projectId === project.id && item.status !== 'resolved',
  );
  const reviews = workspace.reviewRequests.filter(
    (item) => item.projectId === project.id && !['approved', 'closed'].includes(item.status),
  );
  const latest = updates[0];
  const daysSinceUpdate = project.lastUpdateAt
    ? Math.floor((renderedAt - new Date(project.lastUpdateAt).valueOf()) / 86_400_000)
    : 99;
  return (
    <div className="view-enter stack stack--section">
      <header className="project-home-header">
        <div className="project-home-header__mark" style={{ background: project.accent }}>
          {project.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <span className="eyebrow">{project.cohortName ?? 'Project workspace'}</span>
          <h1>{project.name}</h1>
          <p>{project.tagline}</p>
        </div>
        <div className="project-home-header__action">
          <Badge tone={daysSinceUpdate > 7 ? 'warning' : 'success'} dot>
            {daysSinceUpdate > 7 ? 'Update due' : 'Current'}
          </Badge>
          <Button tone="primary" icon={<Plus aria-hidden="true" />} onClick={onSubmitProgress}>
            Submit weekly progress
          </Button>
        </div>
      </header>

      <section className="project-progress-hero">
        <div>
          <small>Overall progress</small>
          <strong>
            {project.progressPercent}
            <span>%</span>
          </strong>
          <ProgressBar value={project.progressPercent} />
        </div>
        <div className="readiness-trio">
          <article>
            <span>
              <Layers3 aria-hidden="true" />
            </span>
            <small>Integration</small>
            <StatusBadge status={project.integrationReadiness} />
          </article>
          <article>
            <span>
              <ShieldCheck aria-hidden="true" />
            </span>
            <small>Liquidity</small>
            <StatusBadge status={project.liquidityReadiness} />
          </article>
          <article>
            <span>
              <Flag aria-hidden="true" />
            </span>
            <small>Launch</small>
            <StatusBadge status={project.launchReadiness} />
          </article>
        </div>
        <div className="launch-target">
          <CalendarClock aria-hidden="true" />
          <span>
            <small>Target launch</small>
            <strong>{formatDate(project.targetLaunchAt)}</strong>
          </span>
        </div>
      </section>

      <div className="project-home-grid">
        <section className="latest-update">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Latest submission</span>
              <h2>{latest?.title ?? 'No update yet'}</h2>
            </div>
            {latest ? <Badge tone="neutral">v{latest.version}</Badge> : null}
          </div>
          {latest ? (
            <>
              <p>{latest.summary}</p>
              <div className="update-evidence-row">
                <span>
                  <CheckCircle2 aria-hidden="true" /> {latest.accomplishments.length}{' '}
                  accomplishments
                </span>
                <span>
                  <Clock3 aria-hidden="true" /> {relativeDate(latest.submittedAt)}
                </span>
              </div>
              <Button tone="quiet" onClick={() => onOpenProject(project.id)}>
                Open submission history <ArrowRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <EmptyState
              title="Start the record"
              detail="Submit the first immutable weekly update."
            />
          )}
        </section>
        <aside className="next-actions">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Next</span>
              <h2>Action list</h2>
            </div>
          </div>
          {milestones
            .filter((item) => !['completed', 'cancelled'].includes(item.status))
            .slice(0, 4)
            .map((milestone) => (
              <button type="button" key={milestone.id} onClick={() => onOpenProject(project.id)}>
                <span className={`task-state task-state--${milestone.status}`} />
                <span>
                  <strong>{milestone.title}</strong>
                  <small>
                    {formatDate(milestone.dueAt)} · {milestone.ownerName ?? 'Unassigned'}
                  </small>
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
        </aside>
      </div>

      <section className="project-alert-row">
        <button
          type="button"
          className={blockers.length ? 'has-alert' : ''}
          onClick={() => onOpenProject(project.id)}
        >
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>
              {blockers.length} open blocker{blockers.length === 1 ? '' : 's'}
            </strong>
            <small>{blockers[0]?.title ?? 'No active blockers'}</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenReviews}>
          <MessageSquareText aria-hidden="true" />
          <span>
            <strong>
              {reviews.length} active review{reviews.length === 1 ? '' : 's'}
            </strong>
            <small>{reviews[0]?.title ?? 'Nothing waiting on Klineo'}</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <div>
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Sharing stays intentional</strong>
            <small>Klineo sees default submissions. BOT Chain and public require approval.</small>
          </span>
        </div>
      </section>
    </div>
  );
}

function PartnerDashboard({
  workspace,
  onOpenProject,
}: {
  workspace: PortalWorkspace;
  onOpenProject: (projectId: string) => void;
}): React.JSX.Element {
  const updates = workspace.progressUpdates;
  const ready = workspace.projects.filter(
    (project) => project.integrationReadiness === 'ready',
  ).length;
  const liquidityReady = workspace.projects.filter(
    (project) => project.liquidityReadiness === 'ready',
  ).length;
  const launchScheduled = workspace.projects.filter(
    (project) => project.stage === 'launch_scheduled',
  ).length;
  return (
    <div className="view-enter stack stack--section partner-view">
      <header className="view-header view-header--partner">
        <div>
          <span className="eyebrow">BOT Chain approved view</span>
          <h1>Program progress, cleared for partner review.</h1>
          <p>
            Only project-consented and Klineo-approved records appear here. Private contacts,
            fundraising data, and internal notes are excluded.
          </p>
        </div>
        <div className="partner-seal">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Disclosure controlled</strong>
            <small>{updates.length} approved update versions</small>
          </span>
        </div>
      </header>
      <section className="metric-rail metric-rail--partner">
        <article>
          <small>Approved projects</small>
          <strong>{workspace.projects.length}</strong>
          <span>Partner-visible</span>
        </article>
        <article>
          <small>Integration ready</small>
          <strong>{ready}</strong>
          <span>Verified program state</span>
        </article>
        <article>
          <small>Liquidity ready</small>
          <strong>{liquidityReady}</strong>
          <span>Approved readiness</span>
        </article>
        <article>
          <small>Launch scheduled</small>
          <strong>{launchScheduled}</strong>
          <span>Upcoming</span>
        </article>
      </section>
      <section className="partner-projects">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Approved pipeline</span>
            <h2>Project readiness</h2>
          </div>
          <span>Last approved update</span>
        </div>
        {workspace.projects.map((project) => {
          const latest = updates.find((item) => item.projectId === project.id);
          return (
            <button type="button" key={project.id} onClick={() => onOpenProject(project.id)}>
              <div className="partner-project__identity">
                <span style={{ background: project.accent }}>
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{project.name}</strong>
                  <small>{project.tagline}</small>
                </div>
              </div>
              <div className="partner-project__progress">
                <ProgressBar value={project.progressPercent} label="Progress" />
              </div>
              <div className="partner-project__readiness">
                <span>
                  Integration <StatusBadge status={project.integrationReadiness} />
                </span>
                <span>
                  Liquidity <StatusBadge status={project.liquidityReadiness} />
                </span>
                <span>
                  Launch <StatusBadge status={project.launchReadiness} />
                </span>
              </div>
              <div className="partner-project__update">
                <small>
                  {latest
                    ? `v${latest.version} · ${relativeDate(latest.submittedAt)}`
                    : 'No approved update'}
                </small>
                <strong>{latest?.title ?? titleCase(project.stage)}</strong>
              </div>
              <ArrowRight aria-hidden="true" />
            </button>
          );
        })}
      </section>
      <section className="partner-disclosure-note">
        <Eye aria-hidden="true" />
        <div>
          <strong>What this view excludes</strong>
          <p>
            Team email addresses, fundraising pipeline, investor records, private agent history,
            credentials, Klineo-only notes, and any submission without explicit project consent.
          </p>
        </div>
      </section>
    </div>
  );
}
