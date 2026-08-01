# Investor-data contributions

The bundled database is a research seed, not a claim that every source permits unrestricted republication. It contains 167 institutional firms and 25 independent angels, solo GPs, scouts, or family offices. Each independent investor is represented as both a targetable investor entity and a linked person profile so that firm-level pipeline work and person-level contact safety stay consistent.

Seed evidence is row-level rather than field-level. Outreachr retains exact source links for identity and contact URLs when the source relation and canonical URL both match. General claims, portfolio examples, and named-partner rows remain unattributed when the seed does not identify a supporting source; Outreachr never substitutes the first or lexicographically smallest entity source. Unknown provenance stays unknown.

## What may be contributed

- public professional firm and investor facts;
- sourced public professional work email addresses when necessary and legally redistributable;
- tags, selected portfolio examples, check evidence, stages, geography, and named partners with attribution;
- corrections, merges, and freshness updates backed by sources.

## What must never be contributed

- personal email addresses or phone numbers;
- who the founder emailed, replies, drafts, approvals, receipts, suppressions, sender postal/footer policy, meetings, attendees, tasks, private notes, relationship graphs, expected checks, diligence, documents, connector configuration, credentials, agent runs, or audit history;
- content obtained under a license or site policy that prohibits redistribution.

## Workflow

1. Research or import into a private local vault.
2. Mark only reviewed public records contribution-eligible and attach rights metadata.
3. Run **Export public contribution**.
4. Review the generated human-readable diff and SQLite package.
5. Run integrity, foreign-key, secret, privacy-table, source, and deterministic-digest checks.
6. Submit the small contribution artifact; never submit the founder vault.

The contribution manifest uses SPDX `NOASSERTION`: every included source retains
its own rights and attribution metadata, and exporting a contribution does not
relicense upstream facts. Outreachr application code remains Apache-2.0.

The exporter is fail-closed and constructs a new schema from an allowlist. New private tables do not become exportable by default.
