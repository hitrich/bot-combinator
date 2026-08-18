import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  KeyRound,
  MailPlus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { Avatar, Button, Dialog, EmptyState, Field, formatDate } from '../components/Primitives';
import {
  MANAGED_ROLE_DEFINITIONS,
  isProjectAccessRole,
  roleDefinition,
  roleGroup,
  roleLabel,
} from '../lib/roles';
import type {
  InviteInput,
  ManagedPortalRole,
  PortalAccessMember,
  PortalInvitation,
  PortalProject,
  PortalRole,
  PortalWorkspace,
} from '../lib/types';
import { usePortal } from '../state/PortalContext';

type AccessTab = 'members' | 'invitations';

function scopeLabel(member: PortalAccessMember): string {
  if (member.projectName) return member.projectName;
  if (member.role.startsWith('bot_chain_')) return 'BOT Chain partner space';
  return 'All program projects';
}

function boundaryLabel(role: PortalRole): string {
  if (role === 'klineo_admin') {
    return 'Full workspace administration. Owner access is managed outside this view.';
  }
  return roleDefinition(role).limit;
}

function roleClass(role: PortalRole): string {
  return `access-role-chip access-role-chip--${roleGroup(role).toLowerCase().replace(' ', '-')}`;
}

function AccessRoleChip({ role }: { role: PortalRole }): React.JSX.Element {
  return (
    <span className={roleClass(role)}>
      <i aria-hidden="true" />
      {roleLabel(role)}
    </span>
  );
}

export function PeopleAccessView({ workspace }: { workspace: PortalWorkspace }): React.JSX.Element {
  const [tab, setTab] = useState<AccessTab>('members');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | PortalRole>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const selectedMember = workspace.accessMembers.find((item) => item.id === selectedMemberId);

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workspace.accessMembers.filter(
      (member) =>
        (roleFilter === 'all' || member.role === roleFilter) &&
        (!needle ||
          `${member.fullName} ${member.email} ${member.projectName ?? ''} ${roleLabel(member.role)}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [query, roleFilter, workspace.accessMembers]);

  const filteredInvitations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return workspace.pendingInvitations.filter(
      (invitation) =>
        (roleFilter === 'all' || invitation.role === roleFilter) &&
        (!needle ||
          `${invitation.fullName} ${invitation.email} ${invitation.projectName ?? ''} ${roleLabel(invitation.role)}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [query, roleFilter, workspace.pendingInvitations]);

  const programStaff = workspace.accessMembers.filter((member) =>
    member.role.startsWith('klineo_'),
  ).length;
  const projectStaff = workspace.accessMembers.filter((member) =>
    isProjectAccessRole(member.role),
  ).length;
  const partnerStaff = workspace.accessMembers.filter((member) =>
    member.role.startsWith('bot_chain_'),
  ).length;

  return (
    <div className="view-enter stack stack--section people-access-view">
      <header className="view-header people-access-header">
        <div>
          <span className="eyebrow">Program administration</span>
          <h1>People &amp; access</h1>
          <p>
            Assign one clear role per access scope. Project work stays private until an explicit
            sharing decision changes it.
          </p>
        </div>
        <div className="view-header-actions">
          <Button icon={<BookOpen aria-hidden="true" />} onClick={() => setGuideOpen(true)}>
            Role guide
          </Button>
          <Button
            tone="primary"
            icon={<UserPlus aria-hidden="true" />}
            onClick={() => setInviteOpen(true)}
          >
            Invite person
          </Button>
        </div>
      </header>

      <section className="access-metric-rail" aria-label="Access overview">
        <article>
          <span className="access-metric-icon">
            <UsersRound aria-hidden="true" />
          </span>
          <div>
            <strong>{workspace.accessMembers.length}</strong>
            <small>Active people</small>
          </div>
        </article>
        <article>
          <span>K</span>
          <div>
            <strong>{programStaff}</strong>
            <small>Klineo staff</small>
          </div>
        </article>
        <article>
          <span>P</span>
          <div>
            <strong>{projectStaff}</strong>
            <small>Project staff</small>
          </div>
        </article>
        <article>
          <span>B</span>
          <div>
            <strong>{partnerStaff}</strong>
            <small>BOT Chain access</small>
          </div>
        </article>
        <div className="access-metric-note">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Least privilege is on</strong>
            <small>Every role change is recorded in audit history.</small>
          </span>
        </div>
      </section>

      <section className="access-directory">
        <div className="access-directory__heading">
          <div className="access-tabs" role="tablist" aria-label="Access directory">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'members'}
              className={tab === 'members' ? 'is-active' : undefined}
              onClick={() => setTab('members')}
            >
              Active access <i>{workspace.accessMembers.length}</i>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'invitations'}
              className={tab === 'invitations' ? 'is-active' : undefined}
              onClick={() => setTab('invitations')}
            >
              Pending invites <i>{workspace.pendingInvitations.length}</i>
            </button>
          </div>
          <span>Changes take effect immediately</span>
        </div>

        <div className="access-filter-bar">
          <label>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'members' ? 'Search people or projects…' : 'Search invitations…'}
              aria-label={tab === 'members' ? 'Search people' : 'Search invitations'}
            />
          </label>
          <label>
            <span>Role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as 'all' | PortalRole)}
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="klineo_admin">Workspace admin</option>
              {MANAGED_ROLE_DEFINITIONS.map((definition) => (
                <option key={definition.role} value={definition.role}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === 'members' ? (
          <MemberTable
            members={filteredMembers}
            currentUserId={workspace.user.id}
            onManage={setSelectedMemberId}
          />
        ) : (
          <InvitationTable invitations={filteredInvitations} />
        )}
      </section>

      <InviteAccessDialog
        open={inviteOpen}
        projects={workspace.projects}
        onClose={() => setInviteOpen(false)}
      />
      <RoleGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      {selectedMember ? (
        <AccessDrawer
          key={selectedMember.id}
          member={selectedMember}
          currentUserId={workspace.user.id}
          projects={workspace.projects}
          onClose={() => setSelectedMemberId(null)}
        />
      ) : null}
    </div>
  );
}

