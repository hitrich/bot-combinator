import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  Flag,
  Plus,
  Search,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import type {
  ProgramGateStatus,
  ProgramProject,
  ProgramProjectStage,
} from '../../../shared/contracts';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  TextField,
  formatDate,
  titleCase,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

const PROJECT_STAGES: ProgramProjectStage[] = [
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
];

const GATE_STATUSES: ProgramGateStatus[] = [
  'not_started',
  'in_review',
  'needs_work',
  'passed',
  'blocked',
  'waived',
];

const MILESTONE_CATEGORIES = [
  'onboarding',
  'product',
  'security',
  'integration',
  'bdex',
  'bo_wallet',
  'liquidity',
  'launch',
  'community',
  'reporting',
] as const;

function gateTone(
  status: ProgramGateStatus,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (status === 'passed' || status === 'waived') return 'success';
  if (status === 'blocked') return 'danger';
  if (status === 'needs_work') return 'warning';
  if (status === 'in_review') return 'info';
  return 'neutral';
}

function stageTone(
  stage: ProgramProjectStage,
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (stage === 'graduated' || stage === 'live_market') return 'success';
  if (stage === 'on_hold') return 'warning';
  if (stage === 'declined' || stage === 'withdrawn') return 'danger';
  if (['integration_ready', 'liquidity_ready', 'launch_scheduled'].includes(stage)) return 'info';
  return 'neutral';
}

