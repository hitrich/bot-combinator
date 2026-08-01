# `@outreachr/core`

The local domain and data layer for Outreachr. It runs SQLite through `sql.js` WebAssembly, so the same database implementation works in packaged Electron builds on macOS, Windows, and Linux without a native Node add-on or platform-specific ABI rebuild.

The package is Apache-2.0. Investor facts retain the rights and attribution requirements recorded on their sources; exporting a contribution never overrides source terms.

## What it owns

- One canonical local SQLite vault for the founder profile, fundraising rounds, investor firms, people, funds, evidence claims, sources, tags, targets, and pipeline history.
- Drafts, exact-content approvals, sender/opt-out footer rules, communication pause/daily/hourly/domain limits, suppressions, attributed mailbox relationship events, a pre-dispatch send reservation ledger, meetings, tasks, notes, knowledge, lists, connector references, agent runs/proposals, and an append-only hash-chained audit log.
- Versioned, transactional migrations with foreign-key and integrity checks.
- Import of immutable Outreachr investor seed databases with pinned-digest handling for unsigned research artifacts.
- Deterministic contribution SQLite packages containing only an explicit public-data allowlist.
- Password-encrypted, authenticated backup envelopes with lifecycle hooks for desktop integration.

The package does **not** store OAuth tokens, provider credentials, API keys, or backup passphrases. `connector_configs.secret_ref` accepts only an opaque approved reference (`keychain://`, `credential-manager://`, `secret-service://`, `secure-store://`, `external-agent://`, or test-only `memory://`). The Electron main process must fail closed when its platform secret store is unavailable.

## Install and load SQLite

```ts
import { openNodeVault } from '@outreachr/core/node';
import { OutreachrRepository } from '@outreachr/core';

const vault = await openNodeVault({ bytes: existingBytes });
const repository = new OutreachrRepository(vault);
```

`openNodeVault` resolves the packaged `sql-wasm.wasm` file for Node/Electron. Browser-style bundlers can supply their own asset location:

```ts
import { CoreVault, initializeSqlite } from '@outreachr/core';

const sqlite = await initializeSqlite({
  locateFile: () => new URL('./sql-wasm.wasm', import.meta.url).toString(),
});
const vault = new CoreVault(sqlite, { bytes: existingBytes });
```

Persist `vault.export()` through an atomic temp-file + rename operation in the Electron main process. Close the vault on clean shutdown. Renderer processes should call a narrow, validated IPC API and never receive the raw database or unrestricted SQL access.

## Safe outbound-message protocol

Sending is intentionally a two-phase operation:

1. Save a draft with `createMessageDraft`.
2. Show its exact recipient, subject, body, and attachment hashes to the founder.
3. Configure the founder postal address/opt-out text and ensure the body visibly contains both, then call `approveMessage`. The approval hash binds the exact delivery fields and body; message edits or a communication-policy change revoke active approval in database triggers.
4. Ensure the recipient is linked to one canonical person record. Unlinked addresses cannot be reserved because person-level lifetime deduplication would be impossible.
5. Call `reserveApprovedSend` **before** the Gmail or Microsoft Graph request. Database triggers re-check the active approval, exact visible footer, initial-only unthreaded/attachment-free structure, pause state, daily/hourly/domain pacing, synced prior outbound metadata, and all global/email/domain/person/firm suppressions.
6. Call `markDispatchStarted` immediately before making the provider request.
7. On a definitive provider success, call `markSendSucceeded`.
8. On a timeout or indeterminate provider response, call `markSendAmbiguous` and do not retry automatically.
9. `markFailedBeforeDispatch` is valid only when no provider request began.

Unique indexes on normalized recipient address and person ID make “contact a person at most once” a vault invariant, including reserved, ambiguous, and pre-dispatch-failed attempts. Deleting, manually releasing, or manually marking ledger records sent is deliberately absent from this API. An ambiguous reservation can transition to sent only when `reconcileUnconfirmedSendFromMailbox` validates an exact, authoritative outbound sent-mail observation with the same provider, operation key, sole normalized recipient, subject, and bounded timestamp. The global communication policy independently enforces a founder pause, daily and hourly limits, per-recipient-domain daily/cooldown pacing, and an exact founder-controlled sender postal address plus opt-out sentence. Policy changes revoke active approvals.

