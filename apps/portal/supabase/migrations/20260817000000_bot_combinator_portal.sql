-- Bot Combinator hosted collaboration portal
-- Managed PostgreSQL schema, tenant isolation, immutable submissions, audit,
-- private screenshot storage, and explicit disclosure approvals.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.organization_type as enum ('klineo', 'bot_chain', 'project');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_role as enum (
    'klineo_admin',
    'klineo_operator',
    'klineo_reviewer',
    'bot_chain_reviewer',
    'bot_chain_viewer',
    'project_lead',
    'project_member'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_visibility as enum (
    'project_private',
    'project_and_klineo',
    'bot_chain',
    'public'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_stage as enum (
    'sourced', 'invited', 'applied', 'screening', 'qualified', 'cohort',
    'integration_ready', 'liquidity_ready', 'launch_scheduled',
    'live_market', 'graduated', 'on_hold', 'declined', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.readiness_state as enum ('not_started', 'in_progress', 'ready', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milestone_state as enum (
    'not_started', 'in_progress', 'blocked', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_state as enum (
    'requested', 'in_review', 'changes_requested', 'approved', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.showcase_state as enum (
    'draft', 'submitted', 'approved', 'changes_requested'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_state as enum ('requested', 'approved', 'rejected', 'revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_email_lower_idx on public.users (lower(email));

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  type public.organization_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizations(name, slug, type)
values
  ('Klineo', 'klineo', 'klineo'),
  ('BOT Chain', 'bot-chain', 'bot_chain')
on conflict (slug) do update set
  name = excluded.name,
  type = excluded.type;

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.portal_role not null,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships(user_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  tagline text not null default '' check (char_length(tagline) <= 180),
  description text not null default '' check (char_length(description) <= 8000),
  stage public.project_stage not null default 'invited',
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  target_launch_at timestamptz,
  last_update_at timestamptz,
  website_url text,
  demo_url text,
  repository_url text,
  video_url text,
  documentation_url text,
  integration_readiness public.readiness_state not null default 'not_started',
  liquidity_readiness public.readiness_state not null default 'not_started',
  launch_readiness public.readiness_state not null default 'not_started',
  accent text not null default '#d8ff62' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_org_idx on public.projects(owner_organization_id);
create index if not exists projects_stage_idx on public.projects(stage);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.portal_role not null check (role in ('project_lead', 'project_member')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members(user_id);

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'planning' check (
    status in ('planning', 'applications_open', 'active', 'completed', 'cancelled')
  ),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cohort_projects (
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(cohort_id, project_id)
);

create table if not exists public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null check (version > 0),
  title text not null check (char_length(title) between 2 and 180),
  summary text not null check (char_length(summary) between 2 and 12000),
  accomplishments jsonb not null default '[]'::jsonb check (jsonb_typeof(accomplishments) = 'array'),
  next_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(next_steps) = 'array'),
  progress_percent smallint not null check (progress_percent between 0 and 100),
  integration_readiness public.readiness_state not null default 'not_started',
  liquidity_readiness public.readiness_state not null default 'not_started',
  launch_readiness public.readiness_state not null default 'not_started',
  visibility public.portal_visibility not null default 'project_and_klineo',
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_by_name text not null,
  submitted_at timestamptz not null default now(),
  content_digest text not null,
  created_at timestamptz not null default now(),
  unique(project_id, version)
);
create index if not exists progress_updates_project_idx
  on public.progress_updates(project_id, submitted_at desc);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  category text not null default 'product' check (char_length(category) <= 80),
  status public.milestone_state not null default 'not_started',
  due_at timestamptz,
  owner_name text,
  evidence_url text,
  source_local_id text,
  visibility public.portal_visibility not null default 'project_and_klineo',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists milestones_project_due_idx on public.milestones(project_id, due_at);
create unique index if not exists milestones_project_source_unique_idx
  on public.milestones(project_id, source_local_id)
  where source_local_id is not null;

create table if not exists public.blockers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  detail text not null default '' check (char_length(detail) <= 8000),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'monitoring', 'resolved')),
  owner_name text,
  visibility public.portal_visibility not null default 'project_and_klineo',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blockers_project_status_idx on public.blockers(project_id, status);

create table if not exists public.showcase_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (
    type in ('screenshot', 'demo', 'website', 'repository', 'video', 'documentation')
  ),
  title text not null check (char_length(title) between 2 and 180),
  description text not null default '' check (char_length(description) <= 8000),
  url text,
  visibility public.portal_visibility not null default 'project_and_klineo',
  status public.showcase_state not null default 'submitted',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists showcase_items_project_idx on public.showcase_items(project_id, created_at desc);

create table if not exists public.showcase_assets (
  id uuid primary key default gen_random_uuid(),
  showcase_item_id uuid not null references public.showcase_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  width integer check (width between 1 and 12000),
  height integer check (height between 1 and 12000),
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists showcase_assets_item_idx on public.showcase_assets(showcase_item_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subject_type text not null check (
    subject_type in ('project', 'progress_update', 'milestone', 'showcase_item', 'review_request')
  ),
  subject_id uuid not null,
  body text not null check (char_length(body) between 1 and 8000),
  author_id uuid not null references public.users(id) on delete restrict,
  author_name text not null,
  author_role public.portal_role not null,
  visibility text not null default 'project_and_klineo' check (
    visibility in ('project_private', 'project_and_klineo', 'bot_chain', 'public', 'klineo_internal')
  ),
  created_at timestamptz not null default now()
);
create index if not exists comments_subject_idx on public.comments(subject_type, subject_id, created_at);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subject_type text not null check (
    subject_type in ('progress_update', 'milestone', 'showcase_item', 'gate')
  ),
  subject_id uuid not null,
  title text not null check (char_length(title) between 2 and 180),
  status public.review_state not null default 'requested',
  requested_by uuid not null references public.users(id) on delete restrict,
  requested_by_name text not null,
  requested_at timestamptz not null default now(),
  assigned_to uuid references public.users(id) on delete set null,
  assigned_to_name text,
  due_at timestamptz,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists review_requests_queue_idx on public.review_requests(status, due_at);

create table if not exists public.visibility_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subject_type text not null check (
    subject_type in ('progress_update', 'milestone', 'blocker', 'showcase_item')
  ),
  subject_id uuid not null,
  from_visibility public.portal_visibility not null,
  to_visibility public.portal_visibility not null check (to_visibility in ('bot_chain', 'public')),
  status public.approval_state not null default 'requested',
  requested_by uuid not null references public.users(id) on delete restrict,
  requested_by_name text not null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.users(id) on delete restrict,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text
);
create index if not exists visibility_approvals_queue_idx
  on public.visibility_approvals(status, requested_at);
create unique index if not exists visibility_approvals_one_pending_idx
  on public.visibility_approvals(subject_type, subject_id, to_visibility)
  where status = 'requested';

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null default '',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  role public.portal_role not null,
  invited_by uuid not null references public.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_pending_unique_idx
  on public.invitations(lower(email), organization_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where accepted_at is null;

create table if not exists public.desktop_submission_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  local_project_id text not null,
  schema_version integer not null,
  content_digest text not null,
  payload jsonb not null,
  imported_by uuid not null references public.users(id) on delete restrict,
  imported_at timestamptz not null default now(),
  unique(project_id, content_digest)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  actor_id uuid references public.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_project_time_idx
  on public.audit_events(project_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists milestones_updated_at on public.milestones;
create trigger milestones_updated_at before update on public.milestones
for each row execute function public.set_updated_at();
drop trigger if exists blockers_updated_at on public.blockers;
create trigger blockers_updated_at before update on public.blockers
for each row execute function public.set_updated_at();
drop trigger if exists showcase_items_updated_at on public.showcase_items;
create trigger showcase_items_updated_at before update on public.showcase_items
for each row execute function public.set_updated_at();
drop trigger if exists review_requests_updated_at on public.review_requests;
create trigger review_requests_updated_at before update on public.review_requests
for each row execute function public.set_updated_at();

create or replace function public.current_actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(full_name, ''), email, 'System')
  from public.users
  where id = auth.uid()
$$;

create or replace function public.is_klineo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.type = 'klineo'
      and m.role in ('klineo_admin', 'klineo_operator', 'klineo_reviewer')
  )
$$;

create or replace function public.is_klineo_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.type = 'klineo'
      and m.role in ('klineo_admin', 'klineo_operator')
  )
$$;

create or replace function public.is_bot_chain_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.type = 'bot_chain'
      and m.role in ('bot_chain_reviewer', 'bot_chain_viewer')
  )
$$;

create or replace function public.is_bot_chain_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid()
      and o.type = 'bot_chain'
      and m.role = 'bot_chain_reviewer'
  )
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = target_project_id and pm.user_id = auth.uid()
  )
$$;

create or replace function public.is_project_lead(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.project_id = target_project_id
      and pm.user_id = auth.uid()
      and pm.role = 'project_lead'
  )
$$;

create or replace function public.can_edit_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_klineo_operator()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = target_project_id
        and pm.user_id = auth.uid()
        and pm.role in ('project_lead', 'project_member')
    )
$$;

create or replace function public.can_read_visibility(
  target_project_id uuid,
  target_visibility public.portal_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case target_visibility
    when 'project_private' then public.is_project_member(target_project_id)
    when 'project_and_klineo' then public.is_project_member(target_project_id) or public.is_klineo_user()
    when 'bot_chain' then public.is_project_member(target_project_id) or public.is_klineo_user() or public.is_bot_chain_user()
    when 'public' then true
  end
$$;

create or replace function public.can_view_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_project_member(target_project_id)
    or public.is_klineo_user()
    or (
      public.is_bot_chain_user()
      and (
        exists(select 1 from public.progress_updates u where u.project_id = target_project_id and u.visibility in ('bot_chain', 'public'))
        or exists(select 1 from public.milestones m where m.project_id = target_project_id and m.visibility in ('bot_chain', 'public'))
        or exists(select 1 from public.blockers b where b.project_id = target_project_id and b.visibility in ('bot_chain', 'public'))
        or exists(select 1 from public.showcase_items s where s.project_id = target_project_id and s.visibility in ('bot_chain', 'public'))
      )
    )
    or exists(select 1 from public.progress_updates u where u.project_id = target_project_id and u.visibility = 'public')
    or exists(select 1 from public.milestones m where m.project_id = target_project_id and m.visibility = 'public')
    or exists(select 1 from public.blockers b where b.project_id = target_project_id and b.visibility = 'public')
    or exists(select 1 from public.showcase_items s where s.project_id = target_project_id and s.visibility = 'public' and s.status = 'approved')
$$;

create or replace function public.current_portal_role(target_project_id uuid default null)
returns public.portal_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select m.role from public.memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.type = 'klineo'
      order by case m.role when 'klineo_admin' then 1 when 'klineo_operator' then 2 else 3 end
      limit 1
    ),
    (
      select m.role from public.memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid() and o.type = 'bot_chain'
      order by case m.role when 'bot_chain_reviewer' then 1 else 2 end
      limit 1
    ),
    (
      select pm.role from public.project_members pm
      where pm.user_id = auth.uid() and (target_project_id is null or pm.project_id = target_project_id)
      order by case pm.role when 'project_lead' then 1 else 2 end
      limit 1
    )
  )
