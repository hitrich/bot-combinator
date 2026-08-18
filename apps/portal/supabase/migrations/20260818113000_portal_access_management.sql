-- Klineo operator access directory and role-management operations.
-- These functions keep membership changes behind the same audited authority
-- boundary used by the rest of the hosted portal.

create or replace function public.list_portal_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  members_payload jsonb;
  invitations_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_klineo_operator() then
    raise exception 'Klineo operator access is required';
  end if;

  with access_rows as (
    select
      m.id,
      'membership'::text as access_type,
      u.id as user_id,
      u.email,
      u.full_name,
      m.role,
      o.name as organization_name,
      null::uuid as project_id,
      null::text as project_name,
      m.created_at
    from public.memberships m
    join public.users u on u.id = m.user_id
    join public.organizations o on o.id = m.organization_id
    where m.role in (
      'klineo_admin',
      'klineo_operator',
      'klineo_reviewer',
      'bot_chain_reviewer',
      'bot_chain_viewer'
    )

    union all

    select
      pm.id,
      'project'::text as access_type,
      u.id as user_id,
      u.email,
      u.full_name,
      pm.role,
      o.name as organization_name,
      p.id as project_id,
      p.name as project_name,
      pm.created_at
    from public.project_members pm
    join public.users u on u.id = pm.user_id
    join public.projects p on p.id = pm.project_id
    join public.organizations o on o.id = p.owner_organization_id
  )
  select coalesce(
    jsonb_agg(to_jsonb(access_rows) order by
      case role
        when 'klineo_admin' then 1
        when 'klineo_operator' then 2
        when 'klineo_reviewer' then 3
        when 'project_lead' then 4
        when 'project_member' then 5
        when 'bot_chain_reviewer' then 6
        else 7
      end,
      full_name,
      email
    ),
    '[]'::jsonb
  ) into members_payload
  from access_rows;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'full_name', i.full_name,
        'role', i.role,
        'organization_name', o.name,
        'project_id', i.project_id,
        'project_name', p.name,
        'invited_by_name', coalesce(inviter.full_name, inviter.email, 'Klineo'),
        'created_at', i.created_at,
        'expires_at', i.expires_at
      ) order by i.created_at desc
    ),
    '[]'::jsonb
  ) into invitations_payload
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.projects p on p.id = i.project_id
  left join public.users inviter on inviter.id = i.invited_by
  where i.accepted_at is null
    and i.role <> 'klineo_admin';

  return jsonb_build_object(
    'members', members_payload,
    'invitations', invitations_payload
  );
end;
$$;

