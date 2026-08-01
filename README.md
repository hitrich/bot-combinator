# Outreachr

Outreachr is a free, open-source, local-first fundraising operating system for founders raising pre-seed, seed, or Series A rounds. It combines an evidence-backed investor graph with target ranking, warm-path planning, approval-bound email, meetings, diligence, and a live round pipeline.

## Guarantees

- All canonical user and product data stays in one founder-owned SQLite vault.
- Secrets are encrypted with the operating system credential facility, never stored as plaintext in SQLite.
- Gmail/Google Calendar and Outlook/Microsoft Calendar use founder-created desktop OAuth credentials.
- Initial outreach cannot be sent twice to the same canonical person.
- A founder pause switch, daily and hourly hard limits, recipient-domain daily/cooldown pacing, an exact visible sender-address/opt-out footer, and global/email/domain/person/firm suppressions are enforced by SQLite triggers before provider I/O.
- Mailbox relationship sync is optional for research-only use and required before sending. It exhausts provider history, stores header-only known-relationship events plus unmatched outbound observations for later reconciliation, discards unrelated inbound mail, and detects prior outreach, replies, hard bounces, complaints, and unsubscribe requests. An uncertain provider response remains non-retryable; only an exact, authoritative sent-mail observation carrying Outreachr's operation key can confirm that original reservation as sent.
- Security-relevant activity is append-only and SHA-256 hash-chained for local verification and export.
- Codex and Claude integrations operate through explicit local tools and founder-visible proposals.
- No hosted account, subscription, paid feed, or bundled model is required.
- macOS, Windows, and Linux are release-blocking targets, including x64 and arm64.

## Repository layout

- `apps/desktop` — Electron main process, secure preload bridge, React product UI, and Playwright Electron tests.
- `packages/core` — SQLite schema, repositories, migrations, seed/contribution handling, and domain safety invariants.
- `packages/connectors` — provider-neutral mail/calendar contracts plus Google and Microsoft adapters and MSW contract tests.
- `packages/agents` — Codex and Claude Agent SDK/MCP adapters with proposal-only external actions.
- `packages/mcp` — typed, host-filterable local MCP server used by the authenticated desktop bridge and optional stdio hosts.
- `resources` — immutable seed data and machine-readable rights metadata.
- `docs` — architecture, credentials, privacy, threat model, and release runbooks.

## Development

```bash
corepack enable
corepack prepare pnpm@11.18.0 --activate
pnpm install
pnpm dev
```

The development lifecycle prepares the pinned seed and sql.js WASM runtime automatically. No native SQLite compiler is required.

Run the complete local verification gate with:

```bash
pnpm verify
pnpm test:e2e
```

Tests never require production provider credentials. Start with:

- [User guide](docs/user-guide.md)
- [Google and Microsoft credentials](docs/credentials.md)
- [Codex and Claude agents](docs/agents.md)
- [Architecture](docs/architecture.md)
- [Privacy and threat model](docs/privacy-and-threat-model.md)
- [Investor-data contributions](docs/data-contributions.md)
- [Testing](docs/testing.md)
- [Release runbook](docs/release.md)

Prepare a local distributable with `pnpm package`. The zero-cost public release path uses SHA-256 manifests and GitHub OIDC attestations on every platform; optional complete Apple/Windows credential groups add native publisher trust. Unsigned artifacts are labeled and disclosed as documented in `.github/RELEASE_CHECKLIST.md`.

## License

First-party code and project-authored documentation are Apache-2.0. Investor data has source-specific rights recorded in its package manifest and is not automatically Apache-licensed.