function MemberTable({
  members,
  currentUserId,
  onManage,
}: {
  members: PortalAccessMember[];
  currentUserId: string;
  onManage: (id: string) => void;
}): React.JSX.Element {
  if (!members.length) {
    return (
      <EmptyState
        title="No people match this view"
        detail="Clear the search or role filter to return to the full access directory."
      />
    );
  }
  return (
    <div className="access-table" role="table" aria-label="People with portal access">
      <div className="access-table__head" role="row">
        <span role="columnheader">Person</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Scope</span>
        <span role="columnheader">Access boundary</span>
        <span role="columnheader" aria-label="Actions" />
      </div>
      <div className="access-table__body" role="rowgroup">
        {members.map((member, index) => (
          <div
            className="access-table__row"
            role="row"
            key={`${member.accessType}-${member.id}`}
            style={{ '--row-index': index } as React.CSSProperties}
          >
            <div className="access-person" role="cell">
              <Avatar name={member.fullName} />
              <span>
                <strong>
                  {member.fullName || member.email}
                  {member.userId === currentUserId ? <i>You</i> : null}
                </strong>
                <small>{member.email}</small>
              </span>
            </div>
            <div role="cell">
              <AccessRoleChip role={member.role} />
            </div>
            <div className="access-scope" role="cell">
              <strong>{scopeLabel(member)}</strong>
              <small>{member.projectName ? 'Project only' : member.organizationName}</small>
            </div>
            <p role="cell">{boundaryLabel(member.role)}</p>
            <div className="access-row-action" role="cell">
              <button
                type="button"
                onClick={() => onManage(member.id)}
                aria-label={`Manage access for ${member.fullName || member.email}`}
              >
                <span>{member.role === 'klineo_admin' ? 'View' : 'Manage'}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitationTable({ invitations }: { invitations: PortalInvitation[] }): React.JSX.Element {
  const { inviteMember, cancelPortalInvitation } = usePortal();
  const [busyId, setBusyId] = useState<string | null>(null);

  const resend = async (invitation: PortalInvitation): Promise<void> => {
    setBusyId(invitation.id);
    try {
      await inviteMember({
        email: invitation.email,
        fullName: invitation.fullName,
        projectId: invitation.projectId,
        role: invitation.role,
      });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (invitationId: string): Promise<void> => {
    setBusyId(invitationId);
    try {
      await cancelPortalInvitation(invitationId);
    } finally {
      setBusyId(null);
    }
  };

  if (!invitations.length) {
    return (
      <EmptyState
        title="No pending invitations"
        detail="Everyone invited to this view has accepted, expired, or had their invitation cancelled."
      />
    );
  }

  return (
    <div
      className="access-table access-table--invites"
      role="table"
      aria-label="Pending invitations"
    >
      <div className="access-table__head" role="row">
        <span role="columnheader">Invitee</span>
        <span role="columnheader">Role</span>
        <span role="columnheader">Scope</span>
        <span role="columnheader">Expires</span>
        <span role="columnheader">Actions</span>
      </div>
      <div className="access-table__body" role="rowgroup">
        {invitations.map((invitation, index) => (
          <div
            className="access-table__row"
            role="row"
            key={invitation.id}
            style={{ '--row-index': index } as React.CSSProperties}
          >
            <div className="access-person" role="cell">
              <Avatar name={invitation.fullName || invitation.email} />
              <span>
                <strong>{invitation.fullName || 'Name not supplied'}</strong>
                <small>{invitation.email}</small>
              </span>
            </div>
            <div role="cell">
              <AccessRoleChip role={invitation.role} />
            </div>
            <div className="access-scope" role="cell">
              <strong>{invitation.projectName ?? invitation.organizationName}</strong>
              <small>Invited by {invitation.invitedByName}</small>
            </div>
            <div className="access-expiry" role="cell">
              <Clock3 aria-hidden="true" />
              <span>
                <strong>{formatDate(invitation.expiresAt)}</strong>
                <small>7-day invitation window</small>
              </span>
            </div>
            <div className="invitation-actions" role="cell">
              <Button
                size="small"
                disabled={busyId === invitation.id}
                onClick={() => void resend(invitation).catch(() => undefined)}
              >
                Resend
              </Button>
              <Button
                size="small"
                tone="quiet"
                disabled={busyId === invitation.id}
                onClick={() => void cancel(invitation.id).catch(() => undefined)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteAccessDialog({
  open,
  projects,
  onClose,
}: {
  open: boolean;
  projects: PortalProject[];
  onClose: () => void;
}): React.JSX.Element | null {
  const { inviteMember } = usePortal();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ManagedPortalRole>('project_member');
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const definition = roleDefinition(role);
  const projectRole = isProjectAccessRole(role);
  const valid = Boolean(
    fullName.trim() && /^\S+@\S+\.\S+$/.test(email.trim()) && (!projectRole || projectId),
  );

  const submit = async (): Promise<void> => {
    if (!valid) return;
    setBusy(true);
    const input: InviteInput = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      projectId: projectRole ? projectId : null,
    };
    try {
      await inviteMember(input);
      setFullName('');
      setEmail('');
      setRole('project_member');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Invite a person"
      description="Choose the narrowest role and scope they need. The invitation expires after seven days."
      footer={
        <>
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            icon={<MailPlus aria-hidden="true" />}
            disabled={!valid || busy}
            onClick={() => void submit().catch(() => undefined)}
          >
            {busy ? 'Sending…' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <div className="access-invite-form">
        <div className="form-grid">
          <Field label="Full name">
            <input
              className="input"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="e.g. Jordan Lee"
            />
          </Field>
          <Field label="Work email">
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jordan@company.com"
            />
          </Field>
          <Field label="Role">
            <select
              className="select"
              value={role}
              onChange={(event) => setRole(event.target.value as ManagedPortalRole)}
            >
              {(['Project', 'Klineo', 'BOT Chain'] as const).map((group) => (
                <optgroup key={group} label={group}>
                  {MANAGED_ROLE_DEFINITIONS.filter((item) => item.group === group).map((item) => (
                    <option key={item.role} value={item.role}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          {projectRole ? (
            <Field label="Project">
              <select
                className="select"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="access-invite-scope">
              <KeyRound aria-hidden="true" />
              <span>
                <strong>{definition.scope}</strong>
                <small>No project assignment required</small>
              </span>
            </div>
          )}
        </div>
        <aside className="access-role-preview">
          <span className="access-role-preview__icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <small>{definition.group} access</small>
          <h3>{definition.label}</h3>
          <p>{definition.useFor}</p>
          <div>
            <strong>Access boundary</strong>
            <span>{definition.limit}</span>
          </div>
        </aside>
      </div>
    </Dialog>
  );
}

function AccessDrawer({
  member,
  currentUserId,
  projects,
  onClose,
}: {
  member: PortalAccessMember;
  currentUserId: string;
  projects: PortalProject[];
  onClose: () => void;
}): React.JSX.Element {
  const { updatePortalAccess, removePortalAccess } = usePortal();
  const isAdmin = member.role === 'klineo_admin';
  const isSelf = member.userId === currentUserId;
  const [role, setRole] = useState<ManagedPortalRole>(
    member.role === 'klineo_admin' ? 'klineo_operator' : member.role,
  );
  const [projectId, setProjectId] = useState(member.projectId ?? projects[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const projectRole = isProjectAccessRole(role);
  const definition = roleDefinition(role);
  const canSave = !isAdmin && !isSelf && (!projectRole || projectId);

  const save = async (): Promise<void> => {
    if (!canSave) return;
    setBusy(true);
    try {
      await updatePortalAccess({
        accessId: member.id,
        accessType: member.accessType,
        role,
        projectId: projectRole ? projectId : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!confirmRemove || isAdmin || isSelf) {
      setConfirmRemove(true);
      return;
    }
    setBusy(true);
    try {
      await removePortalAccess(member.id, member.accessType);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const focusFrame = window.requestAnimationFrame(() => drawerRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="access-drawer-backdrop" role="presentation" onPointerDown={onClose}>
      <aside
        ref={drawerRef}
        className="access-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-drawer-title"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="section-kicker">Access details</span>
            <h2 id="access-drawer-title">Manage access</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close access panel">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="access-drawer__body">
          <section className="access-drawer-person">
            <Avatar name={member.fullName || member.email} />
            <div>
              <strong>{member.fullName || member.email}</strong>
              <span>{member.email}</span>
            </div>
            <AccessRoleChip role={member.role} />
          </section>

          {isAdmin || isSelf ? (
            <div className="access-locked-note">
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>{isAdmin ? 'Workspace owner access' : 'Your current access'}</strong>
                <p>
                  {isAdmin
                    ? 'The admin role cannot be changed or removed from this directory.'
                    : 'Ask another Klineo operator to change your role so the workspace never loses its active operator.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <fieldset className="access-role-picker">
                <legend>Role</legend>
                {(['Project', 'Klineo', 'BOT Chain'] as const).map((group) => (
                  <div key={group} className="access-role-picker__group">
                    <small>{group}</small>
                    {MANAGED_ROLE_DEFINITIONS.filter((item) => item.group === group).map((item) => (
                      <label
                        key={item.role}
                        className={role === item.role ? 'is-selected' : undefined}
                      >
                        <input
                          type="radio"
                          name="access-role"
                          value={item.role}
                          checked={role === item.role}
                          onChange={() => setRole(item.role)}
                        />
                        <span className="access-role-picker__check">
                          {role === item.role ? <Check aria-hidden="true" /> : null}
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.useFor}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </fieldset>

              {projectRole ? (
                <Field label="Project scope" hint="Required">
                  <select
                    className="select"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <div className="access-boundary-preview">
                <KeyRound aria-hidden="true" />
                <div>
                  <small>{definition.scope}</small>
                  <strong>{definition.limit}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        <footer>
          {!isAdmin && !isSelf ? (
            <Button
              tone="danger"
              icon={<Trash2 aria-hidden="true" />}
              disabled={busy}
              onClick={() => void remove().catch(() => undefined)}
            >
              {confirmRemove ? 'Confirm removal' : 'Remove access'}
            </Button>
          ) : (
            <span />
          )}
          <div>
            <Button tone="quiet" onClick={onClose}>
              Close
            </Button>
            {!isAdmin && !isSelf ? (
              <Button
                tone="primary"
                icon={<UserCog aria-hidden="true" />}
                disabled={!canSave || busy}
                onClick={() => void save().catch(() => undefined)}
              >
                {busy ? 'Saving…' : 'Save access'}
              </Button>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

function RoleGuideDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Role guide"
      description="Each role has one operational purpose and a deliberate ceiling. Start with the narrowest role that fits."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="role-guide-table" role="table" aria-label="Portal role guide">
        <div className="role-guide-table__head" role="row">
          <span role="columnheader">Role</span>
          <span role="columnheader">Use for</span>
          <span role="columnheader">Main limit</span>
          <span role="columnheader">Scope</span>
        </div>
        {MANAGED_ROLE_DEFINITIONS.map((definition) => (
          <div key={definition.role} className="role-guide-table__row" role="row">
            <div role="cell">
              <AccessRoleChip role={definition.role} />
            </div>
            <p role="cell">{definition.useFor}</p>
            <p role="cell">{definition.limit}</p>
            <strong role="cell">{definition.scope}</strong>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
