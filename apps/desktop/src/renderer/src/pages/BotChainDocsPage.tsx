import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckSquare2,
  Copy,
  Download,
  FileCode2,
  FolderDown,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { BotChainDocCategory, BotChainDocument } from '../../../shared/contracts';
import { Badge, Button, EmptyState, PageHeader, titleCase } from '../components/ui';
import { useNavigate } from '../lib/router';
import { useWorkspace } from '../state/WorkspaceContext';

type CategoryFilter = 'all' | BotChainDocCategory;

const CATEGORY_ORDER: CategoryFilter[] = [
  'all',
  'start_here',
  'application',
  'integration',
  'bdex',
  'bo_wallet',
  'liquidity',
  'security',
];

function docTone(document: BotChainDocument): 'success' | 'warning' | 'danger' | 'neutral' {
  if (document.status === 'approved') return 'success';
  if (document.status === 'stale' || document.status === 'superseded') return 'danger';
  if (document.importance === 'required') return 'warning';
  return 'neutral';
}

export function BotChainDocsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState<'guide' | 'selected' | 'full' | null>(null);

  const documents = useMemo(() => data?.botChainDocs.documents ?? [], [data?.botChainDocs]);

  useEffect(() => {
    if (!documents.length) return;
    setActiveDocumentId((current) =>
      current && documents.some((document) => document.id === current) ? current : documents[0]!.id,
    );
    setSelectedDocumentIds((current) =>
      current.length
        ? current.filter((id) => documents.some((document) => document.id === id))
        : documents.filter((document) => document.importance === 'required').map(({ id }) => id),
    );
  }, [documents]);

  if (!data) return <></>;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredDocuments = documents.filter(
    (document) =>
      (category === 'all' || document.category === category) &&
      (!normalizedQuery ||
        [document.title, document.description, document.category, ...document.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)),
  );
  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ?? documents[0] ?? null;
  const chosenDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));

  const toggleDocument = (id: string): void => {
    setSelectedDocumentIds((current) =>
      current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id],
    );
  };

  const exportBundle = async (mode: 'guide' | 'selected' | 'full'): Promise<void> => {
    const directory = await window.botCombinator.selectDirectory();
    if (!directory) return;
    setExporting(mode);
    try {
      const result = await command('botChain.docs.export', {
        directory,
        mode,
        documentIds: mode === 'selected' ? selectedDocumentIds : [],
      });
      notify({
        tone: 'success',
        title: 'BOT Chain integration pack exported',
        detail: `${result.documentCount} document${result.documentCount === 1 ? '' : 's'} · version ${result.bundleVersion}`,
      });
      await window.botCombinator.revealPath(result.path);
    } finally {
      setExporting(null);
    }
  };

  const sendToAgent = (): void => {
    const ids = selectedDocumentIds.length
      ? selectedDocumentIds
      : documents.filter((document) => document.importance === 'required').map(({ id }) => id);
    const params = new URLSearchParams({ mode: 'bot-chain' });
    for (const id of ids) params.append('doc', id);
    navigate(`/agent?${params.toString()}`);
  };

  const copyAgentBrief = async (): Promise<void> => {
    const list = chosenDocuments.length
      ? chosenDocuments.map((document) => `- ${document.title} (${document.id})`).join('\n')
      : '- Start with BotAgents.md and the manifest.';
    await window.botCombinator.copyText(
      `Implement or assess this repository's BOT Chain integration using only the selected versioned documentation:\n${list}\n\nDo not invent chain IDs, endpoints, contract addresses, wallet behavior, BDEX behavior, liquidity thresholds, or approval state. Report missing authoritative values as blockers and keep external actions as proposals.`,
    );
    notify({ tone: 'success', title: 'Agent brief copied' });
  };

  return (
    <div className="page page--wide bot-docs-page">
      <PageHeader
        title="BOT Chain Docs"
        description="Applicant-facing, versioned integration guidance for teams and their Codex or Claude agents. Preview material is clearly marked and never treated as an authoritative network value."
        meta={
          <Badge tone={data.botChainDocs.status === 'approved' ? 'success' : 'warning'}>
            {data.botChainDocs.status}
          </Badge>
        }
        actions={
          <>
            <Button icon={<Copy aria-hidden="true" />} onClick={() => void copyAgentBrief()}>
              Copy agent brief
            </Button>
            <Button tone="primary" icon={<Bot aria-hidden="true" />} onClick={sendToAgent}>
              Use with agent
            </Button>
          </>
        }
      />

      <section className="bot-docs-ledger" aria-label="Documentation bundle status">
        <div>
          <small>Bundle</small>
          <strong>{data.botChainDocs.version}</strong>
        </div>
        <div>
          <small>Documents</small>
          <strong>{documents.length}</strong>
        </div>
        <div>
          <small>Selected for agent</small>
          <strong>{selectedDocumentIds.length}</strong>
        </div>
        <div className="bot-docs-ledger__hash">
          <small>Verified manifest</small>
          <strong>{data.botChainDocs.manifestSha256.slice(0, 16)}…</strong>
        </div>
        <span>
          <ShieldCheck aria-hidden="true" /> Hash checked at app launch
        </span>
      </section>

      <div className="bot-docs-toolbar">
        <label className="bot-docs-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search BOT Chain documentation</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search integration, wallet, liquidity…"
          />
        </label>
        <div className="bot-docs-export-actions">
          <Button
            size="small"
            icon={<FileCode2 aria-hidden="true" />}
            loading={exporting === 'guide'}
            onClick={() => void exportBundle('guide')}
          >
            BotAgents.md
          </Button>
          <Button
            size="small"
            icon={<Download aria-hidden="true" />}
            loading={exporting === 'selected'}
            disabled={!selectedDocumentIds.length}
            onClick={() => void exportBundle('selected')}
          >
            Export selected
          </Button>
          <Button
            size="small"
            icon={<FolderDown aria-hidden="true" />}
            loading={exporting === 'full'}
            onClick={() => void exportBundle('full')}
          >
            Full pack
          </Button>
        </div>
      </div>

      <div className="bot-docs-categories" role="tablist" aria-label="Documentation category">
        {CATEGORY_ORDER.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={category === item}
            onClick={() => setCategory(item)}
          >
            {item === 'all' ? 'All docs' : titleCase(item)}
            <span>
              {item === 'all'
                ? documents.length
                : documents.filter((document) => document.category === item).length}
            </span>
          </button>
        ))}
      </div>

      <div className="bot-docs-workbench">
        <section className="bot-docs-index" aria-label="BOT Chain document index">
          <header>
            <span>{filteredDocuments.length} matching documents</span>
            <button
              type="button"
              onClick={() => {
                const visibleIds = filteredDocuments.map(({ id }) => id);
                const allVisibleSelected = visibleIds.every((id) =>
                  selectedDocumentIds.includes(id),
                );
                setSelectedDocumentIds((current) =>
                  allVisibleSelected
                    ? current.filter((id) => !visibleIds.includes(id))
                    : [...new Set([...current, ...visibleIds])],
                );
              }}
            >
              <CheckSquare2 aria-hidden="true" /> Toggle visible
            </button>
          </header>
          {filteredDocuments.length ? (
            <div className="bot-doc-list">
              {filteredDocuments.map((document) => (
                <article
                  key={document.id}
                  className={activeDocument?.id === document.id ? 'is-active' : undefined}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      onChange={() => toggleDocument(document.id)}
                      aria-label={`Select ${document.title} for agent context`}
                    />
                  </label>
                  <button type="button" onClick={() => setActiveDocumentId(document.id)}>
                    <span>
                      <strong>{document.title}</strong>
                      <small>{document.description}</small>
                    </span>
                    <span className="bot-doc-list__meta">
                      <Badge tone={docTone(document)}>{document.status}</Badge>
                      <small>{titleCase(document.category)}</small>
                      <small>{Math.max(1, Math.round(document.sizeBytes / 1024))} KB</small>
                    </span>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No documentation matches"
              detail="Try another category or a broader search phrase."
            />
          )}
        </section>

        <aside className="bot-doc-reader" aria-label="Document reader">
          {activeDocument ? (
            <>
              <header>
                <div>
                  <span>{activeDocument.path}</span>
                  <h2>{activeDocument.title}</h2>
                  <p>{activeDocument.description}</p>
                </div>
                <Badge tone={docTone(activeDocument)}>{activeDocument.status}</Badge>
              </header>
              <dl>
                <div>
                  <dt>Version</dt>
                  <dd>{activeDocument.version}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{activeDocument.sourceOwner}</dd>
                </div>
                <div>
                  <dt>Visibility</dt>
                  <dd>{titleCase(activeDocument.visibility)}</dd>
                </div>
              </dl>
              <pre>{activeDocument.content}</pre>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
