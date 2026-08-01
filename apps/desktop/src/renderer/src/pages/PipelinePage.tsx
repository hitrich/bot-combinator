import { useMemo, useState } from 'react';
import { ArrowUpRight, CircleDollarSign, Filter, GripVertical, Search } from 'lucide-react';
import { useNavigate } from '../lib/router';
import type { InvestorSummary, PipelineStage } from '../../../shared/contracts';
import { Badge, Button, EmptyState, formatMoney, PageHeader, titleCase } from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

function PipelineCard({
  investor,
  move,
}: {
  investor: InvestorSummary;
  move: (id: string, stage: PipelineStage) => Promise<void>;
}): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <article
      className="pipeline-card"
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/outreachr-investor', investor.id)}
    >
      <div className="pipeline-card__top">
        <GripVertical aria-hidden="true" />
        <Badge
          tone={
            investor.fitScore >= 80 ? 'success' : investor.fitScore >= 65 ? 'accent' : 'neutral'
          }
        >
          {investor.fitScore}
        </Badge>
        {investor.conflict !== 'none' ? <Badge tone="warning">Conflict</Badge> : null}
      </div>
      <button className="pipeline-card__name" onClick={() => navigate(`/investors/${investor.id}`)}>
        {investor.name}
        <ArrowUpRight aria-hidden="true" />
      </button>
      <p>{investor.fitReasons[0] ?? 'Fit explanation pending'}</p>
      <div className="pipeline-card__money">
        <CircleDollarSign aria-hidden="true" />
        <span>
          {investor.expectedCheckUsd === null ? 'Published check' : 'Expected check'} ·{' '}
          {formatMoney(
            investor.expectedCheckUsd ?? investor.check.typical ?? investor.check.minimum,
            true,
          )}
        </span>
      </div>
      <label className="pipeline-card__stage">
        <span className="sr-only">Move {investor.name}</span>
        <select
          value={investor.pipelineStage ?? 'researching'}
          onChange={(event) => void move(investor.id, event.target.value as PipelineStage)}
        >
          {(
            [
              'researching',
              'ready',
              'intro_requested',
              'contacted',
              'meeting',
              'diligence',
              'partner_meeting',
              'soft_circle',
              'committed',
              'passed',
              'not_now',
            ] as const
          ).map((stage) => (
            <option value={stage} key={stage}>
              {titleCase(stage)}
            </option>
          ))}
        </select>
      </label>
      {investor.nextAction ? (
        <div className="pipeline-card__next">
          <span>Next</span>
          {investor.nextAction}
        </div>
      ) : null}
    </article>
  );
}

export function PipelinePage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const investorById = useMemo(
    () => new Map((data?.investors ?? []).map((item) => [item.id, item])),
    [data?.investors],
  );
  if (!data) return <></>;

  const stageColumns = data.pipeline.filter(
    (column) => showClosed || !['passed', 'not_now'].includes(column.stage),
  );
  const normalized = query.trim().toLowerCase();

  const move = async (investorId: string, stage: PipelineStage): Promise<void> => {
    await command('pipeline.move', { investorId, stage });
    const investor = investorById.get(investorId);
    notify({
      tone: 'success',
      title: `Moved to ${titleCase(stage)}`,
      ...(investor ? { detail: investor.name } : {}),
    });
  };

  return (
    <div className="page page--wide pipeline-page">
      <PageHeader
        title="Pipeline"
        description="Firm-level fundraising progress. Partner conversations and communications remain person-specific."
        meta={<Badge tone="accent">{data.counts.targeted} active targets</Badge>}
        actions={
          <Button
            icon={<Filter aria-hidden="true" />}
            onClick={() => setShowClosed((value) => !value)}
          >
            {showClosed ? 'Hide closed' : 'Show closed'}
          </Button>
        }
      />

      <div className="pipeline-toolbar">
        <label>
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a target"
            aria-label="Find a target"
          />
        </label>
        <div>
          <span>Drag cards or use the stage menu.</span>
          <Badge tone="success">Autosaved locally</Badge>
        </div>
      </div>

      {data.counts.targeted ? (
        <div className="pipeline-board">
          {stageColumns.map((column) => {
            const investors = column.targetIds
              .map((id) => investorById.get(id))
              .filter((item): item is InvestorSummary => Boolean(item))
              .filter((item) => !normalized || item.name.toLowerCase().includes(normalized));
            return (
              <section
                className="pipeline-column"
                key={column.stage}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('text/outreachr-investor');
                  if (id) void move(id, column.stage);
                }}
              >
                <header>
                  <h2>{column.label}</h2>
                  <span>{investors.length}</span>
                </header>
                <div className="pipeline-column__body">
                  {investors.map((investor) => (
                    <PipelineCard key={investor.id} investor={investor} move={move} />
                  ))}
                  {!investors.length ? (
                    <div className="pipeline-column__empty">
                      {normalized ? 'No matching targets' : 'Drop a target here'}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Your pipeline is ready"
          detail="Add relevant investors from the universe, then advance them as the round progresses."
        />
      )}
    </div>
  );
}
