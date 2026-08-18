# Bot Combinator portal production deployment

This runbook deploys the shared portal while keeping the desktop vault local and private. The target production shape is one hosted web application plus one managed Supabase project. Project teams and reviewers use installed desktop releases and the hosted URL; nobody runs `pnpm dev` in production.

## 1. Choose production identities and URLs

Decide the final HTTPS origin first, for example `https://portal.example.com`. Use the same exact origin for:

- `VITE_PORTAL_URL` in the web build;
- the Supabase Auth Site URL and redirect allowlist; and
- the `PORTAL_URL` Edge Function secret.

Use separate Supabase projects for development/staging and production. Never load demo seed data into production.

## 2. Create and migrate Supabase

Create a managed Supabase project in the region required by Klineo's data policy. From `apps/portal`, install/use the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then link and preview the migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The migration creates the Klineo and BOT Chain organizations, project/membership records, immutable progress history, visibility approvals, audits, all row-level policies, and the private `showcase-assets` bucket. Supabase recommends migration-driven deployment and a dry run before `db push`; do not use a destructive remote reset against production.

## 3. Deploy invitations

Deploy the invitation function and bind it to the exact portal origin:

```bash
npx supabase functions deploy invite-member
npx supabase secrets set PORTAL_URL=https://portal.example.com
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the hosted Edge Function runtime. The service-role key must never be placed in a browser variable, repository secret exposed to previews, or desktop build.

## 4. Bootstrap the first Klineo admin

In Supabase Authentication > Users, create or invite the first Klineo administrator. Edit the placeholder email in `apps/portal/supabase/bootstrap-klineo-admin.sql`, then run that file once in the SQL editor. After this first membership exists, Klineo admins/operators can create projects, create cohorts, and invite all later members from the portal.

## 5. Configure email authentication

In Authentication > URL Configuration:

- set Site URL to the exact production origin;
- add the exact production origin to Redirect URLs;
- add only deliberate staging/preview patterns; and
- keep localhost redirects out of the production allowlist unless they are actively required.

Supabase documents that the [Site URL controls the default email redirect](https://supabase.com/docs/guides/auth/redirect-urls). Configure a [custom SMTP provider](https://supabase.com/docs/guides/auth/auth-smtp) before inviting real teams—the default sender is rate-limited and intended for development, not production. Customize the invitation and magic-link templates to identify Klineo and Bot Combinator clearly.

## 6. Configure and deploy the static portal

Set these build-time variables in the hosting project:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_PORTAL_URL=https://portal.example.com
VITE_PORTAL_DEMO_MODE=false
VITE_DESKTOP_VERSION=v0.1.2
VITE_DESKTOP_MACOS_ARM64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-macos-arm64.dmg
VITE_DESKTOP_MACOS_X64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-macos-x64.dmg
VITE_DESKTOP_WINDOWS_X64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-windows-x64.exe
VITE_DESKTOP_WINDOWS_ARM64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-windows-arm64.exe
VITE_DESKTOP_LINUX_X64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-linux-x64.AppImage
VITE_DESKTOP_LINUX_ARM64_URL=https://YOUR_DISTRIBUTION_HOST/Bot-Combinator-linux-arm64.AppImage
```

The six installer variables must point to the final verified files on the
approved distribution host. Missing files remain disabled on the signed-in
**Desktop app** page; project members are never redirected to the source-code
repository.

Build command:

```bash
pnpm --filter @bot-combinator/portal build
```

Publish directory: `apps/portal/dist`.

Configure the host to rewrite unknown application routes, including `/showcase`, to `index.html`. Attach the custom domain, enforce HTTPS, disable directory listing, and do not cache `index.html` indefinitely. Static hashed assets may be cached long-term.

## 7. Validate role isolation before launch

Use separate real test accounts for each role; do not rely only on the in-app demo switch.

1. Project member: sees only assigned projects and cannot request a broader disclosure.
2. Project lead: can request BOT Chain/public sharing but cannot approve it.
3. Klineo reviewer: can review authorized records but cannot create project workspaces.
4. Klineo operator/admin: sees the portfolio and can approve/reject disclosure requests.
5. BOT Chain viewer: sees only records whose stored visibility is `bot_chain` or `public`.
6. Anonymous browser: sees only approved `public` showcase items at `/showcase`.
7. Attempt direct REST updates with a publishable key; PostgreSQL grants must reject them.
8. Upload an image containing EXIF metadata; verify the stored object is WebP and within the 10 MB policy.

Also run Supabase Security Advisor and Performance Advisor. The official [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) calls for reviewing RLS, database security findings, availability, and expected load.

## 8. Operational controls

- Turn on the backup/PITR level appropriate for the program and test restoration. Supabase documents plan-specific [database backups](https://supabase.com/docs/guides/platform/backups).
- Set retention periods for screenshots, audits, rejected invitations, and departed projects.
- Monitor Auth failures, Edge Function errors, storage growth, slow queries, and rejected disclosure attempts.
- Rotate service credentials and SMTP credentials on a schedule and after any suspected exposure.
- Create an incident process that can revoke memberships, revoke shared visibility, and take the public showcase offline without touching desktop vaults.

## 9. Distribute the desktop app

Build signed installers through the existing release pipeline (`pnpm package:mac`, `pnpm package:win`, or `pnpm package:linux`). A project lead chooses **Portal submission** in the program workspace, previews the allowlisted fields, and exports a digest-protected JSON package. Importing that package into the hosted project remains an explicit user action.

The desktop app never continuously syncs credentials, investor data, fundraising data, mail/calendar history, private notes, or agent transcripts to the portal.
