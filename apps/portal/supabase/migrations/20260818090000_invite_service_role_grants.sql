-- The invite-member Edge Function uses a Supabase secret key, which assumes
-- the service_role database role. RLS bypass does not replace PostgreSQL table
-- privileges, so grant only the operations required by the invitation flow.

grant select on table
  public.users,
  public.organizations,
  public.projects,
  public.invitations,
  public.memberships,
  public.project_members
to service_role;

grant insert, update on table
  public.invitations,
  public.memberships,
  public.project_members
to service_role;

grant insert on table public.audit_events to service_role;
