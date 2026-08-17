import { useMemo, useState } from 'react';
import { BarChart3, Download, Eye, FileCheck2, Plus, ShieldCheck } from 'lucide-react';
import type { ProgramMetricObservation } from '../../../shared/contracts';
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

const METRIC_QUALITY: ProgramMetricObservation['quality'][] = [
  'verified',
  'supported',
  'reported',
  'stale',
  'unknown',
];

function localNow(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function qualityTone(
  quality: ProgramMetricObservation['quality'],
): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (quality === 'verified') return 'success';
  if (quality === 'supported') return 'info';
  if (quality === 'reported') return 'warning';
  if (quality === 'stale') return 'danger';
  return 'neutral';
}

export function PartnerReportPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [metricOpen, setMetricOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [observedAt, setObservedAt] = useState(localNow);
  const [sourceLabel, setSourceLabel] = useState('');
  const [quality, setQuality] = useState<ProgramMetricObservation['quality']>('reported');
  const [recording, setRecording] = useState(false);
  const [exporting, setExporting] = useState(false);

  const workspace = data?.ecosystemProgram;
  const latestMetrics = useMemo(() => {
    const seen = new Set<string>();
    return (workspace?.metrics ?? []).filter((metric) => {
      const scope = `${metric.projectId ?? 'program'}:${metric.key}`;
      if (seen.has(scope)) return false;
      seen.add(scope);
      return true;
    });
  }, [workspace?.metrics]);

  if (!data || !workspace) return <></>;

  const projectNames = new Map(workspace.projects.map((project) => [project.id, project.name]));
  const stageCounts = Object.entries(
    workspace.projects.reduce<Record<string, number>>((counts, project) => {
      counts[project.stage] = (counts[project.stage] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort((left, right) => right[1] - left[1]);

  const recordMetric = async (): Promise<void> => {
    const numericValue = Number(value);
    const date = new Date(observedAt);
    if (!key.trim() || !unit.trim() || !sourceLabel.trim() || !Number.isFinite(numericValue))
      return;
    if (Number.isNaN(date.valueOf())) return;
    setRecording(true);
    try {
      await command('program.metric.record', {
        projectId: projectId || null,
        key: key.trim(),
        value: numericValue,
        unit: unit.trim(),
        observedAt: date.toISOString(),
        sourceLabel: sourceLabel.trim(),
        quality,
      });
      setMetricOpen(false);
      setKey('');
      setValue('');
      setUnit('');
      setSourceLabel('');
      setQuality('reported');
      setObservedAt(localNow());
      notify({ tone: 'success', title: 'Program metric recorded' });
    } finally {
      setRecording(false);
    }
  };

  const exportReport = async (): Promise<void> => {
    const directory = await window.botCombinator.selectDirectory();
    if (!directory) return;
    setExporting(true);
    try {
      const result = await command('program.partnerReport.export', { directory });
      notify({
        tone: 'success',
        title: 'Controlled partner report exported',
        detail: 'Private contacts, notes, raw evidence, and agent context were excluded.',
      });
      await window.botCombinator.revealPath(result.path);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page program-page partner-report-page">
      <PageHeader
        title="BOT Chain partner view"
        description="A controlled, exportable program readout for BOT Chain. It exposes readiness state and evidence quality without exposing applicant contacts, private notes, raw gate evidence, or agent context."
        meta={<Badge tone="success">Controlled v1</Badge>}
        actions={
          <>
            <Button icon={<Plus aria-hidden="true" />} onClick={() => setMetricOpen(true)}>
              Record metric
            </Button>
            <Button
              tone="primary"
              icon={<Download aria-hidden="true" />}
              loading={exporting}
              onClick={() => void exportReport()}
            >
              Export report
            </Button>
          </>
        }
      />

      <section className="partner-boundary" aria-label="Partner disclosure boundary">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>Export boundary is enforced in the application service.</strong>
          <p>
            The generated Markdown report contains aggregate program counts, project names and
            stages, cohort status, gate/milestone totals, and latest metric quality. It omits
            private applicant and Klineo working data.
          </p>
        </div>
        <Badge tone="neutral">Founder export only</Badge>
      </section>

      <section
        className="program-summary-strip program-summary-strip--partner"
        aria-label="Partner report preview totals"
      >
        <div>
          <small>Projects tracked</small>
          <strong>{workspace.summary.totalProjects}</strong>
        </div>
        <div>
          <small>Integration ready+</small>
          <strong>{workspace.summary.integrationReady}</strong>
        </div>
        <div>
          <small>Liquidity ready+</small>
          <strong>{workspace.summary.liquidityReady}</strong>
        </div>
        <div>
          <small>Live / graduated</small>
          <strong>{workspace.summary.liveMarkets + workspace.summary.graduated}</strong>
        </div>
        <div className={workspace.summary.overdueMilestones ? 'has-alert' : undefined}>
          <small>Overdue milestones</small>
          <strong>{workspace.summary.overdueMilestones}</strong>
        </div>
      </section>

      <div className="partner-report-grid">
        <section className="partner-report-section">
          <header>
            <div>
              <Eye aria-hidden="true" />
              <span>
                <h2>Project readiness preview</h2>
                <p>Exactly the project-level shape used in the export.</p>
              </span>
            </div>
            <span>{workspace.projects.length} rows</span>
          </header>
          {workspace.projects.length ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Stage</th>
                    <th>Cohort</th>
                    <th>Gates</th>
                    <th>Milestones</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <span className="data-table__primary">{project.name}</span>
                      </td>
                      <td>
                        <Badge
                          tone={
                            ['live_market', 'graduated'].includes(project.stage)
                              ? 'success'
                              : 'neutral'
                          }
                        >
                          {titleCase(project.stage)}
                        </Badge>
                      </td>
                      <td>{project.cohortName ?? '—'}</td>
                      <td>
                        {
                          project.gates.filter((gate) => ['passed', 'waived'].includes(gate.status))
                            .length
                        }
                        /{workspace.gateDefinitions.length}
                      </td>
                      <td>
                        {
                          project.milestones.filter((milestone) => milestone.status === 'completed')
                            .length
                        }
                        /{project.milestones.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No projects to report"
              detail="Program projects will appear here without their private contact or evidence fields."
            />
          )}
        </section>

        <aside className="partner-stage-ledger">
          <header>
            <BarChart3 aria-hidden="true" />
            <span>
              <h2>Stage distribution</h2>
              <p>Current program position</p>
            </span>
          </header>
          {stageCounts.length ? (
            <ul>
              {stageCounts.map(([stage, count]) => (
                <li key={stage}>
                  <span>{titleCase(stage)}</span>
                  <span className="partner-stage-bar">
                    <i
                      style={{
                        width: `${Math.max(6, (count / Math.max(workspace.projects.length, 1)) * 100)}%`,
                      }}
                    />
                  </span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No stage data yet.</p>
          )}
        </aside>
      </div>

      <section className="partner-report-section partner-metrics">
        <header>
          <div>
            <FileCheck2 aria-hidden="true" />
            <span>
              <h2>Latest metric observations</h2>
              <p>
                One latest value per project/metric scope, with its evidence-quality label retained.
              </p>
            </span>
          </div>
          <span>{latestMetrics.length} observations</span>
        </header>
        {latestMetrics.length ? (
          <div className="partner-metric-list">
            {latestMetrics.map((metric) => (
              <article key={metric.id}>
                <span>
                  <small>
                    {metric.projectId
                      ? (projectNames.get(metric.projectId) ?? 'Unknown project')
                      : 'Program'}
                  </small>
                  <strong>{titleCase(metric.key)}</strong>
                </span>
                <span className="partner-metric-value">
                  {metric.value.toLocaleString()} <small>{metric.unit}</small>
                </span>
                <span>
                  <small>{formatDate(metric.observedAt, true)}</small>
                  <Badge tone={qualityTone(metric.quality)}>{metric.quality}</Badge>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No market-health metrics recorded"
            detail="Record adoption, transaction, liquidity, retention, or launch metrics with a source and quality label."
          />
        )}
      </section>

      <Dialog
        open={metricOpen}
        onClose={() => setMetricOpen(false)}
        title="Record program metric"
        description="Store the observed value, its scope, source label, and evidence quality. The partner export reports the quality label verbatim."
        footer={
          <>
            <Button tone="quiet" onClick={() => setMetricOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={recording}
              disabled={!key.trim() || !value || !unit.trim() || !sourceLabel.trim()}
              onClick={() => void recordMetric()}
            >
              Record observation
            </Button>
          </>
        }
      >
        <div className="program-form-grid">
          <label className="field field--span-two">
            <span className="field__label">Scope</span>
            <select
              className="select"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Whole program</option>
              {workspace.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Metric key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="active_users"
            autoFocus
          />
          <TextField
            label="Value"
            type="number"
            step="any"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <TextField
            label="Unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="users, USD, %, days"
          />
          <TextField
            label="Observed at"
            type="datetime-local"
            value={observedAt}
            onChange={(event) => setObservedAt(event.target.value)}
          />
          <label className="field">
            <span className="field__label">Evidence quality</span>
            <select
              className="select"
              value={quality}
              onChange={(event) =>
                setQuality(event.target.value as ProgramMetricObservation['quality'])
              }
            >
              {METRIC_QUALITY.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Source label"
            value={sourceLabel}
            onChange={(event) => setSourceLabel(event.target.value)}
            placeholder="Dashboard export, project report, chain indexer…"
          />
        </div>
      </Dialog>
    </div>
  );
}