$$;

create or replace function public.current_organization_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select o.name
      from public.memberships m
      join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
      order by case o.type when 'klineo' then 1 when 'bot_chain' then 2 else 3 end
      limit 1
    ),
    (
      select o.name
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      join public.organizations o on o.id = p.owner_organization_id
      where pm.user_id = auth.uid()
      limit 1
    ),
    'Bot Combinator'
  )
$$;

create or replace function public.write_audit_event(
  target_project_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id text,
  target_detail text,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare event_id uuid;
begin
  insert into public.audit_events(
    project_id, actor_id, actor_name, action, entity_type, entity_id, detail, metadata
  ) values (
    target_project_id,
    auth.uid(),
    coalesce(public.current_actor_name(), 'System'),
    target_action,
    target_entity_type,
    target_entity_id,
    target_detail,
    coalesce(target_metadata, '{}'::jsonb)
  ) returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.protect_submitted_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Submitted progress updates are immutable';
  end if;
  if (to_jsonb(new) - 'visibility') <> (to_jsonb(old) - 'visibility') then
    raise exception 'Submitted progress updates are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists progress_updates_immutable on public.progress_updates;
create trigger progress_updates_immutable
before update or delete on public.progress_updates
for each row execute function public.protect_submitted_update();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare invitation_row public.invitations%rowtype;
begin
  insert into public.users(id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.users.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();

  for invitation_row in
    select * from public.invitations
    where lower(email) = lower(coalesce(new.email, ''))
      and accepted_at is null
      and expires_at > now()
  loop
    insert into public.memberships(organization_id, user_id, role)
    values (invitation_row.organization_id, new.id, invitation_row.role)
    on conflict (organization_id, user_id) do update set role = excluded.role;

    if invitation_row.project_id is not null and invitation_row.role in ('project_lead', 'project_member') then
      insert into public.project_members(project_id, user_id, role)
      values (invitation_row.project_id, new.id, invitation_row.role)
      on conflict (project_id, user_id) do update set role = excluded.role;
    end if;

    update public.invitations set accepted_at = now() where id = invitation_row.id;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

-- RLS is enabled on every exposed product table. Helper functions above are
-- security-definer to avoid recursive policy evaluation and expose no row data.
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.cohorts enable row level security;
alter table public.cohort_projects enable row level security;
alter table public.progress_updates enable row level security;
alter table public.milestones enable row level security;
alter table public.blockers enable row level security;
alter table public.showcase_items enable row level security;
alter table public.showcase_assets enable row level security;
alter table public.comments enable row level security;
alter table public.review_requests enable row level security;
alter table public.visibility_approvals enable row level security;
alter table public.invitations enable row level security;
alter table public.desktop_submission_imports enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists users_read_self_or_klineo on public.users;
create policy users_read_self_or_klineo on public.users for select to authenticated
using (id = auth.uid() or public.is_klineo_user());

drop policy if exists organizations_read_members on public.organizations;
create policy organizations_read_members on public.organizations for select to authenticated
using (
  public.is_klineo_user()
  or exists(select 1 from public.memberships m where m.organization_id = id and m.user_id = auth.uid())
  or (type = 'project' and exists(select 1 from public.projects p where p.owner_organization_id = id and public.can_view_project(p.id)))
);

drop policy if exists memberships_read_scoped on public.memberships;
create policy memberships_read_scoped on public.memberships for select to authenticated
using (user_id = auth.uid() or public.is_klineo_user());

drop policy if exists projects_read_scoped on public.projects;
create policy projects_read_scoped on public.projects for select to anon, authenticated
using (public.can_view_project(id));
drop policy if exists projects_update_scoped on public.projects;
create policy projects_update_scoped on public.projects for update to authenticated
using (public.can_edit_project(id)) with check (public.can_edit_project(id));
drop policy if exists projects_insert_klineo on public.projects;
create policy projects_insert_klineo on public.projects for insert to authenticated
with check (public.is_klineo_operator());

drop policy if exists project_members_read_scoped on public.project_members;
create policy project_members_read_scoped on public.project_members for select to authenticated
using (user_id = auth.uid() or public.is_klineo_user());

drop policy if exists cohorts_read_visible on public.cohorts;
create policy cohorts_read_visible on public.cohorts for select to authenticated
using (
  public.is_klineo_user()
  or public.is_bot_chain_user()
  or exists(
    select 1 from public.cohort_projects cp
    where cp.cohort_id = id and public.is_project_member(cp.project_id)
  )
);
drop policy if exists cohorts_manage_klineo on public.cohorts;
create policy cohorts_manage_klineo on public.cohorts for all to authenticated
using (public.is_klineo_operator()) with check (public.is_klineo_operator());

drop policy if exists cohort_projects_read_visible on public.cohort_projects;
create policy cohort_projects_read_visible on public.cohort_projects for select to authenticated
using (public.can_view_project(project_id));
drop policy if exists cohort_projects_manage_klineo on public.cohort_projects;
create policy cohort_projects_manage_klineo on public.cohort_projects for all to authenticated
using (public.is_klineo_operator()) with check (public.is_klineo_operator());

drop policy if exists progress_read_visibility on public.progress_updates;
create policy progress_read_visibility on public.progress_updates for select to anon, authenticated
using (public.can_read_visibility(project_id, visibility));

drop policy if exists milestones_read_visibility on public.milestones;
create policy milestones_read_visibility on public.milestones for select to anon, authenticated
using (public.can_read_visibility(project_id, visibility));
drop policy if exists milestones_write_scoped on public.milestones;
create policy milestones_write_scoped on public.milestones for insert to authenticated
with check (
  public.can_edit_project(project_id)
  and created_by = auth.uid()
  and visibility in ('project_private', 'project_and_klineo')
);
drop policy if exists milestones_update_scoped on public.milestones;
create policy milestones_update_scoped on public.milestones for update to authenticated
using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

drop policy if exists blockers_read_visibility on public.blockers;
create policy blockers_read_visibility on public.blockers for select to anon, authenticated
using (public.can_read_visibility(project_id, visibility));
drop policy if exists blockers_write_scoped on public.blockers;
create policy blockers_write_scoped on public.blockers for insert to authenticated
with check (
  public.can_edit_project(project_id)
  and created_by = auth.uid()
  and visibility in ('project_private', 'project_and_klineo')
);
drop policy if exists blockers_update_scoped on public.blockers;
create policy blockers_update_scoped on public.blockers for update to authenticated
using (public.can_edit_project(project_id)) with check (public.can_edit_project(project_id));

drop policy if exists showcase_read_visibility on public.showcase_items;
create policy showcase_read_visibility on public.showcase_items for select to anon, authenticated
using (
  (auth.uid() is not null and public.can_read_visibility(project_id, visibility))
  or (visibility = 'public' and status = 'approved')
);

drop policy if exists showcase_assets_read_visibility on public.showcase_assets;
create policy showcase_assets_read_visibility on public.showcase_assets for select to anon, authenticated
using (
  exists(
    select 1 from public.showcase_items s
    where s.id = showcase_item_id
      and (
        (auth.uid() is not null and public.can_read_visibility(s.project_id, s.visibility))
        or (s.visibility = 'public' and s.status = 'approved')
      )
  )
);

drop policy if exists comments_read_scoped on public.comments;
create policy comments_read_scoped on public.comments for select to anon, authenticated
using (
  case visibility
    when 'klineo_internal' then public.is_klineo_user()
    else public.can_read_visibility(project_id, visibility::public.portal_visibility)
  end
);

drop policy if exists review_requests_read_scoped on public.review_requests;
create policy review_requests_read_scoped on public.review_requests for select to authenticated
using (public.is_project_member(project_id) or public.is_klineo_user());

drop policy if exists approvals_read_scoped on public.visibility_approvals;
create policy approvals_read_scoped on public.visibility_approvals for select to authenticated
using (public.is_project_member(project_id) or public.is_klineo_user());

drop policy if exists invitations_read_scoped on public.invitations;
create policy invitations_read_scoped on public.invitations for select to authenticated
using (invited_by = auth.uid() or lower(email) = lower((select u.email from public.users u where u.id = auth.uid())) or public.is_klineo_user());

drop policy if exists desktop_imports_read_scoped on public.desktop_submission_imports;
create policy desktop_imports_read_scoped on public.desktop_submission_imports for select to authenticated
using (public.is_project_member(project_id) or public.is_klineo_user());

drop policy if exists audit_read_scoped on public.audit_events;
create policy audit_read_scoped on public.audit_events for select to authenticated
using (
  public.is_klineo_user()
  or (project_id is not null and public.is_project_member(project_id))
  or (
    project_id is not null
    and public.is_bot_chain_user()
    and action in ('progress.submitted', 'visibility.approved', 'review.acknowledged')
  )
);

create or replace function public.create_portal_project(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  project_id uuid;
  project_org_id uuid;
  target_cohort_id uuid;
  project_name text := trim(coalesce(input->>'name', ''));
  base_slug text;
  candidate_slug text;
  attempt integer := 0;
begin
  if not public.is_klineo_operator() then
    raise exception 'Only a Klineo operator can create project workspaces';
  end if;
  if char_length(project_name) not between 2 and 120 then
    raise exception 'Project name must be between 2 and 120 characters';
  end if;
  if nullif(trim(coalesce(input->>'websiteUrl', '')), '') is not null
     and trim(input->>'websiteUrl') !~* '^https?://' then
    raise exception 'Website URL must start with http:// or https://';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(project_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'project'; end if;
  base_slug := left(base_slug, 54);
  loop
    candidate_slug := base_slug || case when attempt = 0 then '' else '-' || substr(gen_random_uuid()::text, 1, 8) end;
    exit when not exists(select 1 from public.projects where slug = candidate_slug)
      and not exists(select 1 from public.organizations where slug = candidate_slug || '-team');
    attempt := attempt + 1;
  end loop;

  insert into public.organizations(name, slug, type)
  values (project_name, candidate_slug || '-team', 'project')
  returning id into project_org_id;

  insert into public.projects(
    owner_organization_id, slug, name, tagline, description,
    website_url, target_launch_at, stage
  ) values (
    project_org_id,
    candidate_slug,
    project_name,
    trim(coalesce(input->>'tagline', '')),
    trim(coalesce(input->>'description', '')),
    nullif(trim(coalesce(input->>'websiteUrl', '')), ''),
    nullif(input->>'targetLaunchAt', '')::timestamptz,
    'invited'
  ) returning id into project_id;

  if nullif(input->>'cohortId', '') is not null then
    target_cohort_id := (input->>'cohortId')::uuid;
    if not exists(select 1 from public.cohorts where id = target_cohort_id) then
      raise exception 'Cohort not found';
    end if;
    insert into public.cohort_projects(cohort_id, project_id)
    values (target_cohort_id, project_id);
  end if;

  perform public.write_audit_event(
    project_id, 'project.created', 'project', project_id::text,
    format('Created the %s project workspace.', project_name),
    jsonb_build_object('cohortId', target_cohort_id)
  );
  return project_id;
end;
$$;

create or replace function public.update_project_profile(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  url_value text;
  url_key text;
begin
  if not public.can_edit_project(target_project_id) then
    raise exception 'Not authorized to edit this project';
  end if;
  foreach url_key in array array['websiteUrl', 'demoUrl', 'repositoryUrl', 'videoUrl', 'documentationUrl']
  loop
    url_value := nullif(trim(coalesce(input->>url_key, '')), '');
    if url_value is not null and url_value !~* '^https?://' then
      raise exception '% must start with http:// or https://', url_key;
    end if;
  end loop;

  update public.projects set
    tagline = trim(coalesce(input->>'tagline', '')),
    description = trim(coalesce(input->>'description', '')),
    website_url = nullif(trim(coalesce(input->>'websiteUrl', '')), ''),
    demo_url = nullif(trim(coalesce(input->>'demoUrl', '')), ''),
    repository_url = nullif(trim(coalesce(input->>'repositoryUrl', '')), ''),
    video_url = nullif(trim(coalesce(input->>'videoUrl', '')), ''),
    documentation_url = nullif(trim(coalesce(input->>'documentationUrl', '')), ''),
    target_launch_at = nullif(input->>'targetLaunchAt', '')::timestamptz
  where id = target_project_id;
  if not found then raise exception 'Project not found'; end if;

  perform public.write_audit_event(
    target_project_id, 'project.profile_updated', 'project', target_project_id::text,
    'Updated the shared project profile.', '{}'::jsonb
  );
  return target_project_id;
end;
$$;

create or replace function public.update_project_stage(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  next_stage public.project_stage := (input->>'stage')::public.project_stage;
begin
  if not public.is_klineo_operator() then
    raise exception 'Only a Klineo operator can update project stage';
  end if;
  update public.projects set stage = next_stage where id = target_project_id;
  if not found then raise exception 'Project not found'; end if;
  perform public.write_audit_event(
    target_project_id, 'project.stage_updated', 'project', target_project_id::text,
    format('Moved project to %s.', next_stage), jsonb_build_object('stage', next_stage)
  );
  return target_project_id;
end;
$$;

create or replace function public.create_portal_milestone(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  requested_visibility public.portal_visibility := coalesce(
    nullif(input->>'visibility', '')::public.portal_visibility,
    'project_and_klineo'
  );
  milestone_id uuid;
begin
  if not public.can_edit_project(target_project_id) then raise exception 'Not authorized'; end if;
  if requested_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Partner and public visibility require a separate approval request';
  end if;
  if char_length(trim(coalesce(input->>'title', ''))) < 2 then
    raise exception 'Milestone title is required';
  end if;
  if nullif(trim(coalesce(input->>'evidenceUrl', '')), '') is not null
     and trim(input->>'evidenceUrl') !~* '^https?://' then
    raise exception 'Evidence URL must start with http:// or https://';
  end if;
  insert into public.milestones(
    project_id, title, category, due_at, owner_name, evidence_url,
    visibility, created_by
  ) values (
    target_project_id,
    trim(input->>'title'),
    coalesce(nullif(trim(input->>'category'), ''), 'Product'),
    nullif(input->>'dueAt', '')::timestamptz,
    nullif(trim(coalesce(input->>'ownerName', '')), ''),
    nullif(trim(coalesce(input->>'evidenceUrl', '')), ''),
    requested_visibility,
    auth.uid()
  ) returning id into milestone_id;
  perform public.write_audit_event(
    target_project_id, 'milestone.created', 'milestone', milestone_id::text,
    format('Added milestone “%s”.', trim(input->>'title')),
    jsonb_build_object('visibility', requested_visibility)
  );
  return milestone_id;
end;
$$;

create or replace function public.create_portal_blocker(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  requested_visibility public.portal_visibility := coalesce(
    nullif(input->>'visibility', '')::public.portal_visibility,
    'project_and_klineo'
  );
  blocker_id uuid;
begin
  if not public.can_edit_project(target_project_id) then raise exception 'Not authorized'; end if;
  if requested_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Partner and public visibility require a separate approval request';
  end if;
  if char_length(trim(coalesce(input->>'title', ''))) < 2 then
    raise exception 'Blocker title is required';
  end if;
  if coalesce(input->>'severity', 'medium') not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Unsupported blocker severity';
  end if;
  insert into public.blockers(
    project_id, title, detail, severity, owner_name, visibility, created_by
  ) values (
    target_project_id,
    trim(input->>'title'),
    trim(coalesce(input->>'detail', '')),
    coalesce(input->>'severity', 'medium'),
    nullif(trim(coalesce(input->>'ownerName', '')), ''),
    requested_visibility,
    auth.uid()
  ) returning id into blocker_id;
  perform public.write_audit_event(
    target_project_id, 'blocker.created', 'blocker', blocker_id::text,
    format('Reported blocker “%s”.', trim(input->>'title')),
    jsonb_build_object('severity', coalesce(input->>'severity', 'medium'), 'visibility', requested_visibility)
  );
  return blocker_id;
end;
$$;

create or replace function public.update_delivery_status(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_id uuid := (input->>'subjectId')::uuid;
  target_project_id uuid;
  target_subject_type text := input->>'subjectType';
  next_status text := input->>'status';
begin
  if target_subject_type = 'milestone' then
    select project_id into target_project_id from public.milestones where id = target_subject_id;
    if target_project_id is null or not public.can_edit_project(target_project_id) then raise exception 'Not authorized'; end if;
    if next_status not in ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled') then
      raise exception 'Unsupported milestone status';
    end if;
    update public.milestones set status = next_status::public.milestone_state where id = target_subject_id;
  elsif target_subject_type = 'blocker' then
    select project_id into target_project_id from public.blockers where id = target_subject_id;
    if target_project_id is null or not public.can_edit_project(target_project_id) then raise exception 'Not authorized'; end if;
    if next_status not in ('open', 'monitoring', 'resolved') then raise exception 'Unsupported blocker status'; end if;
    update public.blockers set status = next_status where id = target_subject_id;
  else
    raise exception 'Unsupported delivery item';
  end if;
  perform public.write_audit_event(
    target_project_id, target_subject_type || '.status_updated', target_subject_type,
    target_subject_id::text, format('Set status to %s.', next_status),
    jsonb_build_object('status', next_status)
  );
  return target_subject_id;
end;
$$;

create or replace function public.create_portal_cohort(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cohort_id uuid;
  starts date := nullif(input->>'startsOn', '')::date;
  ends date := nullif(input->>'endsOn', '')::date;
begin
  if not public.is_klineo_operator() then raise exception 'Only a Klineo operator can create cohorts'; end if;
  if char_length(trim(coalesce(input->>'name', ''))) < 2 then raise exception 'Cohort name is required'; end if;
  if starts is not null and ends is not null and ends < starts then
    raise exception 'Cohort end date must be on or after its start date';
  end if;
  insert into public.cohorts(name, status, starts_on, ends_on)
  values (trim(input->>'name'), 'planning', starts, ends)
  returning id into cohort_id;
  perform public.write_audit_event(
    null, 'cohort.created', 'cohort', cohort_id::text,
    format('Created cohort “%s”.', trim(input->>'name')),
    jsonb_build_object('startsOn', starts, 'endsOn', ends)
  );
  return cohort_id;
end;
$$;

create or replace function public.submit_progress_update(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  update_id uuid;
  next_version integer;
  actor_name text := coalesce(public.current_actor_name(), 'Unknown user');
  requested_visibility public.portal_visibility := coalesce(
    nullif(input->>'visibility', '')::public.portal_visibility,
    'project_and_klineo'
  );
  canonical jsonb;
  digest_text text;
begin
  if not public.can_edit_project(target_project_id) then
    raise exception 'Not authorized to submit for this project';
  end if;
  if requested_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Partner and public visibility require a separate approval request';
  end if;
  if char_length(trim(coalesce(input->>'title', ''))) < 2
     or char_length(trim(coalesce(input->>'summary', ''))) < 2 then
    raise exception 'Title and summary are required';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.progress_updates where project_id = target_project_id;

  canonical := jsonb_build_object(
    'projectId', target_project_id,
    'version', next_version,
    'title', trim(input->>'title'),
    'summary', trim(input->>'summary'),
    'accomplishments', coalesce(input->'accomplishments', '[]'::jsonb),
    'nextSteps', coalesce(input->'nextSteps', '[]'::jsonb),
    'progressPercent', greatest(0, least(100, (input->>'progressPercent')::integer)),
    'integrationReadiness', coalesce(input->>'integrationReadiness', 'not_started'),
    'liquidityReadiness', coalesce(input->>'liquidityReadiness', 'not_started'),
    'launchReadiness', coalesce(input->>'launchReadiness', 'not_started'),
    'submittedBy', auth.uid()
  );
  digest_text := 'sha256:' || encode(digest(convert_to(canonical::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.progress_updates(
    project_id, version, title, summary, accomplishments, next_steps,
    progress_percent, integration_readiness, liquidity_readiness, launch_readiness,
    visibility, submitted_by, submitted_by_name, content_digest
  ) values (
    target_project_id,
    next_version,
    trim(input->>'title'),
    trim(input->>'summary'),
    coalesce(input->'accomplishments', '[]'::jsonb),
    coalesce(input->'nextSteps', '[]'::jsonb),
    greatest(0, least(100, (input->>'progressPercent')::integer)),
    coalesce(input->>'integrationReadiness', 'not_started')::public.readiness_state,
    coalesce(input->>'liquidityReadiness', 'not_started')::public.readiness_state,
    coalesce(input->>'launchReadiness', 'not_started')::public.readiness_state,
    requested_visibility,
    auth.uid(),
    actor_name,
    digest_text
  ) returning id into update_id;

  update public.projects set
    progress_percent = greatest(0, least(100, (input->>'progressPercent')::integer)),
    integration_readiness = coalesce(input->>'integrationReadiness', 'not_started')::public.readiness_state,
    liquidity_readiness = coalesce(input->>'liquidityReadiness', 'not_started')::public.readiness_state,
    launch_readiness = coalesce(input->>'launchReadiness', 'not_started')::public.readiness_state,
    last_update_at = now()
  where id = target_project_id;

  perform public.write_audit_event(
    target_project_id, 'progress.submitted', 'progress_update', update_id::text,
    format('Submitted progress update v%s.', next_version),
    jsonb_build_object('version', next_version, 'digest', digest_text, 'visibility', requested_visibility)
  );
  return update_id;
end;
$$;

create or replace function public.create_showcase_item(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  item_id uuid;
  requested_visibility public.portal_visibility := coalesce(
    nullif(input->>'visibility', '')::public.portal_visibility,
    'project_and_klineo'
  );
begin
  if not public.can_edit_project(target_project_id) then
    raise exception 'Not authorized to create showcase items for this project';
  end if;
  if requested_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Partner and public visibility require a separate approval request';
  end if;
  insert into public.showcase_items(
    project_id, type, title, description, url, visibility, status, created_by
  ) values (
    target_project_id,
    input->>'type',
    trim(input->>'title'),
    trim(coalesce(input->>'description', '')),
    nullif(trim(coalesce(input->>'url', '')), ''),
    requested_visibility,
    'submitted',
    auth.uid()
  ) returning id into item_id;
  perform public.write_audit_event(
    target_project_id, 'showcase.submitted', 'showcase_item', item_id::text,
    format('Submitted showcase item “%s”.', trim(input->>'title')),
    jsonb_build_object('visibility', requested_visibility, 'type', input->>'type')
  );
  return item_id;
end;
$$;

create or replace function public.register_showcase_asset(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.showcase_items%rowtype;
  asset_id uuid;
begin
  select * into item from public.showcase_items where id = (input->>'showcaseItemId')::uuid;
  if item.id is null or not public.can_edit_project(item.project_id) then
    raise exception 'Not authorized to register this asset';
  end if;
  if split_part(input->>'storagePath', '/', 1) <> item.project_id::text
     or split_part(input->>'storagePath', '/', 2) <> auth.uid()::text then
    raise exception 'Invalid storage path';
  end if;
  insert into public.showcase_assets(
    showcase_item_id, project_id, storage_path, file_name, mime_type,
    size_bytes, width, height, uploaded_by
  ) values (
    item.id,
    item.project_id,
    input->>'storagePath',
    input->>'fileName',
    input->>'mimeType',
    (input->>'sizeBytes')::integer,
    nullif(input->>'width', '')::integer,
    nullif(input->>'height', '')::integer,
    auth.uid()
  ) returning id into asset_id;
  perform public.write_audit_event(
    item.project_id, 'showcase.asset_uploaded', 'showcase_asset', asset_id::text,
    'Uploaded a metadata-sanitized showcase screenshot.',
    jsonb_build_object('mimeType', input->>'mimeType', 'sizeBytes', (input->>'sizeBytes')::integer)
  );
  return asset_id;
end;
$$;

create or replace function public.add_portal_comment(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  target_visibility text := coalesce(nullif(input->>'visibility', ''), 'project_and_klineo');
  actor_role public.portal_role := public.current_portal_role(target_project_id);
  subject_project_id uuid;
  subject_visibility public.portal_visibility;
  comment_id uuid;
begin
  if actor_role is null then raise exception 'No portal role is assigned'; end if;
  if not public.can_view_project(target_project_id) then raise exception 'Project is not visible'; end if;
  if target_visibility not in ('project_private', 'project_and_klineo', 'bot_chain', 'public', 'klineo_internal') then
    raise exception 'Unsupported comment visibility';
  end if;

  case input->>'subjectType'
    when 'project' then
      subject_project_id := (input->>'subjectId')::uuid;
      subject_visibility := case when public.is_bot_chain_user() then 'bot_chain' else 'project_and_klineo' end;
    when 'progress_update' then
      select project_id, visibility into subject_project_id, subject_visibility
      from public.progress_updates where id = (input->>'subjectId')::uuid;
    when 'milestone' then
      select project_id, visibility into subject_project_id, subject_visibility
      from public.milestones where id = (input->>'subjectId')::uuid;
    when 'showcase_item' then
      select project_id, visibility into subject_project_id, subject_visibility
      from public.showcase_items where id = (input->>'subjectId')::uuid;
    when 'review_request' then
      select project_id, 'project_and_klineo'::public.portal_visibility
      into subject_project_id, subject_visibility
      from public.review_requests where id = (input->>'subjectId')::uuid;
    else raise exception 'Unsupported comment subject';
  end case;
  if subject_project_id is null or subject_project_id <> target_project_id then
    raise exception 'Comment subject does not belong to this project';
  end if;
  if target_visibility = 'klineo_internal' and not public.is_klineo_user() then
    raise exception 'Only Klineo can create internal notes';
  end if;
  if target_visibility <> 'klineo_internal' and (
    (subject_visibility = 'project_private' and target_visibility <> 'project_private')
    or (subject_visibility = 'project_and_klineo' and target_visibility in ('bot_chain', 'public'))
    or (subject_visibility = 'bot_chain' and target_visibility = 'public')
  ) then
    raise exception 'A comment cannot be broader than its subject';
  end if;
  if target_visibility <> 'klineo_internal'
     and not public.can_read_visibility(target_project_id, target_visibility::public.portal_visibility) then
    raise exception 'Cannot comment at a visibility you cannot access';
  end if;
  if public.is_bot_chain_user()
     and (target_visibility <> 'bot_chain' or not public.is_bot_chain_reviewer()) then
    raise exception 'BOT Chain viewers can only comment on approved partner records';
  end if;
  insert into public.comments(
    project_id, subject_type, subject_id, body, author_id,
    author_name, author_role, visibility
  ) values (
    target_project_id,
    input->>'subjectType',
    (input->>'subjectId')::uuid,
    trim(input->>'body'),
    auth.uid(),
    coalesce(public.current_actor_name(), 'Unknown user'),
    actor_role,
    target_visibility
  ) returning id into comment_id;
  perform public.write_audit_event(
    target_project_id, 'comment.created', 'comment', comment_id::text,
    'Added a review comment.', jsonb_build_object('visibility', target_visibility)
  );
  return comment_id;
end;
$$;

create or replace function public.request_visibility_change(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_type text := input->>'subjectType';
  target_subject_id uuid := (input->>'subjectId')::uuid;
  target_project_id uuid;
  current_visibility public.portal_visibility;
  requested_visibility public.portal_visibility := (input->>'toVisibility')::public.portal_visibility;
  approval_id uuid;
begin
  if requested_visibility not in ('bot_chain', 'public') then
    raise exception 'Only BOT Chain and public disclosure require approval';
  end if;
  case target_subject_type
    when 'progress_update' then select project_id, visibility into target_project_id, current_visibility from public.progress_updates where id = target_subject_id;
    when 'milestone' then select project_id, visibility into target_project_id, current_visibility from public.milestones where id = target_subject_id;
    when 'blocker' then select project_id, visibility into target_project_id, current_visibility from public.blockers where id = target_subject_id;
    when 'showcase_item' then select project_id, visibility into target_project_id, current_visibility from public.showcase_items where id = target_subject_id;
    else raise exception 'Unsupported visibility subject';
  end case;
  if target_project_id is null or not public.is_project_lead(target_project_id) then
    raise exception 'Only a project lead can request broader disclosure';
  end if;
  if current_visibility = 'public'
     or (current_visibility = 'bot_chain' and requested_visibility = 'bot_chain') then
    raise exception 'The requested visibility must be broader than the current visibility';
  end if;
  insert into public.visibility_approvals(
    project_id, subject_type, subject_id, from_visibility, to_visibility,
    requested_by, requested_by_name
  ) values (
    target_project_id, target_subject_type, target_subject_id,
    current_visibility, requested_visibility, auth.uid(),
    coalesce(public.current_actor_name(), 'Unknown user')
  ) returning id into approval_id;
  perform public.write_audit_event(
    target_project_id, 'visibility.requested', target_subject_type, target_subject_id::text,
    format('Requested %s visibility.', requested_visibility),
    jsonb_build_object('from', current_visibility, 'to', requested_visibility, 'approvalId', approval_id)
  );
  return approval_id;
end;
$$;

create or replace function public.decide_visibility_change(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  approval public.visibility_approvals%rowtype;
  decision public.approval_state := (input->>'decision')::public.approval_state;
begin
  if not public.is_klineo_user() then raise exception 'Only Klineo can decide disclosure requests'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  select * into approval from public.visibility_approvals
  where id = (input->>'approvalId')::uuid and status = 'requested'
  for update;
  if approval.id is null then raise exception 'Pending approval not found'; end if;

  update public.visibility_approvals set
    status = decision,
    decided_by = auth.uid(),
    decided_by_name = coalesce(public.current_actor_name(), 'Unknown user'),
    decided_at = now(),
    decision_note = nullif(trim(coalesce(input->>'note', '')), '')
  where id = approval.id;

  if decision = 'approved' then
    case approval.subject_type
      when 'progress_update' then update public.progress_updates set visibility = approval.to_visibility where id = approval.subject_id;
      when 'milestone' then update public.milestones set visibility = approval.to_visibility where id = approval.subject_id;
      when 'blocker' then update public.blockers set visibility = approval.to_visibility where id = approval.subject_id;
      when 'showcase_item' then update public.showcase_items set visibility = approval.to_visibility, status = 'approved' where id = approval.subject_id;
    end case;
  end if;

  perform public.write_audit_event(
    approval.project_id,
    case when decision = 'approved' then 'visibility.approved' else 'visibility.rejected' end,
    approval.subject_type,
    approval.subject_id::text,
    format('%s %s visibility request.', initcap(decision::text), approval.to_visibility),
    jsonb_build_object('approvalId', approval.id, 'to', approval.to_visibility, 'note', input->>'note')
  );
  return approval.id;
end;
$$;

create or replace function public.revoke_shared_visibility(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_subject_type text := input->>'subjectType';
  target_subject_id uuid := (input->>'subjectId')::uuid;
  target_project_id uuid;
  target_visibility public.portal_visibility := coalesce(
    nullif(input->>'toVisibility', '')::public.portal_visibility,
    'project_and_klineo'
  );
begin
  if target_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Revocation must return content to a private visibility';
  end if;
  case target_subject_type
    when 'progress_update' then select project_id into target_project_id from public.progress_updates where id = target_subject_id;
    when 'milestone' then select project_id into target_project_id from public.milestones where id = target_subject_id;
    when 'blocker' then select project_id into target_project_id from public.blockers where id = target_subject_id;
    when 'showcase_item' then select project_id into target_project_id from public.showcase_items where id = target_subject_id;
    else raise exception 'Unsupported visibility subject';
  end case;
  if target_project_id is null or not public.is_project_lead(target_project_id) then
    raise exception 'Only a project lead can revoke shared visibility';
  end if;
  case target_subject_type
    when 'progress_update' then update public.progress_updates set visibility = target_visibility where id = target_subject_id;
    when 'milestone' then update public.milestones set visibility = target_visibility where id = target_subject_id;
    when 'blocker' then update public.blockers set visibility = target_visibility where id = target_subject_id;
    when 'showcase_item' then update public.showcase_items set visibility = target_visibility, status = 'submitted' where id = target_subject_id;
  end case;
  update public.visibility_approvals set status = 'revoked', decided_at = now()
  where subject_type = target_subject_type and subject_id = target_subject_id and status = 'approved';
  perform public.write_audit_event(
    target_project_id, 'visibility.revoked', target_subject_type, target_subject_id::text,
    format('Revoked shared visibility to %s.', target_visibility),
    jsonb_build_object('to', target_visibility)
  );
  return target_subject_id;
end;
$$;

create or replace function public.create_review_request(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  subject_project_id uuid;
  review_id uuid;
begin
  if not public.can_edit_project(target_project_id) then raise exception 'Not authorized'; end if;
  case input->>'subjectType'
    when 'progress_update' then
      select project_id into subject_project_id from public.progress_updates where id = (input->>'subjectId')::uuid;
    when 'milestone' then
      select project_id into subject_project_id from public.milestones where id = (input->>'subjectId')::uuid;
    when 'showcase_item' then
      select project_id into subject_project_id from public.showcase_items where id = (input->>'subjectId')::uuid;
    when 'gate' then subject_project_id := target_project_id;
    else raise exception 'Unsupported review subject';
  end case;
  if subject_project_id is null or subject_project_id <> target_project_id then
    raise exception 'Review subject does not belong to this project';
  end if;
  insert into public.review_requests(
    project_id, subject_type, subject_id, title, requested_by,
    requested_by_name, due_at
  ) values (
    target_project_id, input->>'subjectType', (input->>'subjectId')::uuid,
    trim(input->>'title'), auth.uid(), coalesce(public.current_actor_name(), 'Unknown user'),
    nullif(input->>'dueAt', '')::timestamptz
  ) returning id into review_id;
  perform public.write_audit_event(
    target_project_id, 'review.requested', 'review_request', review_id::text,
    format('Requested review: %s.', trim(input->>'title')), '{}'::jsonb
  );
  return review_id;
end;
$$;

create or replace function public.decide_review_request(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare review public.review_requests%rowtype; next_state public.review_state := (input->>'status')::public.review_state;
begin
  if not public.is_klineo_user() then raise exception 'Only Klineo can decide reviews'; end if;
  select * into review from public.review_requests where id = (input->>'reviewId')::uuid for update;
  if review.id is null then raise exception 'Review not found'; end if;
  update public.review_requests set
    status = next_state,
    assigned_to = coalesce(assigned_to, auth.uid()),
    assigned_to_name = coalesce(assigned_to_name, public.current_actor_name()),
    decided_at = case when next_state in ('approved', 'changes_requested', 'closed') then now() else decided_at end
  where id = review.id;
  perform public.write_audit_event(
    review.project_id, 'review.' || next_state::text, 'review_request', review.id::text,
    format('Review moved to %s.', next_state), '{}'::jsonb
  );
  return review.id;
end;
$$;

create or replace function public.import_desktop_submission(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_project_id uuid := (input->>'projectId')::uuid;
  bundle jsonb := input->'bundle';
  import_id uuid;
  computed_digest text;
  canonical_payload text := bundle->>'canonicalPayload';
  requested_visibility public.portal_visibility;
  imported_milestone jsonb;
  imported_milestone_count integer := 0;
begin
  if not public.is_project_lead(target_project_id) and not public.is_klineo_user() then
    raise exception 'Only a project lead or Klineo can import a desktop submission';
  end if;
  if coalesce((bundle->>'schemaVersion')::integer, 0) <> 1 then
    raise exception 'Unsupported desktop submission schema';
  end if;
  if canonical_payload is null or canonical_payload::jsonb is distinct from (bundle - 'canonicalPayload' - 'contentDigest') then
    raise exception 'Desktop submission canonical payload does not match its contents';
  end if;
  computed_digest := 'sha256:' || encode(
    digest(convert_to(canonical_payload, 'UTF8'), 'sha256'), 'hex'
  );
  if bundle->>'contentDigest' is distinct from computed_digest then
    raise exception 'Desktop submission digest does not match its contents';
  end if;
  requested_visibility := coalesce(
    nullif(bundle#>>'{privacy,visibility}', '')::public.portal_visibility,
    'project_and_klineo'
  );
  if requested_visibility not in ('project_private', 'project_and_klineo') then
    raise exception 'Desktop imports cannot create partner or public visibility';
  end if;
  if nullif(bundle#>>'{project,localProjectId}', '') is null then
    raise exception 'Desktop submission is missing its local project identifier';
  end if;
  insert into public.desktop_submission_imports(
    project_id, local_project_id, schema_version, content_digest, payload, imported_by
  ) values (
    target_project_id,
    bundle#>>'{project,localProjectId}',
    (bundle->>'schemaVersion')::integer,
    bundle->>'contentDigest',
    bundle,
    auth.uid()
  ) returning id into import_id;

  update public.projects set
    website_url = nullif(trim(coalesce(bundle#>>'{project,website}', '')), ''),
    description = trim(coalesce(bundle#>>'{project,description}', '')),
    target_launch_at = nullif(bundle#>>'{project,targetLaunchAt}', '')::timestamptz
  where id = target_project_id;

  for imported_milestone in
    select value from jsonb_array_elements(coalesce(bundle#>'{submission,milestones}', '[]'::jsonb))
  loop
    if nullif(imported_milestone->>'localMilestoneId', '') is null
       or char_length(trim(coalesce(imported_milestone->>'title', ''))) < 2 then
      raise exception 'Desktop milestone is missing its identifier or title';
    end if;
    insert into public.milestones(
      project_id, title, category, status, due_at, evidence_url,
      source_local_id, visibility, created_by
    ) values (
      target_project_id,
      trim(imported_milestone->>'title'),
      coalesce(nullif(trim(imported_milestone->>'category'), ''), 'Product'),
      coalesce(imported_milestone->>'status', 'not_started')::public.milestone_state,
      nullif(imported_milestone->>'dueAt', '')::timestamptz,
      case
        when imported_milestone->>'evidence' ~* '^https?://' then imported_milestone->>'evidence'
        else null
      end,
      imported_milestone->>'localMilestoneId',
      requested_visibility,
      auth.uid()
    )
    on conflict (project_id, source_local_id) where source_local_id is not null do update set
      title = case
        when public.milestones.visibility in ('bot_chain', 'public') then public.milestones.title
        else excluded.title
      end,
      category = case
        when public.milestones.visibility in ('bot_chain', 'public') then public.milestones.category
        else excluded.category
      end,
      status = excluded.status,
      due_at = case
        when public.milestones.visibility in ('bot_chain', 'public') then public.milestones.due_at
        else excluded.due_at
      end,
      evidence_url = case
        when public.milestones.visibility in ('bot_chain', 'public') then public.milestones.evidence_url
        else excluded.evidence_url
      end,
      visibility = case
        when public.milestones.visibility in ('bot_chain', 'public') then public.milestones.visibility
        else excluded.visibility
      end;
    imported_milestone_count := imported_milestone_count + 1;
  end loop;

  perform public.write_audit_event(
    target_project_id, 'desktop_submission.imported', 'desktop_submission', import_id::text,
    'Imported an explicit, digest-verified desktop submission package.',
    jsonb_build_object(
      'digest', bundle->>'contentDigest',
      'localProjectId', bundle#>>'{project,localProjectId}',
      'milestoneCount', imported_milestone_count,
      'visibility', requested_visibility
    )
  );
  return import_id;
end;
$$;

create or replace function public.portal_workspace()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  identity jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'full_name', u.full_name,
    'role', public.current_portal_role(),
    'organization_name', public.current_organization_name()
  ) into identity from public.users u where u.id = auth.uid();

  return jsonb_build_object(
    'user', identity,
    'projects', coalesce((select jsonb_agg(to_jsonb(p) order by p.name) from public.projects p), '[]'::jsonb),
    'progress_updates', coalesce((select jsonb_agg(to_jsonb(u) order by u.submitted_at desc) from public.progress_updates u), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(to_jsonb(m) order by m.due_at nulls last) from public.milestones m), '[]'::jsonb),
    'blockers', coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.blockers b), '[]'::jsonb),
    'showcase_items', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.showcase_items s), '[]'::jsonb),
    'showcase_assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.showcase_assets a), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c), '[]'::jsonb),
    'review_requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc) from public.review_requests r), '[]'::jsonb),
    'visibility_approvals', coalesce((select jsonb_agg(to_jsonb(v) order by v.requested_at desc) from public.visibility_approvals v), '[]'::jsonb),
    'cohorts', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'project_ids', coalesce((select jsonb_agg(cp.project_id) from public.cohort_projects cp where cp.cohort_id = c.id), '[]'::jsonb)
      ) order by c.starts_on desc nulls last) from public.cohorts c
    ), '[]'::jsonb),
    'desktop_submission_imports', coalesce((
      select jsonb_agg(to_jsonb(d) - 'payload' order by d.imported_at desc)
      from public.desktop_submission_imports d
    ), '[]'::jsonb),
    'audit_events', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.audit_events limit 200) a), '[]'::jsonb)
  );
end;
$$;

create or replace function public.public_showcase()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'projects', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.name)
      from public.projects p
      where exists(
        select 1 from public.showcase_items s
        where s.project_id = p.id and s.visibility = 'public' and s.status = 'approved'
      )
    ), '[]'::jsonb),
    'showcase_items', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at desc)
      from public.showcase_items s
      where s.visibility = 'public' and s.status = 'approved'
    ), '[]'::jsonb),
    'showcase_assets', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.showcase_assets a
      join public.showcase_items s on s.id = a.showcase_item_id
      where s.visibility = 'public' and s.status = 'approved'
    ), '[]'::jsonb)
  )
$$;

grant select on public.users, public.organizations, public.memberships, public.projects,
  public.project_members, public.cohorts, public.cohort_projects, public.progress_updates,
  public.milestones, public.blockers, public.showcase_items, public.showcase_assets,
  public.comments, public.review_requests, public.visibility_approvals, public.invitations,
  public.desktop_submission_imports, public.audit_events to authenticated;
grant select on public.projects, public.progress_updates, public.milestones, public.blockers,
  public.showcase_items, public.showcase_assets, public.comments to anon;
revoke insert, update, delete on public.projects, public.milestones, public.blockers
  from anon, authenticated;
grant execute on function public.can_read_visibility(uuid, public.portal_visibility) to anon, authenticated;
grant execute on function public.can_view_project(uuid) to anon, authenticated;
grant execute on function public.portal_workspace() to authenticated;
grant execute on function public.public_showcase() to anon, authenticated;
grant execute on function public.create_portal_project(jsonb) to authenticated;
grant execute on function public.update_project_profile(jsonb) to authenticated;
grant execute on function public.update_project_stage(jsonb) to authenticated;
grant execute on function public.create_portal_milestone(jsonb) to authenticated;
grant execute on function public.create_portal_blocker(jsonb) to authenticated;
grant execute on function public.update_delivery_status(jsonb) to authenticated;
grant execute on function public.create_portal_cohort(jsonb) to authenticated;
grant execute on function public.submit_progress_update(jsonb) to authenticated;
grant execute on function public.create_showcase_item(jsonb) to authenticated;
grant execute on function public.register_showcase_asset(jsonb) to authenticated;
grant execute on function public.add_portal_comment(jsonb) to authenticated;
grant execute on function public.request_visibility_change(jsonb) to authenticated;
grant execute on function public.decide_visibility_change(jsonb) to authenticated;
grant execute on function public.revoke_shared_visibility(jsonb) to authenticated;
grant execute on function public.create_review_request(jsonb) to authenticated;
grant execute on function public.decide_review_request(jsonb) to authenticated;
grant execute on function public.import_desktop_submission(jsonb) to authenticated;

revoke execute on function public.set_updated_at() from PUBLIC;
revoke execute on function public.current_actor_name() from PUBLIC;
revoke execute on function public.is_klineo_user() from PUBLIC;
revoke execute on function public.is_klineo_operator() from PUBLIC;
revoke execute on function public.is_bot_chain_user() from PUBLIC;
revoke execute on function public.is_bot_chain_reviewer() from PUBLIC;
revoke execute on function public.is_project_member(uuid) from PUBLIC;
revoke execute on function public.is_project_lead(uuid) from PUBLIC;
revoke execute on function public.can_edit_project(uuid) from PUBLIC;
revoke execute on function public.current_portal_role(uuid) from PUBLIC;
revoke execute on function public.current_organization_name() from PUBLIC;
revoke execute on function public.write_audit_event(uuid, text, text, text, text, jsonb) from PUBLIC;
revoke execute on function public.protect_submitted_update() from PUBLIC;
revoke execute on function public.handle_new_auth_user() from PUBLIC;
revoke execute on function public.portal_workspace() from PUBLIC;
revoke execute on function public.create_portal_project(jsonb) from PUBLIC;
revoke execute on function public.update_project_profile(jsonb) from PUBLIC;
revoke execute on function public.update_project_stage(jsonb) from PUBLIC;
revoke execute on function public.create_portal_milestone(jsonb) from PUBLIC;
revoke execute on function public.create_portal_blocker(jsonb) from PUBLIC;
revoke execute on function public.update_delivery_status(jsonb) from PUBLIC;
revoke execute on function public.create_portal_cohort(jsonb) from PUBLIC;
revoke execute on function public.submit_progress_update(jsonb) from PUBLIC;
revoke execute on function public.create_showcase_item(jsonb) from PUBLIC;
revoke execute on function public.register_showcase_asset(jsonb) from PUBLIC;
revoke execute on function public.add_portal_comment(jsonb) from PUBLIC;
revoke execute on function public.request_visibility_change(jsonb) from PUBLIC;
revoke execute on function public.decide_visibility_change(jsonb) from PUBLIC;
revoke execute on function public.revoke_shared_visibility(jsonb) from PUBLIC;
revoke execute on function public.create_review_request(jsonb) from PUBLIC;
revoke execute on function public.decide_review_request(jsonb) from PUBLIC;
revoke execute on function public.import_desktop_submission(jsonb) from PUBLIC;

grant execute on function public.is_klineo_user() to authenticated;
grant execute on function public.is_klineo_operator() to authenticated;
grant execute on function public.is_bot_chain_user() to authenticated;
grant execute on function public.is_bot_chain_reviewer() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.is_project_lead(uuid) to authenticated;
grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.current_portal_role(uuid) to authenticated;
grant execute on function public.current_organization_name() to authenticated;

-- Private object storage. The browser re-encodes screenshots to WebP before
-- upload, stripping EXIF and other source metadata. Storage independently
-- enforces the type and 10 MB size ceiling.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'showcase-assets',
  'showcase-assets',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists showcase_storage_insert on storage.objects;
create policy showcase_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'showcase-assets'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_edit_project(((storage.foldername(name))[1])::uuid)
);

drop policy if exists showcase_storage_select on storage.objects;
create policy showcase_storage_select on storage.objects for select to anon, authenticated
using (
  bucket_id = 'showcase-assets'
  and exists(
    select 1
    from public.showcase_assets a
    join public.showcase_items s on s.id = a.showcase_item_id
    where a.storage_path = name
      and (
        (auth.uid() is not null and public.can_read_visibility(s.project_id, s.visibility))
        or (s.visibility = 'public' and s.status = 'approved')
      )
  )
);

drop policy if exists showcase_storage_delete on storage.objects;
create policy showcase_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'showcase-assets'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.can_edit_project(((storage.foldername(name))[1])::uuid)
);