create or replace function public.update_portal_access(input jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  access_id uuid := nullif(input->>'accessId', '')::uuid;
  access_type text := input->>'accessType';
  requested_role public.portal_role := nullif(input->>'role', '')::public.portal_role;
  requested_project_id uuid := nullif(input->>'projectId', '')::uuid;
  requested_is_project boolean;
  subject_user_id uuid;
  subject_email text;
  subject_name text;
  prior_role public.portal_role;
  prior_organization_id uuid;
  prior_project_id uuid;
  target_organization_id uuid;
  target_project_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_klineo_operator() then
    raise exception 'Klineo operator access is required';
  end if;
  if access_id is null or access_type not in ('membership', 'project') then
    raise exception 'A valid access record is required';
  end if;
  if requested_role is null or requested_role not in (
    'klineo_operator',
    'klineo_reviewer',
    'bot_chain_reviewer',
    'bot_chain_viewer',
    'project_lead',
    'project_member'
  ) then
    raise exception 'The selected role cannot be assigned here';
  end if;
  requested_is_project := requested_role in ('project_lead', 'project_member');

  if access_type = 'membership' then
    select m.user_id, u.email, u.full_name, m.role, m.organization_id
      into subject_user_id, subject_email, subject_name, prior_role, prior_organization_id
    from public.memberships m
    join public.users u on u.id = m.user_id
    where m.id = access_id;
  else
    select pm.user_id, u.email, u.full_name, pm.role, p.owner_organization_id, pm.project_id
      into subject_user_id, subject_email, subject_name, prior_role, prior_organization_id, prior_project_id
    from public.project_members pm
    join public.users u on u.id = pm.user_id
    join public.projects p on p.id = pm.project_id
    where pm.id = access_id;
  end if;

  if subject_user_id is null then
    raise exception 'Access record was not found';
  end if;
  if prior_role = 'klineo_admin' then
    raise exception 'Workspace admin access is managed outside this directory';
  end if;
  if subject_user_id = auth.uid() then
    raise exception 'Another Klineo operator must change your access';
  end if;

  if requested_is_project then
    if requested_project_id is null then
      raise exception 'A project is required for this role';
    end if;
    select p.owner_organization_id, p.name
      into target_organization_id, target_project_name
    from public.projects p
    where p.id = requested_project_id;
    if target_organization_id is null then
      raise exception 'Project was not found';
    end if;
  else
    select o.id
      into target_organization_id
    from public.organizations o
    where o.type = case
      when requested_role in ('bot_chain_reviewer', 'bot_chain_viewer')
        then 'bot_chain'::public.organization_type
      else 'klineo'::public.organization_type
    end
    order by o.created_at
    limit 1;
    if target_organization_id is null then
      raise exception 'The target organization is not configured';
    end if;
    if exists (
      select 1
      from public.memberships m
      where m.organization_id = target_organization_id
        and m.user_id = subject_user_id
        and (access_type <> 'membership' or m.id <> access_id)
    ) then
      raise exception 'This person already has access in the selected organization';
    end if;
  end if;

  if access_type = 'project' then
    if requested_is_project then
      if exists (
        select 1
        from public.project_members pm
        where pm.project_id = requested_project_id
          and pm.user_id = subject_user_id
          and pm.id <> access_id
      ) then
        raise exception 'This person already has access to that project';
      end if;

      update public.project_members
      set project_id = requested_project_id,
          role = requested_role
      where id = access_id;

      insert into public.memberships(organization_id, user_id, role)
      values (target_organization_id, subject_user_id, requested_role)
      on conflict (organization_id, user_id) do update set role = excluded.role;
    else
      delete from public.project_members where id = access_id;

      insert into public.memberships(organization_id, user_id, role)
      values (target_organization_id, subject_user_id, requested_role)
      on conflict (organization_id, user_id) do update set role = excluded.role;
    end if;

    if prior_organization_id <> target_organization_id
      and not exists (
        select 1
        from public.project_members pm
        join public.projects p on p.id = pm.project_id
        where pm.user_id = subject_user_id
          and p.owner_organization_id = prior_organization_id
      )
    then
      delete from public.memberships m
      where m.organization_id = prior_organization_id
        and m.user_id = subject_user_id
        and m.role in ('project_lead', 'project_member');
    end if;
  else
    if requested_is_project then
      if exists (
        select 1
        from public.project_members pm
        where pm.project_id = requested_project_id
          and pm.user_id = subject_user_id
      ) then
        update public.project_members
        set role = requested_role
        where project_id = requested_project_id
          and user_id = subject_user_id;
      else
        insert into public.project_members(project_id, user_id, role)
        values (requested_project_id, subject_user_id, requested_role);
      end if;

      insert into public.memberships(organization_id, user_id, role)
      values (target_organization_id, subject_user_id, requested_role)
      on conflict (organization_id, user_id) do update set role = excluded.role;
    else
      insert into public.memberships(organization_id, user_id, role)
      values (target_organization_id, subject_user_id, requested_role)
      on conflict (organization_id, user_id) do update set role = excluded.role;
    end if;

    if prior_organization_id <> target_organization_id then
      delete from public.memberships
      where id = access_id;
    end if;
  end if;

  perform public.write_audit_event(
    case when requested_is_project then requested_project_id else null end,
    'access.role_updated',
    'user_access',
    subject_user_id::text,
    format('Changed %s from %s to %s.', coalesce(nullif(subject_name, ''), subject_email), prior_role, requested_role),
    jsonb_build_object(
      'subjectUserId', subject_user_id,
      'email', subject_email,
      'priorRole', prior_role,
      'role', requested_role,
      'projectId', case when requested_is_project then requested_project_id else null end,
      'projectName', target_project_name
    )
  );

  return subject_user_id::text;
end;
$$;

create or replace function public.remove_portal_access(input jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  access_id uuid := nullif(input->>'accessId', '')::uuid;
  access_type text := input->>'accessType';
  subject_user_id uuid;
  subject_email text;
  subject_name text;
  subject_role public.portal_role;
  subject_project_id uuid;
  subject_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_klineo_operator() then
    raise exception 'Klineo operator access is required';
  end if;
  if access_id is null or access_type not in ('membership', 'project') then
    raise exception 'A valid access record is required';
  end if;

  if access_type = 'membership' then
    select m.user_id, u.email, u.full_name, m.role, m.organization_id
      into subject_user_id, subject_email, subject_name, subject_role, subject_organization_id
    from public.memberships m
    join public.users u on u.id = m.user_id
    where m.id = access_id;
  else
    select pm.user_id, u.email, u.full_name, pm.role, pm.project_id, p.owner_organization_id
      into subject_user_id, subject_email, subject_name, subject_role, subject_project_id, subject_organization_id
    from public.project_members pm
    join public.users u on u.id = pm.user_id
    join public.projects p on p.id = pm.project_id
    where pm.id = access_id;
  end if;

  if subject_user_id is null then
    raise exception 'Access record was not found';
  end if;
  if subject_role = 'klineo_admin' then
    raise exception 'Workspace admin access cannot be removed here';
  end if;
  if subject_user_id = auth.uid() then
    raise exception 'Another Klineo operator must remove your access';
  end if;

  if access_type = 'membership' then
    delete from public.memberships where id = access_id;
  else
    delete from public.project_members where id = access_id;
    if not exists (
      select 1
      from public.project_members pm
      join public.projects p on p.id = pm.project_id
      where pm.user_id = subject_user_id
        and p.owner_organization_id = subject_organization_id
    ) then
      delete from public.memberships m
      where m.organization_id = subject_organization_id
        and m.user_id = subject_user_id
        and m.role in ('project_lead', 'project_member');
    end if;
  end if;

  perform public.write_audit_event(
    subject_project_id,
    'access.removed',
    'user_access',
    subject_user_id::text,
    format('Removed %s access for %s.', subject_role, coalesce(nullif(subject_name, ''), subject_email)),
    jsonb_build_object(
      'subjectUserId', subject_user_id,
      'email', subject_email,
      'role', subject_role,
      'projectId', subject_project_id
    )
  );

  return subject_user_id::text;
end;
$$;

create or replace function public.cancel_portal_invitation(input jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid := nullif(input->>'invitationId', '')::uuid;
  invitation_row public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_klineo_operator() then
    raise exception 'Klineo operator access is required';
  end if;
  if invitation_id is null then
    raise exception 'A valid invitation is required';
  end if;

  select * into invitation_row
  from public.invitations
  where id = invitation_id
    and accepted_at is null;

  if invitation_row.id is null then
    raise exception 'Pending invitation was not found';
  end if;

  perform public.write_audit_event(
    invitation_row.project_id,
    'invitation.cancelled',
    'invitation',
    invitation_row.id::text,
    format('Cancelled the pending invitation for %s.', invitation_row.email),
    jsonb_build_object('email', invitation_row.email, 'role', invitation_row.role)
  );

  delete from public.invitations where id = invitation_row.id;
  return invitation_row.id::text;
end;
$$;

revoke execute on function public.list_portal_access() from public;
revoke execute on function public.update_portal_access(jsonb) from public;
revoke execute on function public.remove_portal_access(jsonb) from public;
revoke execute on function public.cancel_portal_invitation(jsonb) from public;

grant execute on function public.list_portal_access() to authenticated;
grant execute on function public.update_portal_access(jsonb) to authenticated;
grant execute on function public.remove_portal_access(jsonb) to authenticated;
grant execute on function public.cancel_portal_invitation(jsonb) to authenticated;
