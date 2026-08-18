# Bot Combinator Auth emails

These templates cover the two email paths the production portal currently sends:

- `invite.html`: a Klineo operator invites a new project, Klineo, or BOT Chain member.
- `magic_link.html`: an invited member requests a passwordless sign-in link. The invitation function also sends this message when an existing account receives a new membership.

Both templates use the existing Bot Combinator logo, one lime action color, a 600 px email-safe table layout, inline critical styles, mobile sizing, dark-mode fallbacks, and visible fallback URLs. They contain no marketing tracking or private project data.

## Invitation metadata

The `invite-member` Edge Function supplies these safe Auth metadata fields:

- `full_name`
- `role`
- `role_label`
- `scope_name`
- `invited_by_name`

Do not add confidential notes, investor information, contact lists, or project submissions to Auth metadata or email templates.

## Preview locally

From the repository root:

```bash
pnpm --filter @bot-combinator/portal preview:emails
```

Rendered examples are written to `apps/portal/.tmp/email-previews/` and are intentionally ignored by Git.

## Production setup

The entries in `supabase/config.toml` configure local Supabase. Hosted projects can use the same HTML through Authentication > Email Templates or the Supabase Management API. Keep the subjects exactly as configured unless product copy changes:

- Invite: `You're invited to Bot Combinator`
- Magic link: `Your secure Bot Combinator sign-in link`

Brevo remains the SMTP delivery provider configured in Supabase. Auth links continue to be generated and verified by Supabase.

To update only these four hosted Auth fields without pushing unrelated local Auth settings:

```bash
SUPABASE_ACCESS_TOKEN=your-personal-access-token \
SUPABASE_PROJECT_REF=your-project-ref \
pnpm --filter @bot-combinator/portal deploy:emails
```

The deployment script never prints the access token and does not modify SMTP, redirect, provider, or rate-limit settings.

Verify that the hosted subjects and HTML match the repository without changing production:

```bash
SUPABASE_ACCESS_TOKEN=your-personal-access-token \
SUPABASE_PROJECT_REF=your-project-ref \
pnpm --filter @bot-combinator/portal verify:emails
```
