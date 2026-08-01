import { useMemo, useState } from 'react';
import { Calendar, Check, Circle, Plus } from 'lucide-react';
import type { TaskItem } from '../../../shared/contracts';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  formatDate,
  PageHeader,
  TextField,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

export function TasksPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const [showDone, setShowDone] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const tasks = useMemo(
    () => data?.tasks.filter((item) => showDone || item.status === 'open') ?? [],
    [data, showDone],
  );
  if (!data) return <></>;

  const update = async (task: TaskItem, status: TaskItem['status']): Promise<void> => {
    setUpdatingId(task.id);
    try {
      await command('task.update', { id: task.id, status });
      notify({
        tone: 'success',
        title: status === 'done' ? 'Task completed' : 'Task reopened',
        detail: task.title,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const create = async (): Promise<void> => {
    setCreating(true);
    try {
      await command('task.create', {
        title: title.trim(),
        notes: null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        status: 'open',
        investorId: null,
        personId: null,
      });
      setTitle('');
      setDueAt('');
      setCreateOpen(false);
      notify({ tone: 'success', title: 'Task created' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        description="Founder-owned next actions, generated deliberately from meetings, outreach, review, and the weekly round cadence."
        actions={
          <>
            <Button onClick={() => setShowDone((value) => !value)}>
              {showDone ? 'Hide completed' : 'Show completed'}
            </Button>
            <Button
              tone="primary"
              icon={<Plus aria-hidden="true" />}
              onClick={() => setCreateOpen(true)}
            >
              New task
            </Button>
          </>
        }
      />
      {tasks.length ? (
        <div className="task-list">
          {tasks.map((task) => (
            <article
              key={task.id}
              className={task.status === 'done' ? 'task-row task-row--done' : 'task-row'}
            >
              <button
                className="task-check"
                disabled={updatingId === task.id}
                aria-busy={updatingId === task.id || undefined}
                onClick={() => void update(task, task.status === 'done' ? 'open' : 'done')}
                aria-label={
                  task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`
                }
              >
                {task.status === 'done' ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Circle aria-hidden="true" />
                )}
              </button>
              <div>
                <strong>{task.title}</strong>
                {task.notes ? <p>{task.notes}</p> : null}
              </div>
              {task.dueAt ? (
                <span className="task-date">
                  <Calendar aria-hidden="true" />
                  {formatDate(task.dueAt, true)}
                </span>
              ) : (
                <span className="task-date">No due date</span>
              )}
              <Badge
                tone={
                  task.status === 'done'
                    ? 'success'
                    : task.dueAt && new Date(task.dueAt) < new Date()
                      ? 'danger'
                      : 'neutral'
                }
              >
                {task.status === 'done'
                  ? 'Done'
                  : task.dueAt && new Date(task.dueAt) < new Date()
                    ? 'Overdue'
                    : 'Open'}
              </Badge>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={showDone ? 'No tasks yet' : 'No open tasks'}
          detail="The queue is clear. Outreachr will create reviewable tasks from round activity when needed."
          action={<Button onClick={() => setCreateOpen(true)}>Add a task</Button>}
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New task"
        footer={
          <>
            <Button tone="quiet" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={creating}
              disabled={!title.trim()}
              onClick={() => void create()}
            >
              Create task
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <TextField
            label="Task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
          <TextField
            label="Due"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
}
