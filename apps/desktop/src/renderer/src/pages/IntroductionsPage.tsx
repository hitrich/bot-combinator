import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Network, Plus, Search, Send } from 'lucide-react';
import { useNavigate } from '../lib/router';
import { Badge, Button, EmptyState, PageHeader, SearchField, Section } from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

export function IntroductionsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [query, setQuery] = useState('');
  const [creatingForId, setCreatingForId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const navigate = useNavigate();

  const candidates = useMemo(() => {
    if (!data) return [];
    const normalized = query.trim().toLowerCase();
    return data.people
      .filter((person) => person.target && !person.contacted)
      .filter(
        (person) =>
          !normalized ||
          [person.name, person.firmName, ...person.sectors]
            .filter(Boolean)
            .some((item) => item?.toLowerCase().includes(normalized)),
      );
  }, [data, query]);

  if (!data) return <></>;

  const createTask = async (candidate: (typeof candidates)[number]): Promise<void> => {
    setCreatingForId(candidate.id);
    try {
      await command('task.create', {
        title: `Research a possible warm path to ${candidate.name}`,
        notes: candidate.firmName
          ? `Target firm: ${candidate.firmName}. Verify the connector and relationship outside Outreachr before requesting an introduction.`
          : 'Verify the connector and relationship outside Outreachr before requesting an introduction.',
        dueAt: null,
        status: 'open',
        investorId: candidate.firmId,
        personId: candidate.id,
      });
      notify({ tone: 'success', title: 'Introduction task created', detail: candidate.name });
    } finally {
      setCreatingForId(null);
    }
  };

  const template = `Hi [Connector] — would you be comfortable introducing me to [Investor] at [Firm]?\n\nWe’re building [one-line company description] and raising a [stage] round. I think the fit is [one sourced reason].\n\nNo pressure if the relationship is not current. I included a short forwardable note below.`;

  const copyTemplate = async (): Promise<void> => {
    setCopying(true);
    try {
      await window.outreachr.copyText(template);
      notify({ tone: 'success', title: 'Introduction template copied' });
    } finally {
      setCopying(false);
    }
  };

  const createIntroRequest = async (): Promise<void> => {
    const candidate = candidates[0];
    if (!candidate) return;
    await createTask(candidate);
    void navigate('/tasks');
  };

  return (
    <div className="page">
      <PageHeader
        title="Introductions"
        description="Create research tasks and a founder-reviewed request template without inferring private relationships."
        actions={
          <Button
            tone="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={() => navigate('/tasks')}
          >
            Review path tasks
          </Button>
        }
      />

      <div className="intro-principle">
        <Network aria-hidden="true" />
        <div>
          <strong>Outreachr does not infer or confirm warm paths.</strong>
          <p>
            Use a linked task to investigate one specific connector and relationship. Verify both
            outside the app before making a request.
          </p>
        </div>
      </div>

      <Section
        title="Targets to research"
        description="People at targeted firms who have not been contacted; this is not evidence that an introduction exists."
      >
        <div className="toolbar">
          <SearchField value={query} onChange={setQuery} label="Find a person or firm" />
          <span className="result-count">{candidates.length} candidates</span>
        </div>
        {candidates.length ? (
          <div className="intro-list">
            {candidates.map((person) => (
              <article key={person.id}>
                <span className="person-avatar" aria-hidden="true">
                  {person.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <strong>{person.name}</strong>
                  <small>
                    {person.title ?? 'Investor'} · {person.firmName ?? 'Independent'}
                  </small>
                </div>
                <div className="intro-list__signal">
                  <Badge>{person.sectors[0] ?? 'Broad'}</Badge>
                  <span>Research needed</span>
                </div>
                <Button
                  icon={<Search aria-hidden="true" />}
                  loading={creatingForId === person.id}
                  onClick={() => void createTask(person)}
                >
                  Create research task
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No unmatched targets"
            detail="All current partner targets are contacted or outside the active filters."
          />
        )}
      </Section>

      <Section
        title="Introduction packet"
        description="Give a connector enough accurate context to decide—without asking them to forward an essay."
      >
        <div className="intro-packet">
          <div className="intro-packet__preview">
            <p>Hi [Connector] — would you be comfortable introducing me to [Investor] at [Firm]?</p>
            <p>
              We’re building [one-line company description] and raising a [stage] round. I think the
              fit is [one sourced reason].
            </p>
            <p>
              No pressure if the relationship is not current. I included a short forwardable note
              below.
            </p>
          </div>
          <div className="intro-packet__rules">
            <p>
              <Check aria-hidden="true" /> Ask one specific connector about one specific investor.
            </p>
            <p>
              <Check aria-hidden="true" /> State why the fit exists and where the claim came from.
            </p>
            <p>
              <Check aria-hidden="true" /> Make it easy and socially safe to decline.
            </p>
            <div>
              <Button
                icon={<Copy aria-hidden="true" />}
                loading={copying}
                onClick={() => void copyTemplate()}
              >
                Copy template
              </Button>
              <Button
                tone="primary"
                icon={<Send aria-hidden="true" />}
                loading={Boolean(candidates[0] && creatingForId === candidates[0].id)}
                disabled={!candidates.length}
                onClick={() => void createIntroRequest()}
              >
                Create task for top candidate
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Button tone="quiet" onClick={() => navigate('/pipeline')}>
        Review introduction-request stage <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
