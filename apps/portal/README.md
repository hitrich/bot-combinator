# Bot Combinator collaboration portal

`apps/portal` is the hosted, multi-user companion to the private Bot Combinator desktop vault. It gives project teams, Klineo, and BOT Chain role-scoped views of intentionally submitted program data.

## Product boundary

- The desktop SQLite vault remains the source of truth for fundraising CRM data, credentials, email history, private notes, and agent history.
- The portal stores only program records entered in the portal or imported through an explicit, digest-verified desktop submission.
- New progress and showcase records default to `project_and_klineo`.
- BOT Chain and public visibility require a project-lead request and a separate Klineo approval.
- Screenshots are re-encoded in the browser to remove source metadata, then uploaded to a private object-storage bucket through signed URLs.

## Run the interactive demo

From the repository root:

```bash
pnpm install
pnpm dev:portal
```

When Supabase variables are absent in development, the portal starts in a populated role-switching demo. Set `VITE_PORTAL_DEMO_MODE=false` together with the variables in `.env.example` to exercise a real backend.

## Production architecture

- Vite + React static web application
- Supabase Auth with invitation-based email login
- Managed PostgreSQL with row-level security
- Private Supabase Storage bucket with signed upload/download URLs
- Supabase Edge Function for privileged invitation delivery
- Append-only progress submissions and audit events

See [the production deployment runbook](../../docs/portal-deployment.md) for database migration, first-admin bootstrap, Auth/SMTP configuration, hosting, and release checks.

## Verification

```bash
pnpm --filter @bot-combinator/portal test
pnpm --filter @bot-combinator/portal typecheck
pnpm --filter @bot-combinator/portal build
```

The build output is `apps/portal/dist`. Production users open the hosted URL; they never run `pnpm dev`.
