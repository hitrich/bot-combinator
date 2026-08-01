import { ArrowRight, Calendar, CircleDollarSign, Edit3, Target } from 'lucide-react';
import { useNavigate } from '../lib/router';
import {
  Badge,
  Button,
  EmptyState,
  formatDate,
  formatMoney,
  PageHeader,
  Section,
  titleCase,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

const stageOrder = [
  'researching',
  'ready',
  'intro_requested',
  'contacted',
  'meeting',
  'diligence',
  'partner_meeting',
  'soft_circle',
  'committed',
] as const;

export function RoundOverviewPage(): React.JSX.Element {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  if (!data?.round)
    return (
      <div className="page">
        <PageHeader title="Round overview" />
        <EmptyState
          title="No active round"
          detail="Complete founder onboarding to define the financing round."
        />
      </div>
    );
  const round = data.round;
  const capital = round.committedAmount + round.softCircleAmount;
  const progress = Math.min(100, Math.round((capital / Math.max(round.targetAmount, 1)) * 100));

  return (
    <div className="page">
      <PageHeader
        title={`${round.companyName} ${titleCase(round.stage)} round`}
        description={round.companyOneLiner}
        meta={
          <Badge tone={round.status === 'active' ? 'success' : 'neutral'}>{round.status}</Badge>
        }
        actions={
          <Button icon={<Edit3 aria-hidden="true" />} onClick={() => navigate('/settings/round')}>
            Edit round
          </Button>
        }
      />

      <section className="capital-brief" aria-label="Capital progress">
        <div className="capital-brief__main">
          <span>Committed + soft circled</span>
          <strong>{formatMoney(capital, true)}</strong>
          <small>of {formatMoney(round.targetAmount, true)} target</small>
        </div>
        <div className="capital-brief__progress">
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Capital raised"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`${progress}% of target capital`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <div>
            <span>{progress}% covered</span>
            <span>{formatMoney(Math.max(0, round.targetAmount - capital), true)} remaining</span>
          </div>
        </div>
        <dl>
          <div>
            <dt>Committed</dt>
            <dd>{formatMoney(round.committedAmount, true)}</dd>
          </div>
          <div>
            <dt>Soft circle</dt>
            <dd>{formatMoney(round.softCircleAmount, true)}</dd>
          </div>
          <div>
            <dt>Target close</dt>
            <dd>{formatDate(round.targetCloseDate)}</dd>
          </div>
        </dl>
      </section>

      <Section
        title="Process coverage"
        description="Firm-level progress; individual partner conversations remain separate in each target."
      >
        <div className="funnel-list">
          {stageOrder.map((stage) => {
            const column = data.pipeline.find((item) => item.stage === stage);
            const count = column?.targetIds.length ?? 0;
            const width = data.counts.targeted
              ? Math.max(2, (count / data.counts.targeted) * 100)
              : 0;
            return (
              <button key={stage} onClick={() => navigate(`/pipeline?stage=${stage}`)}>
                <span>{titleCase(stage)}</span>
                <div className="funnel-bar">
                  <span style={{ width: `${width}%` }} />
                </div>
                <strong className="mono">{count}</strong>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </Section>

      <div className="round-two-column">
        <Section
          title="Round strategy"
          description="The rubric used to rank and qualify investors."
        >
          <dl className="strategy-list">
            <div>
              <dt>
                <CircleDollarSign aria-hidden="true" /> Target check
              </dt>
              <dd>
                {formatMoney(round.targetCheck.minimum, true)}–
                {formatMoney(round.targetCheck.maximum, true)}
              </dd>
            </div>
            <div>
              <dt>
                <Target aria-hidden="true" /> Sectors
              </dt>
              <dd>{round.sectors.join(', ') || 'Broad'}</dd>
            </div>
            <div>
              <dt>
                <Calendar aria-hidden="true" /> Launch
              </dt>
              <dd>{formatDate(round.launchDate)}</dd>
            </div>
            <div>
              <dt>Lead requirement</dt>
              <dd>
                {round.leadRequired ? 'Lead investor required' : 'No formal lead requirement'}
              </dd>
            </div>
            <div>
              <dt>Geography</dt>
              <dd>{round.geographies.join(', ') || 'United States'}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Narrative" description="Internal context available to approved agent runs.">
          <div className="narrative-copy">
            <p>{round.narrative || 'No round narrative has been saved yet.'}</p>
            <Button tone="quiet" onClick={() => navigate('/knowledge')}>
              Open company knowledge <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
