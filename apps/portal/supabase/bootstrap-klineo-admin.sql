-- Run once in the Supabase SQL editor after inviting or creating the first
-- Klineo admin in Authentication > Users. Replace the email before running.

begin;

do $$
declare
  admin_email text := 'replace-with-admin@example.com';
  admin_user auth.users%rowtype;
  klineo_organization_id uuid;
begin
  if admin_email = 'replace-with-admin@example.com' then
    raise exception 'Replace admin_email with the first Klineo administrator email';
  end if;

  select * into admin_user
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;
  if admin_user.id is null then
    raise exception 'Create or invite % in Authentication > Users first', admin_email;
  end if;

  insert into public.users(id, email, full_name, avatar_url)
  values (
    admin_user.id,
    coalesce(admin_user.email, admin_email),
    coalesce(admin_user.raw_user_meta_data->>'full_name', admin_user.raw_user_meta_data->>'name', admin_email),
    admin_user.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
    updated_at = now();

  select id into klineo_organization_id
  from public.organizations
  where slug = 'klineo';
  if klineo_organization_id is null then
    raise exception 'Run the portal migration before bootstrapping the admin';
  end if;

  insert into public.memberships(organization_id, user_id, role)
  values (klineo_organization_id, admin_user.id, 'klineo_admin')
  on conflict (organization_id, user_id) do update set role = excluded.role;

  insert into public.audit_events(
    project_id, actor_id, actor_name, action, entity_type, entity_id, detail, metadata
  ) values (
    null,
    admin_user.id,
    coalesce(admin_user.raw_user_meta_data->>'full_name', admin_user.email, 'Klineo admin'),
    'membership.bootstrapped',
    'membership',
    admin_user.id::text,
    'Bootstrapped the first Klineo administrator.',
    jsonb_build_object('organizationId', klineo_organization_id)
  );
end;
$$;

commit;