Provider relationship sync is metadata-minimizing: callers store header-only messages attributed to known people or known provider threads and unmatched outbound observations needed to reconcile a contact added later. Unrelated inbound mail, bodies, and attachments are discarded. Synced outbound events block another initial; hard-bounce, complaint, and unsubscribe triggers create non-deactivatable person suppressions. Stock 0.1 allows only an `initial` message into the send ledger. `audit_log` and `audit_chain` are append-only, and `verifyAuditChain` recalculates every link.

## Investor seed import

```ts
import { importInvestorSeed } from '@outreachr/core';

const result = importInvestorSeed(vault.sqlite, vault, seedBytes, {
  importedAt: new Date().toISOString(),
  expectedLogicalDigest: '<release-manifest logical digest>',
  expectedFileSha256: '<release-asset SHA-256>',
});
```

The importer independently regenerates the seed's canonical logical digest before reading any data. Unsigned research seeds require a pinned logical/file digest or the explicit `allowUnsignedResearch: true` development opt-in. A manifest's `signature_status` string is never trusted as cryptographic proof; a future signed release must supply a `verifySignature` callback. Imports are transactional and idempotent by package ID and digest. Existing canonical URLs and tags are reused, and a package ID can never silently change to a different digest.

Seed assertions are local research material by default. They are imported as public but not contribution-eligible. A founder or maintainer must make a separate rights decision before including an assertion in a public contribution.

## Contribution export and privacy boundary

```ts
import { exportContribution } from '@outreachr/core';

const contribution = exportContribution(vault.sqlite, vault, {
  packageId: 'contribution:github-user:2026-07-31',
  packageVersion: '1.0.0',
  contributor: 'github-user',
});
```

The result is a deterministic SQLite file plus a logical SHA-256 digest. Re-running against unchanged eligible data produces the same bytes. The export schema has an allowlist, not a denylist:

- included: explicitly public and contribution-eligible firms, people, funds, sourced claims, tags, and sourced public **work** emails;
- source requirement: referenced sources must be marked `allowed` or `attribution_required`;
- excluded: founder identity, fundraising rounds, targets, pipeline activity, drafts, approvals, recipients, send history, suppressions, meetings, tasks, notes, knowledge, lists, connector configuration, secret references, agent activity, and audit history;
- never included: personal email addresses, even if a caller accidentally marks one contribution-eligible (validation and a SQL `CHECK` both reject that state).

The contribution manifest states this boundary. Review and CI should still inspect the package, validate its logical digest, run secret/PII scanners, and require maintainer approval before merging it into a signed seed release.

## Encrypted backups

```ts
import { createEncryptedBackup, restoreEncryptedBackup } from '@outreachr/core';

const envelope = await createEncryptedBackup(vault.export(), passphrase, {
  hooks: {
    beforeEncrypt: () => suspendWrites(),
    afterEncrypt: () => resumeWrites(),
  },
});

const restoredBytes = await restoreEncryptedBackup(envelope, passphrase);
```

The versioned envelope uses scrypt (`N=32768, r=8, p=1`) and AES-256-GCM with random 256-bit salt, 96-bit IV, fixed format AAD, and a post-decryption SQLite SHA-256 check. Authentication failures are terminal; never try to open unauthenticated plaintext. Desktop callers should write envelopes atomically and avoid logging passwords, envelope payloads, or decrypted bytes.

## Validation and tests

All public repository inputs cross a Zod boundary before SQL. The schema then independently enforces foreign keys, enums, numeric bounds, public-work-email eligibility, approvals, suppression, and duplicate-contact constraints.

```sh
npm install
npm run typecheck
npm test
npm run build
```

The test suite covers migration/reopen integrity, representative seed import and digest pinning, exact approval hashing and edit revocation, person/address duplicate prevention, database-level suppression, deterministic contribution privacy, and authenticated backup/restore. It also imports the project’s full research seed during release verification outside the hermetic unit suite.

## Migration policy

`PRAGMA user_version` is the authoritative schema version. Each migration is append-only, sequential, and applied inside `BEGIN IMMEDIATE`. Never edit a released migration: add a new version, migration test fixture, rollback/recovery note, and cross-platform package test. The vault refuses to open a schema newer than the running app understands.
