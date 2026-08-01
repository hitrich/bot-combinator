import { useState } from 'react';
import { BookOpen, Check, Edit3, Plus, Shield, Sparkles } from 'lucide-react';
import type { KnowledgeItem } from '../../../shared/contracts';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  formatDate,
  PageHeader,
  Section,
  TextField,
  titleCase,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

const categoryOrder: KnowledgeItem['category'][] = [
  'company',
  'round',
  'narrative',
  'metrics',
  'disclosure',
  'other',
];

export function KnowledgePage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KnowledgeItem['category']>('company');
  const [sharePolicy, setSharePolicy] = useState<KnowledgeItem['sharePolicy']>('internal');
  const [saving, setSaving] = useState(false);
  if (!data) return <></>;

  const open = (item?: KnowledgeItem): void => {
    setEditing(
      item ?? {
        id: '',
        title: '',
        content: '',
        category: 'company',
        updatedAt: '',
        sharePolicy: 'internal',
      },
    );
    setTitle(item?.title ?? '');
    setContent(item?.content ?? '');
    setCategory(item?.category ?? 'company');
    setSharePolicy(item?.sharePolicy ?? 'internal');
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await command('knowledge.save', {
        ...(editing?.id ? { id: editing.id } : {}),
        title: title.trim(),
        content: content.trim(),
        category,
        sharePolicy,
      });
      setEditing(null);
      notify({ tone: 'success', title: 'Knowledge saved', detail: title.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Knowledge"
        description="Durable company and round context with an explicit disclosure policy for every item."
        actions={
          <Button tone="primary" icon={<Plus aria-hidden="true" />} onClick={() => open()}>
            Add knowledge
          </Button>
        }
      />

      <div className="knowledge-policy">
        <Shield aria-hidden="true" />
        <div>
          <strong>Internal unless you say otherwise.</strong>
          <p>
            Agent runs receive only selected items. Outreach drafts may use only facts marked safe
            for outreach.
          </p>
        </div>
      </div>

      {categoryOrder.map((itemCategory) => {
        const items = data.knowledge.filter((item) => item.category === itemCategory);
        if (!items.length) return null;
        return (
          <Section
            key={itemCategory}
            title={titleCase(itemCategory)}
            {...(itemCategory === 'disclosure'
              ? { description: 'Rules for what may be shared at each relationship stage.' }
              : {})}
          >
            <div className="knowledge-list">
              {items.map((item) => (
                <article key={item.id}>
                  <div className="knowledge-list__icon" aria-hidden="true">
                    <BookOpen />
                  </div>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.content}</p>
                    <span>Updated {formatDate(item.updatedAt, true)}</span>
                  </div>
                  <Badge
                    tone={
                      item.sharePolicy === 'safe_for_outreach'
                        ? 'success'
                        : item.sharePolicy === 'internal'
                          ? 'warning'
                          : 'info'
                    }
                  >
                    {titleCase(item.sharePolicy)}
                  </Badge>
                  <Button
                    tone="quiet"
                    icon={<Edit3 aria-hidden="true" />}
                    onClick={() => open(item)}
                  >
                    Edit
                  </Button>
                </article>
              ))}
            </div>
          </Section>
        );
      })}
      {!data.knowledge.length ? (
        <EmptyState
          title="Build the company brief"
          detail="Add the narrative, current metrics, round strategy, and disclosure rules the founder and agents should use."
          action={
            <Button tone="primary" onClick={() => open()}>
              Add first item
            </Button>
          }
        />
      ) : null}

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit knowledge' : 'Add knowledge'}
        description="Use concise, factual language. Unknowns and estimates should be labeled."
        footer={
          <>
            <Button tone="quiet" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              icon={<Check aria-hidden="true" />}
              loading={saving}
              disabled={!title.trim() || !content.trim()}
              onClick={() => void save()}
            >
              Save item
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="field">
            <span className="field__label">Category</span>
            <select
              className="select"
              value={category}
              onChange={(event) => setCategory(event.target.value as KnowledgeItem['category'])}
            >
              {categoryOrder.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Content</span>
            <textarea
              className="textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Disclosure policy</span>
            <select
              className="select"
              value={sharePolicy}
              onChange={(event) =>
                setSharePolicy(event.target.value as KnowledgeItem['sharePolicy'])
              }
            >
              <option value="internal">Internal only</option>
              <option value="safe_for_outreach">Safe for outreach</option>
              <option value="meeting_only">Meeting only</option>
              <option value="diligence_only">Diligence only</option>
            </select>
          </label>
          <div className="field__hint">
            <Sparkles aria-hidden="true" /> This policy is enforced when assembling agent context
            and drafts.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
