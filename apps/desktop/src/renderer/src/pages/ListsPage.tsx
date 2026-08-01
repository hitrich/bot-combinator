import { ArrowRight, ListFilter, Pencil, Plus, RefreshCw, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from '../lib/router';
import type { ListItem } from '../../../shared/contracts';
import { recommendedMemberFirmIds, type RecommendedListKind } from '../lib/investor-lists';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  SearchField,
  Section,
  TextField,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

interface RecommendedList {
  kind: RecommendedListKind;
  name: string;
  description: string;
  icon: typeof ListFilter;
}

const RECOMMENDED_LISTS: RecommendedList[] = [
  {
    kind: 'high_fit',
    name: 'High-fit working set',
    description: 'Up to 50 firms with a current fit score of 70 or higher.',
    icon: ListFilter,
  },
  {
    kind: 'check_size_review',
    name: 'Check-size review',
    description: 'Firms with missing, stale, or unsupported check-size evidence.',
    icon: RefreshCw,
  },
  {
    kind: 'nyc_seed',
    name: 'NYC seed candidates',
    description: 'Seed-stage firms with New York location evidence.',
    icon: Users,
  },
];

export function ListsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberFirmIds, setMemberFirmIds] = useState<Set<string>>(new Set());
  const [memberQuery, setMemberQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const visibleInvestors = useMemo(() => {
    const normalized = memberQuery.trim().toLowerCase();
    return (data?.investors ?? [])
      .filter((investor) => {
        if (!normalized) return true;
        return [
          investor.name,
          investor.headquarters,
          ...investor.sectors,
          ...investor.stages,
          ...investor.geographies,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalized));
      })
      .sort((left, right) => right.fitScore - left.fitScore || left.name.localeCompare(right.name));
  }, [data?.investors, memberQuery]);

  if (!data) return <></>;

  const start = (nextName = '', nextDescription = '', nextMemberFirmIds: string[] = []): void => {
    setEditingId(null);
    setName(nextName);
    setDescription(nextDescription);
    setMemberFirmIds(new Set(nextMemberFirmIds));
    setMemberQuery('');
    setOpen(true);
  };

  const edit = (list: ListItem): void => {
    setEditingId(list.id);
    setName(list.name);
    setDescription(list.description ?? '');
    setMemberFirmIds(new Set(list.memberFirmIds));
    setMemberQuery('');
    setOpen(true);
  };

  const save = async (): Promise<void> => {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      memberFirmIds: [...memberFirmIds],
    };
    setSaving(true);
    try {
      const list = editingId
        ? await command('list.update', { id: editingId, ...payload })
        : await command('list.create', payload);
      setOpen(false);
      notify({
        tone: 'success',
        title: editingId ? 'List updated' : 'List created',
        detail: `${list.name} · ${list.count} ${list.count === 1 ? 'firm' : 'firms'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (firmId: string): void => {
    setMemberFirmIds((current) => {
      const next = new Set(current);
      if (next.has(firmId)) next.delete(firmId);
      else next.add(firmId);
      return next;
    });
  };

  const openRecommended = (template: RecommendedList): void => {
    start(
      template.name,
      template.description,
      recommendedMemberFirmIds(template.kind, data.investors),
    );
  };

  return (
    <div className="page">
      <PageHeader
        title="Lists"
        description="Founder-owned static working sets for deliberate investor research and outreach."
        actions={
          <Button tone="primary" icon={<Plus aria-hidden="true" />} onClick={() => start()}>
            New list
          </Button>
        }
      />
      <Section
        title="Saved lists"
        description="Membership changes only when you edit it; every list stays in the local vault."
      >
        {data.lists.length ? (
          <div className="list-index">
            {data.lists.map((list) => (
              <article className="list-index__row" key={list.id}>
                <button
                  className="list-index__open"
                  onClick={() => navigate(`/investors?list=${encodeURIComponent(list.id)}`)}
                  aria-label={`Open ${list.name}`}
                >
                  <span className="list-index__icon" aria-hidden="true">
                    <Users />
                  </span>
                  <span>
                    <strong>{list.name}</strong>
                    <small>{list.description ?? 'Founder-selected firms'}</small>
                  </span>
                  <Badge>Static</Badge>
                  <strong className="mono">{list.count}</strong>
                  <ArrowRight aria-hidden="true" />
                </button>
                <Button
                  size="small"
                  icon={<Pencil aria-hidden="true" />}
                  onClick={() => edit(list)}
                >
                  Edit
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No saved lists"
            detail="Create a static working set, then choose the firms it should contain."
          />
        )}
      </Section>
      <Section
        title="Recommended starting points"
        description="Each option takes a local snapshot you can review before saving; it will not change automatically."
      >
        <div className="recommended-lists">
          {RECOMMENDED_LISTS.map((template) => {
            const Icon = template.icon;
            const count = recommendedMemberFirmIds(template.kind, data.investors).length;
            return (
              <button key={template.kind} onClick={() => openRecommended(template)}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
                <span className="recommended-lists__count mono">
                  {count} {count === 1 ? 'firm' : 'firms'}
                </span>
              </button>
            );
          })}
        </div>
      </Section>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Edit list' : 'Create a list'}
        description="Choose the exact firms in this local working set."
        footer={
          <>
            <span className="dialog__footer-note mono">
              {memberFirmIds.size} {memberFirmIds.size === 1 ? 'firm' : 'firms'} selected
            </span>
            <Button tone="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={saving}
              disabled={!name.trim()}
              onClick={() => void save()}
            >
              {editingId ? 'Save changes' : 'Create list'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <TextField
            label="Name"
            value={name}
            maxLength={1_000}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
          <TextField
            label="Description"
            value={description}
            maxLength={20_000}
            onChange={(event) => setDescription(event.target.value)}
          />
          <fieldset className="list-members">
            <legend>Member firms</legend>
            <div className="list-members__toolbar">
              <SearchField
                value={memberQuery}
                onChange={setMemberQuery}
                label="Search firms to add"
              />
              <Button
                size="small"
                onClick={() =>
                  setMemberFirmIds((current) => {
                    const next = new Set(current);
                    visibleInvestors.forEach((investor) => next.add(investor.id));
                    return next;
                  })
                }
              >
                Select visible
              </Button>
              <Button size="small" tone="quiet" onClick={() => setMemberFirmIds(new Set())}>
                Clear
              </Button>
            </div>
            <div className="list-members__options">
              {visibleInvestors.map((investor) => (
                <label key={investor.id}>
                  <input
                    type="checkbox"
                    checked={memberFirmIds.has(investor.id)}
                    onChange={() => toggleMember(investor.id)}
                  />
                  <span>
                    <strong>{investor.name}</strong>
                    <small>
                      {investor.fitScore} fit · {investor.headquarters ?? 'Location unknown'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Dialog>
    </div>
  );
}
