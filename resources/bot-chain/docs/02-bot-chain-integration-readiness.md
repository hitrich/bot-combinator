# BOT Chain integration readiness

Status: preview guidance

This document defines evidence categories, not production configuration values.

## Required evidence

- Target environment and authoritative environment source.
- Verified chain/network identifier and RPC/explorer source.
- Current application network configuration.
- Contract/token standards required by the selected use case.
- Wallet connection, account, network-switch, rejection, and recovery behavior.
- Test evidence separated into mock/local, testnet, and production verification.
- Deployment and rollback owner.

## Readiness states

- `not_started` — scope/evidence not prepared.
- `in_progress` — implementation or verification underway.
- `blocked` — missing decision, source, dependency, or failed validation.
- `ready_for_test` — implementation is reviewable but not team-verified in the target environment.
- `verified_by_team` — designated project reviewer recorded current evidence.

Do not mark the integration verified solely because a configuration value exists or a mock test passes.