function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function ProgramProjectsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<ProgramProject['source']>('application');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [targetLaunch, setTargetLaunch] = useState('');
  const [portalExportOpen, setPortalExportOpen] = useState(false);
  const [exportingPortal, setExportingPortal] = useState(false);
  const [portalVisibility, setPortalVisibility] = useState<
    'project_private' | 'project_and_klineo'
  >('project_and_klineo');
  const [includePortalMilestones, setIncludePortalMilestones] = useState(true);
  const [includePortalGates, setIncludePortalGates] = useState(true);

  const [nextStage, setNextStage] = useState<ProgramProjectStage>('sourced');
  const [stageReason, setStageReason] = useState('');
  const [movingStage, setMovingStage] = useState(false);

  const [gateKey, setGateKey] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<ProgramGateStatus>('in_review');
  const [gateRationale, setGateRationale] = useState('');
  const [gateEvidence, setGateEvidence] = useState('');
  const [gateReviewer, setGateReviewer] = useState('');
  const [savingGate, setSavingGate] = useState(false);

  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneCategory, setMilestoneCategory] =
    useState<(typeof MILESTONE_CATEGORIES)[number]>('integration');
  const [milestoneOwner, setMilestoneOwner] = useState('');
  const [milestoneDue, setMilestoneDue] = useState('');
  const [milestoneEvidence, setMilestoneEvidence] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [updatingMilestone, setUpdatingMilestone] = useState<string | null>(null);

  const projects = useMemo(() => data?.ecosystemProgram.projects ?? [], [data?.ecosystemProgram]);

  useEffect(() => {
    setSelectedProjectId((current) =>
      current && projects.some((project) => project.id === current)
        ? current
        : (projects[0]?.id ?? null),
    );
  }, [projects]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!selectedProject) return;
    setNextStage(selectedProject.stage);
    setStageReason('');
  }, [selectedProject]);

  if (!data) return <></>;

  const workspace = data.ecosystemProgram;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = projects.filter((project) =>
    [project.name, project.description, project.ownerName, project.stage, project.cohortName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  );
  const activeGateDefinition = workspace.gateDefinitions.find(
    (definition) => definition.key === gateKey,
  );

  const resetCreate = (): void => {
    setName('');
    setWebsite('');
    setDescription('');
    setSource('application');
    setOwnerName('');
    setOwnerEmail('');
    setTargetLaunch('');
  };

  const createProject = async (): Promise<void> => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await command('program.project.create', {
        name: name.trim(),
        website: website.trim() || null,
        description: description.trim() || null,
        source,
        ownerName: ownerName.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
        targetLaunchAt: localDateTimeToIso(targetLaunch),
      });
      setSelectedProjectId(result.projects[0]?.id ?? null);
      setCreateOpen(false);
      resetCreate();
      notify({ tone: 'success', title: 'Program project created', detail: name.trim() });
    } finally {
      setCreating(false);
    }
  };

  const moveStage = async (): Promise<void> => {
    if (!selectedProject || nextStage === selectedProject.stage || !stageReason.trim()) return;
    setMovingStage(true);
    try {
      await command('program.project.stage', {
        projectId: selectedProject.id,
        stage: nextStage,
        reason: stageReason.trim(),
      });
      notify({
        tone: 'success',
        title: 'Project stage recorded',
        detail: `${selectedProject.name} · ${titleCase(nextStage)}`,
      });
    } finally {
      setMovingStage(false);
    }
  };

  const openGate = (key: string): void => {
    if (!selectedProject) return;
    const definition = workspace.gateDefinitions.find((candidate) => candidate.key === key);
    const review = selectedProject.gates.find(
      (candidate) => candidate.gateKey === key && candidate.gateVersion === definition?.version,
    );
    setGateKey(key);
    setGateStatus(review?.status ?? 'in_review');
    setGateRationale(review?.rationale ?? '');
    setGateEvidence(review?.evidence ?? '');
    setGateReviewer(review?.reviewedBy ?? '');
  };

  const saveGate = async (): Promise<void> => {
    if (!selectedProject || !gateKey) return;
    setSavingGate(true);
    try {
      await command('program.gate.review', {
        projectId: selectedProject.id,
        gateKey,
        status: gateStatus,
        rationale: gateRationale.trim() || null,
        evidence: gateEvidence.trim() || null,
        reviewedBy: gateReviewer.trim() || null,
      });
      setGateKey(null);
      notify({
        tone: 'success',
        title: 'Quality gate review recorded',
        detail: `${activeGateDefinition?.title ?? gateKey} · ${titleCase(gateStatus)}`,
      });
    } finally {
      setSavingGate(false);
    }
  };

  const createMilestone = async (): Promise<void> => {
    if (!selectedProject || !milestoneTitle.trim()) return;
    setCreatingMilestone(true);
    try {
      await command('program.milestone.create', {
        projectId: selectedProject.id,
        cohortId: selectedProject.cohortId,
        title: milestoneTitle.trim(),
        category: milestoneCategory,
        owner: milestoneOwner.trim() || null,
        dueAt: localDateTimeToIso(milestoneDue),
        evidenceRequired: milestoneEvidence.trim() || null,
      });
      setMilestoneOpen(false);
      setMilestoneTitle('');
      setMilestoneOwner('');
      setMilestoneDue('');
      setMilestoneEvidence('');
      notify({ tone: 'success', title: 'Milestone added' });
    } finally {
      setCreatingMilestone(false);
    }
  };

  const updateMilestone = async (
    milestone: ProgramProject['milestones'][number],
    status: ProgramProject['milestones'][number]['status'],
  ): Promise<void> => {
    setUpdatingMilestone(milestone.id);
    try {
      await command('program.milestone.update', {
        id: milestone.id,
        status,
        evidence: milestone.evidence,
      });
    } finally {
      setUpdatingMilestone(null);
    }
  };

  const exportPortalSubmission = async (): Promise<void> => {
    if (!selectedProject) return;
    const directory = await window.botCombinator.selectDirectory();
    if (!directory) return;
    setExportingPortal(true);
    try {
      const result = await command('program.portalSubmission.export', {
        directory,
        projectId: selectedProject.id,
        visibility: portalVisibility,
        includeMilestones: includePortalMilestones,
        includeGateReviews: includePortalGates,
      });
      setPortalExportOpen(false);
      notify({
        tone: 'success',
        title: 'Portal submission package created',
        detail: `${selectedProject.name} · ${result.contentDigest.slice(0, 24)}…`,
      });
      await window.botCombinator.revealPath(result.path);
    } finally {
      setExportingPortal(false);
    }
  };

  return (
    <div className="page page--wide program-page">
      <PageHeader
        title="BOT Chain projects"
        description="Klineo’s operating view from sourced teams through qualification, integration, liquidity readiness, launch, and graduation. Every stage and gate decision is written to the local audit trail."
        meta={<Badge tone="info">Klineo internal</Badge>}
        actions={
          <>
            <Button
              icon={<UploadCloud aria-hidden="true" />}
              disabled={!selectedProject}
              onClick={() => setPortalExportOpen(true)}
            >
              Portal submission
            </Button>
            <Button
              tone="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setCreateOpen(true)}
            >
              Add project
            </Button>
          </>
        }
      />

      <section className="program-summary-strip" aria-label="Program readiness summary">
        <div>
          <small>Tracked</small>
          <strong>{workspace.summary.totalProjects}</strong>
        </div>
        <div>
          <small>In active cohorts</small>
          <strong>{workspace.summary.activeCohortProjects}</strong>
        </div>
        <div>
          <small>Integration ready</small>
          <strong>{workspace.summary.integrationReady}</strong>
        </div>
        <div>
          <small>Liquidity ready</small>
          <strong>{workspace.summary.liquidityReady}</strong>
        </div>
        <div>
          <small>Live markets</small>
          <strong>{workspace.summary.liveMarkets}</strong>
        </div>
        <div className={workspace.summary.blockedGates ? 'has-alert' : undefined}>
          <small>Blocked gates</small>
          <strong>{workspace.summary.blockedGates}</strong>
        </div>
      </section>

      <div className="program-workbench">
        <section className="program-roster" aria-label="Program project roster">
          <label className="program-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search projects</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects, owners, cohorts…"
            />
          </label>
          <div className="program-roster__heading">
            <span>{filteredProjects.length} projects</span>
            <span>Stage / gate state</span>
          </div>
          {filteredProjects.length ? (
            <div className="program-roster__list">
              {filteredProjects.map((project) => {
                const blocked = project.gates.filter((gate) => gate.status === 'blocked').length;
                const passed = project.gates.filter((gate) =>
                  ['passed', 'waived'].includes(gate.status),
                ).length;
                return (
                  <button
                    type="button"
                    key={project.id}
                    className={selectedProjectId === project.id ? 'is-active' : undefined}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <span className="program-project-mark" aria-hidden="true">
                      {project.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="program-project-copy">
                      <strong>{project.name}</strong>
                      <small>{project.cohortName ?? titleCase(project.source)}</small>
                    </span>
                    <span className="program-project-state">
                      <Badge tone={stageTone(project.stage)}>{titleCase(project.stage)}</Badge>
                      <small className={blocked ? 'is-blocked' : undefined}>
                        {blocked
                          ? `${blocked} blocked`
                          : `${passed}/${workspace.gateDefinitions.length} gates`}
                      </small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No projects match"
              detail="Try another search or add a program project."
            />
          )}
        </section>

        <section className="program-dossier" aria-label="Selected project dossier">
          {selectedProject ? (
            <>
              <header className="program-dossier__header">
                <div>
                  <span>{selectedProject.cohortName ?? 'No cohort assigned'}</span>
                  <h2>{selectedProject.name}</h2>
                  <p>
                    {selectedProject.description ??
                      'No internal project summary has been recorded.'}
                  </p>
                </div>
                <div>
                  <Badge tone={stageTone(selectedProject.stage)}>
                    {titleCase(selectedProject.stage)}
                  </Badge>
                  {selectedProject.website ? (
                    <button
                      type="button"
                      onClick={() =>
                        void window.botCombinator.openExternal(selectedProject.website!)
                      }
                    >
                      Website <ExternalLink aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </header>

              <div className="program-stage-control">
                <div>
                  <CircleDot aria-hidden="true" />
                  <span>
                    <strong>Stage transition</strong>
                    <small>Requires a written operational reason.</small>
                  </span>
                </div>
                <select
                  className="select"
                  value={nextStage}
                  onChange={(event) => setNextStage(event.target.value as ProgramProjectStage)}
                >
                  {PROJECT_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {titleCase(stage)}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  value={stageReason}
                  onChange={(event) => setStageReason(event.target.value)}
                  placeholder="Reason and evidence reference"
                />
                <Button
                  size="small"
                  loading={movingStage}
                  disabled={nextStage === selectedProject.stage || !stageReason.trim()}
                  onClick={() => void moveStage()}
                >
                  Record move
                </Button>
              </div>

              <section className="program-dossier__section">
                <div className="program-dossier__section-heading">
                  <div>
                    <ClipboardCheck aria-hidden="true" />
                    <span>
                      <strong>Qualification gates</strong>
                      <small>Versioned decisions with rationale and evidence.</small>
                    </span>
                  </div>
                  <span>
                    {
                      selectedProject.gates.filter((gate) =>
                        ['passed', 'waived'].includes(gate.status),
                      ).length
                    }
                    /{workspace.gateDefinitions.length} cleared
                  </span>
                </div>
                <div className="program-gate-list">
                  {workspace.gateDefinitions.map((definition) => {
                    const review = selectedProject.gates.find(
                      (gate) =>
                        gate.gateKey === definition.key && gate.gateVersion === definition.version,
                    );
                    const status = review?.status ?? 'not_started';
                    return (
                      <button
                        type="button"
                        key={definition.key}
                        onClick={() => openGate(definition.key)}
                      >
                        <span
                          className={`program-gate-icon program-gate-icon--${status}`}
                          aria-hidden="true"
                        >
                          {status === 'passed' || status === 'waived' ? (
                            <CheckCircle2 />
                          ) : status === 'blocked' ? (
                            <ShieldAlert />
                          ) : (
                            <Flag />
                          )}
                        </span>
                        <span>
                          <strong>{definition.title}</strong>
                          <small>{review?.rationale ?? definition.description}</small>
                        </span>
                        <Badge tone={gateTone(status)}>{titleCase(status)}</Badge>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="program-dossier__section">
                <div className="program-dossier__section-heading">
                  <div>
                    <CalendarClock aria-hidden="true" />
                    <span>
                      <strong>Milestone ledger</strong>
                      <small>Owners, due dates, required evidence, and completion state.</small>
                    </span>
                  </div>
                  <Button
                    size="small"
                    icon={<Plus aria-hidden="true" />}
                    onClick={() => setMilestoneOpen(true)}
                  >
                    Add milestone
                  </Button>
                </div>
                {selectedProject.milestones.length ? (
                  <div className="program-milestones">
                    {selectedProject.milestones.map((milestone) => (
                      <article key={milestone.id}>
                        <span>
                          <strong>{milestone.title}</strong>
                          <small>
                            {titleCase(milestone.category)} · {milestone.owner ?? 'Unassigned'} ·{' '}
                            {formatDate(milestone.dueAt, true)}
                          </small>
                          {milestone.evidenceRequired ? (
                            <small>Evidence: {milestone.evidenceRequired}</small>
                          ) : null}
                        </span>
                        <select
                          className="select"
                          value={milestone.status}
                          disabled={updatingMilestone === milestone.id}
                          aria-label={`Status for ${milestone.title}`}
                          onChange={(event) =>
                            void updateMilestone(
                              milestone,
                              event.target.value as typeof milestone.status,
                            )
                          }
                        >
                          {['not_started', 'in_progress', 'blocked', 'completed', 'cancelled'].map(
                            (status) => (
                              <option key={status} value={status}>
                                {titleCase(status)}
                              </option>
                            ),
                          )}
                        </select>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No milestones yet"
                    detail="Add the concrete work needed for qualification, integration, liquidity, launch, and reporting."
                  />
                )}
              </section>
            </>
          ) : (
            <EmptyState
              title="No project selected"
              detail="Add or select a project to open its operating dossier."
            />
          )}
        </section>
      </div>

      <Dialog
        open={portalExportOpen}
        onClose={() => setPortalExportOpen(false)}
        title="Prepare hosted portal submission"
        {...(selectedProject
          ? {
              description: `Preview the exact ${selectedProject.name} program fields leaving this private vault.`,
            }
          : {})}
        footer={
          <>
            <Button tone="quiet" onClick={() => setPortalExportOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={exportingPortal}
              disabled={!selectedProject}
              onClick={() => void exportPortalSubmission()}
            >
              Choose folder and export
            </Button>
          </>
        }
      >
        <div className="portal-submission-preview">
          <section>
            <Badge tone="info">Explicit submission · JSON + SHA-256</Badge>
            <h3>Included project profile</h3>
            <p>Name, product description, website, program stage, cohort, and target launch.</p>
          </section>
          <label>
            <input
              type="checkbox"
              checked={includePortalMilestones}
              onChange={(event) => setIncludePortalMilestones(event.target.checked)}
            />
            <span>
              <strong>Milestones and evidence</strong>
              <small>
                Titles, status, due dates, evidence requirements, and evidence references.
              </small>
            </span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={includePortalGates}
              onChange={(event) => setIncludePortalGates(event.target.checked)}
            />
            <span>
              <strong>Gate reviews and evidence</strong>
              <small>Version, status, rationale, evidence references, and review time.</small>
            </span>
          </label>
          <label className="field">
            <span className="field__label">Initial portal visibility</span>
            <select
              className="select"
              value={portalVisibility}
              onChange={(event) =>
                setPortalVisibility(event.target.value as 'project_private' | 'project_and_klineo')
              }
            >
              <option value="project_and_klineo">Project + Klineo (recommended)</option>
              <option value="project_private">Project only</option>
            </select>
          </label>
          <section className="portal-submission-preview__excluded">
            <ShieldAlert aria-hidden="true" />
            <span>
              <strong>Always excluded</strong>
              <small>
                Owner names and emails, investors, fundraising records, mailbox/calendar data,
                private notes, credentials, and agent prompts or history.
              </small>
            </span>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add BOT Chain program project"
        description="Create a Klineo-controlled record. Applicant teams retain their normal CRM functionality and receive BOT Chain Docs separately."
        footer={
          <>
            <Button tone="quiet" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={creating}
              disabled={!name.trim()}
              onClick={() => void createProject()}
            >
              Create project
            </Button>
          </>
        }
      >
        <div className="program-form-grid">
          <TextField
            label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <label className="field">
            <span className="field__label">Source</span>
            <select
              className="select"
              value={source}
              onChange={(event) => setSource(event.target.value as ProgramProject['source'])}
            >
              <option value="application">Application</option>
              <option value="sourced">Sourced</option>
              <option value="referral">Referral</option>
              <option value="local">Local record</option>
            </select>
          </label>
          <TextField
            label="Website"
            type="url"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder="https://"
          />
          <TextField
            label="Target launch"
            type="datetime-local"
            value={targetLaunch}
            onChange={(event) => setTargetLaunch(event.target.value)}
          />
          <TextField
            label="Project owner"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
          />
          <TextField
            label="Owner email"
            type="email"
            value={ownerEmail}
            onChange={(event) => setOwnerEmail(event.target.value)}
          />
          <label className="field field--span-two">
            <span className="field__label">Internal summary</span>
            <textarea
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={gateKey !== null}
        onClose={() => setGateKey(null)}
        title={activeGateDefinition?.title ?? 'Review quality gate'}
        {...(activeGateDefinition?.description
          ? { description: activeGateDefinition.description }
          : {})}
        footer={
          <>
            <Button tone="quiet" onClick={() => setGateKey(null)}>
              Cancel
            </Button>
            <Button tone="primary" loading={savingGate} onClick={() => void saveGate()}>
              Record review
            </Button>
          </>
        }
      >
        <div className="stack stack--medium">
          <label className="field">
            <span className="field__label">Decision</span>
            <select
              className="select"
              value={gateStatus}
              onChange={(event) => setGateStatus(event.target.value as ProgramGateStatus)}
            >
              {GATE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {titleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Reviewed by"
            value={gateReviewer}
            onChange={(event) => setGateReviewer(event.target.value)}
          />
          <label className="field">
            <span className="field__label">Rationale</span>
            <textarea
              className="textarea"
              value={gateRationale}
              onChange={(event) => setGateRationale(event.target.value)}
              placeholder="Why this status is justified"
            />
          </label>
          <label className="field">
            <span className="field__label">Evidence references</span>
            <textarea
              className="textarea"
              value={gateEvidence}
              onChange={(event) => setGateEvidence(event.target.value)}
              placeholder="Links, test results, approvals, or artifact identifiers"
            />
          </label>
        </div>
      </Dialog>

      <Dialog
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        title="Add program milestone"
        {...(selectedProject
          ? { description: `Track required work for ${selectedProject.name}.` }
          : {})}
        footer={
          <>
            <Button tone="quiet" onClick={() => setMilestoneOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={creatingMilestone}
              disabled={!milestoneTitle.trim()}
              onClick={() => void createMilestone()}
            >
              Add milestone
            </Button>
          </>
        }
      >
        <div className="program-form-grid">
          <TextField
            label="Milestone"
            value={milestoneTitle}
            onChange={(event) => setMilestoneTitle(event.target.value)}
            autoFocus
          />
          <label className="field">
            <span className="field__label">Category</span>
            <select
              className="select"
              value={milestoneCategory}
              onChange={(event) =>
                setMilestoneCategory(event.target.value as typeof milestoneCategory)
              }
            >
              {MILESTONE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Owner"
            value={milestoneOwner}
            onChange={(event) => setMilestoneOwner(event.target.value)}
          />
          <TextField
            label="Due"
            type="datetime-local"
            value={milestoneDue}
            onChange={(event) => setMilestoneDue(event.target.value)}
          />
          <label className="field field--span-two">
            <span className="field__label">Evidence required</span>
            <textarea
              className="textarea"
              value={milestoneEvidence}
              onChange={(event) => setMilestoneEvidence(event.target.value)}
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
