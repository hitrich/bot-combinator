import { useState } from 'react';
import {
  Building2,
  CalendarPlus,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Users,
  Video,
} from 'lucide-react';
import { useNavigate } from '../lib/router';
import type { ConnectorProvider, MeetingItem } from '../../../shared/contracts';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  formatDate,
  PageHeader,
  Section,
  TextField,
} from '../components/ui';
import { useWorkspace } from '../state/WorkspaceContext';

const attendeeEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function MeetingsPage(): React.JSX.Element {
  const { data, command, notify } = useWorkspace();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MeetingItem | null>(null);
  const [title, setTitle] = useState('Investor meeting');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [provider, setProvider] = useState<ConnectorProvider | 'manual'>('manual');
  const [investorId, setInvestorId] = useState('');
  const [personIds, setPersonIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedAgenda, setSelectedAgenda] = useState('');
  const [selectedNotes, setSelectedNotes] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  if (!data) return <></>;

  const upcoming = data.meetings.filter((item) => item.status === 'upcoming');
  const completed = data.meetings.filter((item) => item.status === 'completed');
  const investorPeople = investorId
    ? data.people.filter((person) => person.firmId === investorId)
    : [];
  const startsTimestamp = Date.parse(startsAt);
  const endsTimestamp = Date.parse(endsAt);
  const dateRangeIsValid =
    Number.isFinite(startsTimestamp) &&
    Number.isFinite(endsTimestamp) &&
    endsTimestamp > startsTimestamp;
  const selectedAttendeesAreValid = personIds.every((personId) => {
    const person = data.people.find((item) => item.id === personId);
    return Boolean(person?.email && attendeeEmailPattern.test(person.email));
  });

  const openCreate = (): void => {
    setTitle('Investor meeting');
    setStartsAt('');
    setEndsAt('');
    setProvider('manual');
    setInvestorId('');
    setPersonIds([]);
    setLocation('');
    setAgenda('');
    setCreateOpen(true);
  };

  const create = async (): Promise<void> => {
    if (!title.trim() || !dateRangeIsValid || !selectedAttendeesAreValid) return;
    setCreating(true);
    try {
      await command('meeting.create', {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        provider,
        investorId: investorId || null,
        personIds,
        location: location.trim() || null,
        agenda: agenda.trim() || null,
        notes: null,
        status: 'upcoming',
      });
      setCreateOpen(false);
      notify({ tone: 'success', title: 'Meeting added', detail: title.trim() });
    } catch {
      // WorkspaceContext already presents the safely redacted command error.
    } finally {
      setCreating(false);
    }
  };

  const toggleAttendee = (personId: string): void => {
    setPersonIds((current) =>
      current.includes(personId)
        ? current.filter((candidate) => candidate !== personId)
        : [...current, personId],
    );
  };

  const openMeeting = (meeting: MeetingItem): void => {
    setSelected(meeting);
    setSelectedAgenda(meeting.agenda ?? '');
    setSelectedNotes(meeting.notes ?? '');
  };

  const saveMeeting = async (): Promise<void> => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await command('meeting.update', {
        id: selected.id,
        agenda: selectedAgenda.trim() || null,
        notes: selectedNotes.trim() || null,
      });
      setSelected(updated);
      notify({ tone: 'success', title: 'Meeting context saved' });
    } finally {
      setSaving(false);
    }
  };

  const syncCalendars = async (): Promise<void> => {
    const connected = data.connectors
      .filter((connector) => connector.state === 'connected')
      .map((connector) => connector.provider);
    if (!connected.length) {
      notify({
        tone: 'info',
        title: 'Connect a calendar first',
        detail: 'Google and Microsoft setup is under Settings → Connectors.',
      });
      return;
    }
    setSyncing(true);
    try {
      for (const connectorProvider of connected)
        await command('connector.syncCalendar', { provider: connectorProvider });
      notify({
        tone: 'success',
        title: 'Calendars synced',
        detail: `Imported and refreshed events from ${connected.length} connected account${connected.length === 1 ? '' : 's'}.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  const prepare = async (meeting: MeetingItem): Promise<void> => {
    setPreparingId(meeting.id);
    try {
      await command('task.create', {
        title: `Prepare for ${meeting.title}`,
        notes: `Meeting: ${formatDate(meeting.startsAt, true)}`,
        dueAt: meeting.startsAt,
        status: 'open',
        investorId: meeting.investorId,
        personId: meeting.personIds[0] ?? null,
      });
      notify({ tone: 'success', title: 'Preparation task created', detail: meeting.title });
      navigate('/agent');
    } finally {
      setPreparingId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Meetings"
        description="Calendar-aware preparation, private notes, outcomes, and follow-up—stored in the local vault."
        actions={
          <>
            <Button
              loading={syncing}
              icon={<RefreshCw aria-hidden="true" />}
              onClick={() => void syncCalendars()}
            >
              Sync calendars
            </Button>
            <Button tone="primary" icon={<CalendarPlus aria-hidden="true" />} onClick={openCreate}>
              Add meeting
            </Button>
          </>
        }
      />

      <Section
        title="Upcoming"
        description="Open a meeting to prepare from all permitted company and relationship context."
      >
        {upcoming.length ? (
          <div className="meeting-list">
            {upcoming.map((meeting) => (
              <article key={meeting.id}>
                <div className="meeting-date">
                  <strong>{new Date(meeting.startsAt).getDate()}</strong>
                  <span>
                    {new Date(meeting.startsAt).toLocaleString('en-US', { month: 'short' })}
                  </span>
                </div>
                <div className="meeting-copy">
                  <strong>{meeting.title}</strong>
                  <span>
                    <Clock aria-hidden="true" />
                    {formatDate(meeting.startsAt, true)}–
                    {new Date(meeting.endsAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {meeting.investorId ? (
                    <span>
                      <Building2 aria-hidden="true" />
                      {data.investors.find((investor) => investor.id === meeting.investorId)
                        ?.name ?? 'Linked investor'}
                    </span>
                  ) : null}
                  {meeting.personIds.length ? (
                    <span>
                      <Users aria-hidden="true" />
                      {meeting.personIds.length} attendee
                      {meeting.personIds.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  {meeting.location ? (
                    <span>
                      <MapPin aria-hidden="true" />
                      {meeting.location}
                    </span>
                  ) : null}
                </div>
                <Badge tone={meeting.provider === 'manual' ? 'neutral' : 'info'}>
                  {meeting.provider}
                </Badge>
                <div className="meeting-actions">
                  <Button
                    icon={<Video aria-hidden="true" />}
                    loading={preparingId === meeting.id}
                    onClick={() => void prepare(meeting)}
                  >
                    Prepare brief
                  </Button>
                  <Button tone="primary" onClick={() => openMeeting(meeting)}>
                    Open meeting
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No upcoming investor meetings"
            detail="Connect a calendar or add a meeting manually. Outreachr will assemble a sourced preparation brief."
            action={
              <Button onClick={openCreate} icon={<Plus aria-hidden="true" />}>
                Add meeting
              </Button>
            }
          />
        )}
      </Section>

      <Section
        title="Completed"
        description="Capture the real outcome, open questions, diligence requests, and next action."
      >
        <div className="completed-meetings">
          {completed.map((meeting) => (
            <button key={meeting.id} onClick={() => openMeeting(meeting)}>
              <span>
                <strong>{meeting.title}</strong>
                <small>{formatDate(meeting.startsAt, true)}</small>
              </span>
              <Badge tone={meeting.notes ? 'success' : 'warning'}>
                {meeting.notes ? 'Notes captured' : 'Needs review'}
              </Badge>
            </button>
          ))}
          {!completed.length ? (
            <p className="text-muted">
              Completed meetings will remain here as part of the private round record.
            </p>
          ) : null}
        </div>
      </Section>

      <Dialog
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="Add a meeting"
        description="Link the meeting to the investor record and choose the exact people who should attend. Connected calendars send invitations when you add the meeting."
        footer={
          <>
            <Button tone="quiet" disabled={creating} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              loading={creating}
              disabled={!title.trim() || !dateRangeIsValid || !selectedAttendeesAreValid}
              onClick={() => void create()}
            >
              {provider === 'manual'
                ? 'Add meeting'
                : personIds.length
                  ? 'Create and send invitation'
                  : 'Add to connected calendar'}
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
          <TextField
            label="Starts"
            aria-label="Starts"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <TextField
            label="Ends"
            aria-label="Ends"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            {...(startsAt && endsAt && !dateRangeIsValid
              ? { error: 'End time must be after the start time.' }
              : {})}
          />
          <label className="field">
            <span className="field__label">Calendar</span>
            <select
              aria-label="Calendar"
              className="select"
              value={provider}
              onChange={(event) => setProvider(event.target.value as ConnectorProvider | 'manual')}
            >
              <option value="manual">Local only</option>
              {data.connectors
                .filter((connector) => connector.state === 'connected')
                .map((connector) => (
                  <option key={connector.provider} value={connector.provider}>
                    {connector.provider === 'google' ? 'Google Calendar' : 'Microsoft Calendar'}
                  </option>
                ))}
            </select>
            <span className="field__hint">
              {provider === 'manual'
                ? 'Local only stores this meeting in the vault without contacting anyone.'
                : personIds.length
                  ? `Creating this meeting sends ${personIds.length} provider invitation${personIds.length === 1 ? '' : 's'}.`
                  : 'Creating this meeting adds an event to the connected calendar without external attendees.'}
            </span>
          </label>
          <label className="field">
            <span className="field__label">Investor</span>
            <select
              aria-label="Investor"
              className="select"
              value={investorId}
              onChange={(event) => {
                setInvestorId(event.target.value);
                setPersonIds([]);
              }}
            >
              <option value="">No linked investor</option>
              {data.investors.map((investor) => (
                <option key={investor.id} value={investor.id}>
                  {investor.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field meeting-attendees">
            <legend className="field__label">Attendees</legend>
            {!investorId ? (
              <span className="field__hint">Choose an investor to see its people.</span>
            ) : investorPeople.length ? (
              <div className="meeting-attendees__options">
                {investorPeople.map((person) => {
                  const hasValidEmail = Boolean(
                    person.email && attendeeEmailPattern.test(person.email),
                  );
                  return (
                    <label className="check-row" key={person.id}>
                      <input
                        type="checkbox"
                        checked={personIds.includes(person.id)}
                        disabled={!hasValidEmail}
                        onChange={() => toggleAttendee(person.id)}
                      />
                      <span>
                        <strong>{person.name}</strong>
                        <small>
                          {hasValidEmail
                            ? `${person.title ?? 'Investor'} · ${person.email}`
                            : 'Add a valid email on the investor record before inviting.'}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <span className="field__hint">No people are linked to this investor yet.</span>
            )}
          </fieldset>
          <TextField
            label="Location or meeting URL"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
          <label className="field">
            <span className="field__label">Agenda</span>
            <textarea
              className="textarea"
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
            />
          </label>
        </div>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!saving && !preparingId) setSelected(null);
        }}
        title={selected?.title ?? 'Meeting'}
        {...(selected
          ? { description: `${formatDate(selected.startsAt, true)} · ${selected.provider}` }
          : {})}
        footer={
          <>
            <Button
              tone="quiet"
              disabled={saving || Boolean(preparingId)}
              onClick={() => setSelected(null)}
            >
              Close
            </Button>
            {selected ? (
              <Button
                icon={<Save aria-hidden="true" />}
                loading={saving}
                disabled={Boolean(preparingId)}
                onClick={() => void saveMeeting()}
              >
                Save context
              </Button>
            ) : null}
            {selected?.status === 'upcoming' ? (
              <Button
                tone="primary"
                loading={preparingId === selected.id}
                disabled={saving}
                onClick={() => void prepare(selected)}
              >
                Prepare with agent
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <>
            <dl className="settings-facts">
              <div>
                <dt>Starts</dt>
                <dd>{formatDate(selected.startsAt, true)}</dd>
              </div>
              <div>
                <dt>Ends</dt>
                <dd>{formatDate(selected.endsAt, true)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{selected.location ?? 'Not specified'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
              <div>
                <dt>Investor</dt>
                <dd>
                  {selected.investorId
                    ? (data.investors.find((investor) => investor.id === selected.investorId)
                        ?.name ?? 'Linked investor')
                    : 'Not linked'}
                </dd>
              </div>
              <div>
                <dt>Attendees</dt>
                <dd>
                  {selected.personIds.length
                    ? selected.personIds
                        .map(
                          (personId) =>
                            data.people.find((person) => person.id === personId)?.name ??
                            'Unknown person',
                        )
                        .join(', ')
                    : 'None selected'}
                </dd>
              </div>
            </dl>
            <div className="form-stack">
              <label className="field">
                <span className="field__label">Agenda</span>
                <textarea
                  className="textarea"
                  value={selectedAgenda}
                  onChange={(event) => setSelectedAgenda(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Private notes and outcome</span>
                <textarea
                  className="textarea"
                  value={selectedNotes}
                  onChange={(event) => setSelectedNotes(event.target.value)}
                />
              </label>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
