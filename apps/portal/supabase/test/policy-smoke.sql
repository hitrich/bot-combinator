-- Functional smoke checks for the migration. Run only against an isolated
-- database after platform-stubs.sql and the portal migration.

\set ON_ERROR_STOP on

insert into auth.users(id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'admin@example.com', '{"full_name":"Klineo Admin"}'),
  ('20000000-0000-0000-0000-000000000002', 'lead@example.com', '{"full_name":"Project Lead"}'),
  ('30000000-0000-0000-0000-000000000003', 'partner@example.com', '{"full_name":"BOT Reviewer"}');

insert into public.memberships(organization_id, user_id, role)
select id, '10000000-0000-0000-0000-000000000001', 'klineo_admin'
from public.organizations where slug = 'klineo';

insert into public.memberships(organization_id, user_id, role)
select id, '30000000-0000-0000-0000-000000000003', 'bot_chain_reviewer'
from public.organizations where slug = 'bot-chain';

-- The smoke fixture computes a desktop digest client-side. Production clients
-- compute this in the desktop app and do not need pgcrypto privileges.
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
set role authenticated;
select public.create_portal_project(
  jsonb_build_object(
    'name', 'Policy Smoke Project',
    'tagline', 'A role isolation fixture',
    'description', 'Created through the audited project RPC.',
    'websiteUrl', 'https://example.com'
  )
) as project_id \gset
reset role;

insert into public.project_members(project_id, user_id, role)
values (:'project_id', '20000000-0000-0000-0000-000000000002', 'project_lead');
insert into public.memberships(organization_id, user_id, role)
select p.owner_organization_id, '20000000-0000-0000-0000-000000000002', 'project_lead'
from public.projects p where p.id = :'project_id';

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', false);
set role authenticated;
with canonical as (
  select jsonb_build_object(
    'schemaVersion', 1,
    'exportedAt', '2026-08-17T12:00:00.000Z',
    'source', jsonb_build_object(
      'application', 'Bot Combinator Desktop',
      'mode', 'explicit_program_submission'
    ),
    'privacy', jsonb_build_object(
      'visibility', 'project_and_klineo',
      'omittedDataClasses', jsonb_build_array('credentials', 'investor records')
    ),
    'project', jsonb_build_object(
      'localProjectId', 'desktop-policy-smoke',
      'name', 'Policy Smoke Project',
      'website', 'https://example.com/imported',
      'description', 'Imported explicitly from the desktop fixture.',
      'stage', 'cohort',
      'targetLaunchAt', '2026-10-01T00:00:00.000Z',
      'cohortName', null
    ),
    'submission', jsonb_build_object(
      'gates', '[]'::jsonb,
      'milestones', jsonb_build_array(jsonb_build_object(
        'localMilestoneId', 'desktop-milestone-1',
        'title', 'Imported desktop milestone',
        'category', 'integration',
        'dueAt', '2026-09-01T00:00:00.000Z',
        'status', 'in_progress',
        'evidenceRequired', 'Sandbox receipt',
        'evidence', 'https://example.com/evidence',
        'updatedAt', '2026-08-17T12:00:00.000Z'
      ))
    )
  ) as payload
)
select public.import_desktop_submission(jsonb_build_object(
  'projectId', :'project_id',
  'bundle', payload || jsonb_build_object(
    'canonicalPayload', payload::text,
    'contentDigest', 'sha256:' || encode(
      extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex'
    )
  )
))
from canonical;
select 1 / case when count(*) = 1 then 1 else 0 end as desktop_import_recorded
from public.desktop_submission_imports where project_id = :'project_id';
select 1 / case when count(*) = 1 then 1 else 0 end as desktop_milestone_materialized
from public.milestones
where project_id = :'project_id' and source_local_id = 'desktop-milestone-1';

select public.create_portal_milestone(
  jsonb_build_object(
    'projectId', :'project_id',
    'title', 'Private milestone',
    'category', 'Integration',
    'visibility', 'project_and_klineo'
  )
) as milestone_id \gset

do $$
begin
  begin
    update public.milestones set visibility = 'public';
    raise exception 'Direct table updates must not be permitted';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select public.request_visibility_change(
  jsonb_build_object(
    'subjectType', 'milestone',
    'subjectId', :'milestone_id',
    'toVisibility', 'bot_chain'
  )
) as approval_id \gset
reset role;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false);
set role authenticated;
select 1 / case when count(*) = 0 then 1 else 0 end as partner_cannot_see_pending
from public.milestones where id = :'milestone_id';
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
set role authenticated;
select public.decide_visibility_change(
  jsonb_build_object(
    'approvalId', :'approval_id',
    'decision', 'approved',
    'note', 'Approved by the isolation smoke test'
  )
);
reset role;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false);
set role authenticated;
select 1 / case when count(*) = 1 then 1 else 0 end as partner_sees_approved
from public.milestones where id = :'milestone_id' and visibility = 'bot_chain';
select 1 / case when jsonb_array_length(public.portal_workspace()->'projects') = 1 then 1 else 0 end
  as partner_workspace_is_scoped;
select 1 / case when public.portal_workspace()#>>'{user,organization_name}' = 'BOT Chain' then 1 else 0 end
  as partner_identity_is_scoped;
reset role;

create function pg_temp.expect_broader_comment_rejected(project_id uuid, milestone_id uuid)
returns void
language plpgsql
as $$
declare rejected boolean := false;
begin
  begin
    perform public.add_portal_comment(jsonb_build_object(
      'projectId', project_id,
      'subjectType', 'milestone',
      'subjectId', milestone_id,
      'body', 'This must not become public without its subject.',
      'visibility', 'public'
    ));
  exception when others then
    rejected := true;
  end;
  if not rejected then raise exception 'Broader comment visibility was unexpectedly accepted'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', false);
set role authenticated;
select pg_temp.expect_broader_comment_rejected(:'project_id', :'milestone_id');
select public.revoke_shared_visibility(jsonb_build_object(
  'subjectType', 'milestone',
  'subjectId', :'milestone_id',
  'toVisibility', 'project_and_klineo'
));
reset role;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false);
set role authenticated;
select 1 / case when count(*) = 0 then 1 else 0 end as partner_loses_revoked_record
from public.milestones where id = :'milestone_id';
reset role;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select 1 / case when count(*) = 0 then 1 else 0 end as anonymous_cannot_see_partner_record
from public.milestones where id = :'milestone_id';
reset role;
