# Architecture

## Trust boundary

The Electron main process is the only authority that opens the SQLite vault, stores credentials, calls providers, launches local agents, or resolves local paths. The renderer has no Node integration, runs with context isolation and sandboxing, and receives a frozen, allowlisted preload bridge. Navigation, new windows, permissions, and external protocols are denied by default.

## Components

- `apps/desktop`: Electron main process, CommonJS sandbox preload, React renderer, desktop integration tests, and packaging.
- `packages/core`: SQL.js SQLite migrations, validated repositories, backups, seed import, contribution export, approvals, suppression, and send ledger.
- `packages/connectors`: provider-neutral mail/calendar interfaces, OAuth PKCE, Gmail/Google Calendar, and Microsoft Graph.
- `packages/agents`: Codex app-server and Claude Agent SDK adapters with a fail-closed proposal-only policy.
- `packages/mcp`: local stdio MCP server with 19 typed read/proposal tools and record-level redaction.
- `resources`: pinned investor seed and rights manifest.

## Storage

The canonical file is `outreachr.sqlite` under Electron’s per-user application data directory. SQL.js loads it into memory and persistence exports to a mode-`0600` temporary file followed by an atomic rename. Foreign keys and migrations run on every open. File handles are stat-checked before bounded reads: local vaults and encrypted backups are capped at 512 MiB, while seed imports are capped at 256 MiB. Backup restore validates integrity before the current vault is replaced.

All first-party private state is in SQLite. External documents remain where the founder placed them. OAuth ciphertext is also in SQLite, encrypted with an operating-system key that does not live in the database.

## Email state machine

`draft → approved → reserved → dispatching → sent | ambiguous`

Approval is bound to a deterministic content hash. Before approval, SQLite requires the body to visibly contain the exact founder-configured postal address and opt-out wording; stock 0.1 initials must be unthreaded and attachment-free. Any communication-policy/footer change revokes active approvals. A transaction then inserts a unique send reservation for both normalized address and canonical person. SQLite independently rechecks the footer and structure, pause state, daily/hourly limits, recipient-domain daily/cooldown pacing, suppressions, and synced prior outreach. The connector claims the reservation by atomically moving it to dispatching before network I/O. Definitive provider identifiers and thread IDs mark success. Network or provider ambiguity after dispatch is terminal and blocks automatic retry. The only later transition from `dispatching` or `ambiguous` to `sent` validates an exact Outreachr operation key against an authoritative provider sent-mail observation, including provider, sole normalized recipient, subject, and a bounded provider timestamp; it never issues another send.

## Mail relationship state

Relationship sync is optional for research-only use and required for provider sending. The initial reconciliation exhausts all provider pages, persists resumable progress separately from the completion cursor, and fails closed on errors or token loops. Contact-identity changes force a full rescan; otherwise an overlap cursor drives incremental reconciliation. Messages are deduplicated by provider/message ID. Known-contact/thread headers and unmatched outbound headers enter `mail_events`; unrelated inbound mail does not. Gmail `SENT` labels and the Microsoft sent-items stream establish alias-safe outbound direction. Their exact operation-key observations may confirm a matching unconfirmed Outreachr send; inbound or non-authoritative observations cannot. Inbound replies become review work; hard-bounce, complaint, and unsubscribe triggers activate non-deactivatable person suppressions. Bodies and attachments never enter this flow.

## Calendar state

Provider events are keyed by `provider:event-id`. Sync is idempotent, paginated, and bounded. Provider fields refresh while private notes survive. Before event creation, every selected person must resolve to one unique, valid email; failure occurs before provider I/O. Connector adapters project local attendee records to name/email, so canonical person IDs never enter provider requests. SQLite attendee JSON retains those IDs for durable relationships, while legacy rows without IDs remain readable through normalized-email reconciliation.

## Data separation

Public research and founder-private workflow use the same transactional database but explicit visibility/contribution flags. Contribution export creates a new SQLite artifact from a public allowlist; it never copies private tables and emits a deterministic digest plus review diff.

## Agent state

Agents receive serialized context records, not a database handle. Access policies are bounded by provider, purpose, context class, record IDs, and capabilities. Child processes receive only a small allowlist of platform, locale, proxy, TLS, vendor-home, and relevant vendor-authentication environment variables rather than the founder's whole environment. Runs and proposals are audited in SQLite; external actions remain outside the agent capability set.

## Audit state

Every repository security event appends to `audit_log` and a corresponding `audit_chain` row inside one savepoint. Each hash commits to the complete canonical event and previous hash. Update/delete triggers make both tables append-only; verification reports the first broken sequence and CSV export retains both hashes.
