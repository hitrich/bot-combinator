import { useMemo, useState } from 'react';
import { CalendarRange, Layers3, Plus, UserRoundCheck, UsersRound } from 'lucide-react';
import type { ProgramCohort } from '../../../shared/contracts';
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

type MembershipState = 'accepted' | 'active' | 'completed' | 'withdrawn';

function cohortTone(status: ProgramCohort['status']): 'success' | 'warning' | 'info' | 'neutral' {
  if (status === 'active') return 'success';
  if (status === 'applications_open') return 'info';
  if (status === 'cancelled') return 'warning';
  return 'neutral';
}

export function ProgramCohortsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [thesis, setThesis] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [capacity, setCapacity] = useState('');
  const [creating, setCreating] = useState(false);
  const [cohortId, setCohortId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [membershipState, setMembershipState] = useState<MembershipState>('accepted');
  const [assigning, setAssigning] = useState(false);

  const workspace = data?.ecosystemProgram;
  const projectsById = useMemo(
    () => new Map((workspace?.projects ?? []).map((project) => [project.id, project])),
    [workspace?.projects],
  );

  if (!data || !workspace) return <></>;

  const selectedCohortId = cohortId || workspace.cohorts[0]?.id || '';
  const selectedProjectId = projectId || workspace.projects[0]?.id || '';

  const createCohort = async (): Promise<void> => {
    if (!name.trim()) return;
    const numericCapacity = capacity ? Number(capacity) : null;
    setCreating(true);
    try {
      const result = await command('program.cohort.create', {
        name: name.trim(),
        thesis: thesis.trim() || null,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
        capacity:
          numericCapacity !== null && Number.isInteger(numericCapacity) && numericCapacity > 0
            ? numericCapacity
            : null,
      });
      setCohortId(result.cohorts[0]?.id ?? '');
      setCreateOpen(false);
      setName('');
      setThesis('');
      setStartsOn('');
      setEndsOn('');
      setCapacity('');
      notify({ tone: 'success', title: 'Cohort created' });
    } finally {
      setCreating(false);
    }
  };

  const assignProject = async (): Promise<void> => {
    if (!selectedCohortId || !selectedProjectId) return;
    setAssigning(true);
    try {
      await command('program.cohort.assign', {
        cohortId: selectedCohortId,
        projectId: selectedProjectId,
        state: membershipState,
      });
      notify({
        tone: 'success',
        title: 'Cohort membership recorded',
        detail: `${projectsById.get(selectedProjectId)?.name ?? 'Project'} · ${titleCase(membershipState)}`,
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="page program-page">
      <PageHeader
        title="Cohorts"
        description="Plan program capacity, group accepted teams, and keep cohort membership separate from a project’s qualification and technical-readiness stage."
        meta={<Badge tone="info">Klineo internal</Badge>}
        actions={
          <Button
            tone="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={() => setCreateOpen(true)}
          >
            New cohort
          </Button>
        }
      />

      <section className="cohort-brief" aria-label="Cohort program overview">
        <div>
          <Layers3 aria-hidden="true" />
          <span>
            <small>Cohorts</small>
            <strong>{workspace.cohorts.length}</strong>
          </span>
        </div>
        <div>
          <UsersRound aria-hidden="true" />
          <span>
            <small>Projects assigned</small>
            <strong>
              {new Set(workspace.cohorts.flatMap((cohort) => cohort.memberProjectIds)).size}
            </strong>
          </span>
        </div>
        <div>
          <UserRoundCheck aria-hidden="true" />
          <span>
            <small>Active cohort projects</small>
            <strong>{workspace.summary.activeCohortProjects}</strong>
          </span>
        </div>
      </section>

      <section className="cohort-assignment" aria-label="Assign project to cohort">
        <header>
          <div>
            <h2>Membership desk</h2>
            <p>
              One project can hold one accepted or active cohort membership at a time. Reassignment
              closes the prior active membership.
            </p>
          </div>
          <Badge tone="neutral">Audited change</Badge>
        </header>
        {workspace.cohorts.length && workspace.projects.length ? (
          <div className="cohort-assignment__controls">
            <label className="field">
              <span className="field__label">Cohort</span>
              <select
                className="select"
                value={selectedCohortId}
                onChange={(event) => setCohortId(event.target.value)}
              >
                {workspace.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Project</span>
              <select
                className="select"
                value={selectedProjectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {workspace.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Membership state</span>
              <select
                className="select"
                value={membershipState}
                onChange={(event) => setMembershipState(event.target.value as MembershipState)}
              >
                {['accepted', 'active', 'completed', 'withdrawn'].map((state) => (
                  <option key={state} value={state}>
                    {titleCase(state)}
                  </option>
                ))}
              </select>
            </label>
            <Button tone="primary" loading={assigning} onClick={() => void assignProject()}>
              Record membership
            </Button>
          </div>
        ) : (
          <EmptyState
            title="Create both a cohort and a project"
            detail="Membership can be recorded after both records exist."
          />
        )}
      </section>

      <section className="cohort-register" aria-label="Cohort register">
        <header>
          <h2>Cohort register</h2>
          <span>{workspace.cohorts.length} total</span>
        </header>
        {workspace.cohorts.length ? (
          <div className="cohort-register__list">
            {workspace.cohorts.map((cohort) => {
              const memberProjects = cohort.memberProjectIds
                .map((id) => projectsById.get(id))
                .filter((project) => project !== undefined);
              return (
                <article key={cohort.id}>
                  <div className="cohort-register__date" aria-hidden="true">
                    <CalendarRange />
                    <span>
                      {cohort.startsOn
                        ? new Date(cohort.startsOn).toLocaleDateString('en-US', { month: 'short' })
                        : 'TBD'}
                    </span>
                  </div>
                  <div className="cohort-register__copy">
                    <div>
                      <h3>{cohort.name}</h3>
                      <Badge tone={cohortTone(cohort.status)}>{titleCase(cohort.status)}</Badge>
                    </div>
                    <p>{cohort.thesis ?? 'No cohort thesis recorded.'}</p>
                    <small>
                      {formatDate(cohort.startsOn)} → {formatDate(cohort.endsOn)} · Capacity{' '}
                      {cohort.capacity ?? 'not capped'}
                    </small>
                  </div>
                  <div className="cohort-register__members">
                    <span>
                      {memberProjects.length} project{memberProjects.length === 1 ? '' : 's'}
                    </span>
                    {memberProjects.length ? (
                      <ul>
                        {memberProjects.map((project) => (
                          <li key={project.id}>
                            {project.name}
                            <small>{titleCase(project.stage)}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>No members assigned</small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No cohorts planned"
            detail="Create the first cohort with dates, capacity, and a selection thesis."
          />
        )}
      </section>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create program cohort"
        description="The cohort starts in planning state. Membership and project readiness remain independently auditable."
        footer={
          <>
            <Button tone="quiet" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={creating}
              disabled={!name.trim()}
              onClick={() => void createCohort()}
            >
              Create cohort
            </Button>
          </>
        }
      >
        <div className="program-form-grid">
          <TextField
            label="Cohort name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <TextField
            label="Capacity"
            type="number"
            min="1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
          <TextField
            label="Starts on"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
          />
          <TextField
            label="Ends on"
            type="date"
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
          <label className="field field--span-two">
            <span className="field__label">Cohort thesis</span>
            <textarea
              className="textarea"
              value={thesis}
              onChange={(event) => setThesis(event.target.value)}
              placeholder="Selection focus, program promise, and intended outcomes"
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
