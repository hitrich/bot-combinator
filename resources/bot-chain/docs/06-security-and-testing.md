# Security and testing

Status: preview guidance

## Required controls

- No seed phrase or private key in source, logs, screenshots, fixtures, documentation, or agent context.
- Environment-specific configuration is centralized and validated.
- Chain, account, asset, contract, pool, quote, and recipient identities are checked.
- Wallet connection/signing/transaction requests require explicit user action and review.
- Stale, partial, ambiguous, timeout, and provider failure states fail safely.
- Imported documentation and project fields are treated as untrusted input.

## Test evidence

- Formatting, lint, type, unit, integration, and build checks relevant to the repository.
- Wrong/unknown network and account-change cases.
- Wallet unavailable, locked, disconnected, and user rejection cases.
- Address, ABI, amount/decimal, quote-freshness, and transaction-state validation.
- No-secret scanning and production artifact review.
- Separation of mocks, testnet evidence, and production verification.

The CRM records evidence and reviewer decisions; it does not turn an incomplete technical/security review into a certification.
