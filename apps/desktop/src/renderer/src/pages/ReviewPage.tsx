import { Check, Download, ExternalLink, GitPullRequest, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  formatDate,
  PageHeader,
  Section,
  titleCase,
} from '../components/ui';
import { isSecureExternalUrl } from '../lib/external-links';
import { useWorkspace } from '../state/WorkspaceContext';

export function ReviewPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  if (!data) return <></>;
  const pending = data.sourceReview.filter((item) => item.status === 'pending');

  const decide = async (id: string, decision: 'accept' | 'reject'): Promise<void> => {
    setReviewingId(id);
    try {
      await command('source.review', { id, decision });
      notify({
        tone: 'success',
        title: decision === 'accept' ? 'Assertion accepted' : 'Assertion rejected',
      });
    } finally {
      setReviewingId(null);
    }
  };

  const exportContribution = async (): Promise<void> => {
    setExporting(true);
    try {
      const directory = await window.botCombinator.selectDirectory();
      if (!directory) return;
      const result = await command('contribution.export', { directory });
      notify({
        tone: 'success',
        title: 'Privacy-safe contribution exported',
        detail: result.databasePath,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Sources & review"
        description="Resolve conflicting claims, inspect provenance, and publish only allowlisted public research."
        actions={
          <Button
            icon={<Download aria-hidden="true" />}
            loading={exporting}
            onClick={() => void exportContribution()}
          >
            Export contribution
          </Button>
        }
      />

      <div className="review-status">
        <ShieldCheck aria-hidden="true" />
        <div>
          <strong>{pending.length} assertions need review</strong>
          <p>
            Private outreach, activity, notes, meetings, approvals, and suppression reasons are
            never included in a public contribution.
          </p>
        </div>
        <Badge tone={pending.length ? 'warning' : 'success'}>
          {pending.length ? 'Review needed' : 'Clean'}
        </Badge>
      </div>

      <Section
        title="Assertion queue"
        description="Accepting an assertion selects it as the current fact without deleting its history."
      >
        {pending.length ? (
          <div className="review-list">
            {pending.map((item) => (
              <article key={item.id}>
                <div className="review-list__entity">
                  <strong>{item.entityName}</strong>
                  <span>{item.field}</span>
                </div>
                <div className="review-list__diff">
                  <div>
                    <span>Current</span>
                    <p>{item.currentValue ?? 'Unknown'}</p>
                  </div>
                  <div>
                    <span>Proposed</span>
                    <p>{item.proposedValue}</p>
                  </div>
                </div>
                <div className="review-list__source">
                  <strong>{item.source.title}</strong>
                  <span>
                    {item.source.publisher} · {formatDate(item.source.observedAt)}
                  </span>
                  <div>
                    <Badge tone={item.source.confidence === 'verified' ? 'success' : 'info'}>
                      {item.source.confidence}
                    </Badge>
                    <Badge>{titleCase(item.source.rights)}</Badge>
                  </div>
                </div>
                <div className="review-list__actions">
                  <Button
                    tone="quiet"
                    icon={<ExternalLink aria-hidden="true" />}
                    disabled={!isSecureExternalUrl(item.source.url)}
                    title={
                      isSecureExternalUrl(item.source.url)
                        ? undefined
                        : 'Only credential-free HTTPS sources can be opened from Bot Combinator.'
                    }
                    onClick={() => void window.botCombinator.openExternal(item.source.url)}
                  >
                    {isSecureExternalUrl(item.source.url) ? 'Open source' : 'Source unavailable'}
                  </Button>
                  <Button
                    tone="danger"
                    icon={<X aria-hidden="true" />}
                    loading={reviewingId === item.id}
                    onClick={() => void decide(item.id, 'reject')}
                  >
                    Reject
                  </Button>
                  <Button
                    tone="primary"
                    icon={<Check aria-hidden="true" />}
                    loading={reviewingId === item.id}
                    onClick={() => void decide(item.id, 'accept')}
                  >
                    Accept
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No unresolved assertions"
            detail="Current source evidence has either been selected or explicitly rejected."
          />
        )}
      </Section>

      <Section
        title="Contribution workflow"
        description="A SQLite contribution is deterministic, inspectable, and intentionally narrower than your private vault."
      >
        <ol className="contribution-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Extract</strong>
              <p>
                Copy only public investor entities, professional identities, assertions, source
                metadata, and rights classes.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Inspect</strong>
              <p>
                Review a human-readable diff and automated privacy report before anything leaves the
                device.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Validate</strong>
              <p>
                CI checks schema, provenance, rights, secrets, duplicate identities, and
                deterministic digests.
              </p>
            </div>
          </li>
          <li>
            <span>4</span>
            <div>
              <strong>Merge</strong>
              <p>
                A maintainer-reviewed pull request builds the next signed, immutable public seed.
              </p>
            </div>
          </li>
        </ol>
        <Button
          tone="primary"
          icon={<GitPullRequest aria-hidden="true" />}
          loading={exporting}
          onClick={() => void exportContribution()}
        >
          Create contribution package
        </Button>
      </Section>
    </div>
  );
}
