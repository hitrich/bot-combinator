import { ArrowUpRight, Check, Circle, ShieldAlert, Star } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '../lib/router';
import type { InvestorSummary } from '../../../shared/contracts';
import { useWorkspace } from '../state/WorkspaceContext';
import { Badge, Button, formatDate, formatMoney, titleCase } from './ui';

function scoreTone(score: number): 'success' | 'accent' | 'neutral' {
  if (score >= 80) return 'success';
  if (score >= 65) return 'accent';
  return 'neutral';
}

export function InvestorTable({
  investors,
  compact = false,
}: {
  investors: InvestorSummary[];
  compact?: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();
  const { command, notify } = useWorkspace();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const toggleTarget = async (investor: InvestorSummary): Promise<void> => {
    setUpdatingId(investor.id);
    try {
      await command('investor.target', { id: investor.id, target: !investor.target });
      notify({
        tone: 'success',
        title: investor.target ? 'Removed from this round' : 'Added to this round',
        detail: investor.name,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="data-table-wrap">
      <table className="data-table investor-table">
        <thead>
          <tr>
            <th scope="col">Investor</th>
            <th scope="col">Fit</th>
            {!compact ? <th scope="col">Stage & sector</th> : null}
            <th scope="col">Initial check</th>
            {!compact ? <th scope="col">Evidence</th> : null}
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {investors.map((investor) => (
            <tr key={investor.id}>
              <td>
                <button
                  className="table-record-link"
                  onClick={() => navigate(`/investors/${investor.id}`)}
                >
                  <span className="investor-avatar" aria-hidden="true">
                    {investor.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>
                    <strong>{investor.name}</strong>
                    <small>
                      {[investor.kind, ...investor.additionalKinds].map(titleCase).join(' + ')} ·{' '}
                      {investor.headquarters ?? 'Location unknown'}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <Badge tone={scoreTone(investor.fitScore)}>{investor.fitScore} fit</Badge>
                <span className="data-table__secondary fit-reason">
                  {investor.fitReasons[0] ?? 'Needs review'}
                </span>
              </td>
              {!compact ? (
                <td>
                  <div className="tag-line">
                    {investor.stages.slice(0, 2).map((stage) => (
                      <span key={stage}>{stage}</span>
                    ))}
                  </div>
                  <span className="data-table__secondary">
                    {investor.sectors.slice(0, 3).join(' · ') || 'Broad mandate'}
                  </span>
                </td>
              ) : null}
              <td>
                <span className="data-table__numeric">
                  {formatMoney(investor.check.minimum, true)}–
                  {formatMoney(investor.check.maximum, true)}
                </span>
              </td>
              {!compact ? (
                <td>
                  <span className="evidence-count">
                    {investor.conflict !== 'none' ? (
                      <ShieldAlert aria-hidden="true" />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    {investor.sourceCount} sources
                  </span>
                  <span className="data-table__secondary">
                    Updated {formatDate(investor.updatedAt)}
                  </span>
                </td>
              ) : null}
              <td>
                {investor.pipelineStage ? (
                  <Badge tone={investor.pipelineStage === 'committed' ? 'success' : 'info'}>
                    {titleCase(investor.pipelineStage)}
                  </Badge>
                ) : (
                  <span className="state-dot-label">
                    <Circle aria-hidden="true" /> Not targeted
                  </span>
                )}
              </td>
              <td className="table-actions">
                <Button
                  tone={investor.target ? 'quiet' : 'secondary'}
                  size="small"
                  loading={updatingId === investor.id}
                  icon={
                    investor.target ? <Check aria-hidden="true" /> : <Star aria-hidden="true" />
                  }
                  onClick={() => void toggleTarget(investor)}
                  aria-label={
                    investor.target
                      ? `Remove ${investor.name} from round`
                      : `Add ${investor.name} to round`
                  }
                >
                  {investor.target ? 'Targeted' : 'Add'}
                </Button>
                <Button
                  tone="quiet"
                  size="small"
                  icon={<ArrowUpRight aria-hidden="true" />}
                  onClick={() => navigate(`/investors/${investor.id}`)}
                >
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
