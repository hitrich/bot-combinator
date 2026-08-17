-- Public Bot Combinator applications with a Klineo-only review queue.

create table if not exists public.project_applications (
  id uuid primary key default gen_random_uuid(),
  project_name text not null check (char_length(project_name) between 2 and 120),
  applicant_name text not null check (char_length(applicant_name) between 2 and 120),
  applicant_email text not null check (char_length(applicant_email) between 5 and 320),
  role_title text check (role_title is null or char_length(role_title) between 2 and 120),
  website_url text check (website_url is null or char_length(website_url) <= 2048),
  product_stage text not null check (product_stage in ('idea', 'prototype', 'beta', 'live')),
  team_size smallint check (team_size between 1 and 500),
  product_summary text not null check (char_length(product_summary) between 20 and 2000),
  program_goals text not null check (char_length(program_goals) between 20 and 2000),
  status text not null default 'submitted' check (
    status in ('submitted', 'in_review', 'interview', 'accepted', 'declined')
  ),
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 4000),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_by_name text
);

create index if not exists project_applications_status_time_idx
  on public.project_applications(status, submitted_at desc);
create index if not exists project_applications_email_time_idx
  on public.project_applications(lower(applicant_email), submitted_at desc);

drop trigger if exists project_applications_updated_at on public.project_applications;
create trigger project_applications_updated_at
before update on public.project_applications
for each row execute function public.set_updated_at();

alter table public.project_applications enable row level security;

drop policy if exists project_applications_read_klineo on public.project_applications;
create policy project_applications_read_klineo
on public.project_applications for select to authenticated
using (public.is_klineo_user());

create or replace function public.submit_project_application(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  application_id uuid;
  project_name_value text := trim(coalesce(input->>'projectName', ''));
  applicant_name_value text := trim(coalesce(input->>'applicantName', ''));
  applicant_email_value text := lower(trim(coalesce(input->>'applicantEmail', '')));
  role_title_value text := nullif(trim(coalesce(input->>'roleTitle', '')), '');
  website_url_value text := nullif(trim(coalesce(input->>'websiteUrl', '')), '');
  product_stage_value text := trim(coalesce(input->>'productStage', ''));
  team_size_text text := nullif(trim(coalesce(input->>'teamSize', '')), '');
  team_size_value smallint;
  product_summary_value text := trim(coalesce(input->>'productSummary', ''));
  program_goals_value text := trim(coalesce(input->>'programGoals', ''));
begin
  -- Honeypot submissions receive a plausible response without creating a record.
  if trim(coalesce(input->>'middleName', '')) <> '' then
    return gen_random_uuid();
  end if;

  if char_length(project_name_value) not between 2 and 120 then
    raise exception 'Project name must be between 2 and 120 characters';
  end if;
  if char_length(applicant_name_value) not between 2 and 120 then
    raise exception 'Applicant name must be between 2 and 120 characters';
  end if;
  if char_length(applicant_email_value) not between 5 and 320
    or applicant_email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
  then
    raise exception 'Enter a valid work email address';
  end if;
  if role_title_value is not null and char_length(role_title_value) not between 2 and 120 then
    raise exception 'Role title must be between 2 and 120 characters';
  end if;
  if website_url_value is not null
    and (char_length(website_url_value) > 2048 or website_url_value !~* '^https?://[^[:space:]]+$')
  then
    raise exception 'Product website must be a valid http or https URL';
  end if;
  if product_stage_value not in ('idea', 'prototype', 'beta', 'live') then
    raise exception 'Choose a valid product stage';
  end if;
  if team_size_text is not null then
    if team_size_text !~ '^[0-9]{1,3}$' then
      raise exception 'Team size must be a number between 1 and 500';
    end if;
    team_size_value := team_size_text::smallint;
    if team_size_value not between 1 and 500 then
      raise exception 'Team size must be a number between 1 and 500';
    end if;
  end if;
  if char_length(product_summary_value) not between 20 and 2000 then
    raise exception 'Product summary must be between 20 and 2,000 characters';
  end if;
  if char_length(program_goals_value) not between 20 and 2000 then
    raise exception 'Program goals must be between 20 and 2,000 characters';
  end if;

  if exists (
    select 1
    from public.project_applications a
    where lower(a.applicant_email) = applicant_email_value
      and lower(a.project_name) = lower(project_name_value)
      and a.submitted_at > now() - interval '24 hours'
  ) then
    raise exception 'An application for this project was already submitted from this email recently';
  end if;

  insert into public.project_applications(
    project_name,
    applicant_name,
    applicant_email,
    role_title,
    website_url,
    product_stage,
    team_size,
    product_summary,
    program_goals
  ) values (
    project_name_value,
    applicant_name_value,
    applicant_email_value,
    role_title_value,
    website_url_value,
    product_stage_value,
    team_size_value,
    product_summary_value,
    program_goals_value
  ) returning id into application_id;

  return application_id;
end;
$$;

create or replace function public.list_project_applications()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(to_jsonb(a) - 'reviewed_by' order by a.submitted_at desc),
    '[]'::jsonb
  )
  from public.project_applications a
$$;

create or replace function public.review_project_application(input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  application_id uuid;
  target_status text := trim(coalesce(input->>'status', ''));
  review_note_value text := nullif(trim(coalesce(input->>'reviewerNote', '')), '');
begin
  if not public.is_klineo_user() then
    raise exception 'Only Klineo program members can review applications';
  end if;

  begin
    application_id := (input->>'applicationId')::uuid;
  exception when invalid_text_representation then
    raise exception 'A valid application is required';
  end;

  if target_status not in ('in_review', 'interview', 'accepted', 'declined') then
    raise exception 'Choose a valid application status';
  end if;
  if review_note_value is not null and char_length(review_note_value) > 4000 then
    raise exception 'Reviewer note must be 4,000 characters or fewer';
  end if;

  update public.project_applications
  set
    status = target_status,
    reviewer_note = coalesce(review_note_value, project_applications.reviewer_note),
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    reviewed_by_name = public.current_actor_name()
  where id = application_id;

  if not found then
    raise exception 'Application not found';
  end if;

  perform public.write_audit_event(
    null,
    'application.status_changed',
    'project_application',
    application_id::text,
    'Moved a Bot Combinator application to ' || replace(target_status, '_', ' ') || '.',
    jsonb_build_object('status', target_status)
  );

  return application_id;
end;
$$;

revoke all on table public.project_applications from anon, authenticated;
grant select on table public.project_applications to authenticated;

revoke execute on function public.submit_project_application(jsonb) from PUBLIC;
revoke execute on function public.list_project_applications() from PUBLIC;
revoke execute on function public.review_project_application(jsonb) from PUBLIC;
grant execute on function public.submit_project_application(jsonb) to anon, authenticated;
grant execute on function public.list_project_applications() to authenticated;
grant execute on function public.review_project_application(jsonb) to authenticated;
