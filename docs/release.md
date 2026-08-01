# Release runbook

1. Confirm the working tree contains only intended source, generated legal notices, lockfile, seed manifest, icons, tests, and documentation.
2. Run `pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm test:e2e`, `pnpm prepare:resources`, the native package command, hardened Electron-fuse verification, and packaged smoke/resource verification.
3. Verify `package.json` and `apps/desktop/package.json` versions match the intended semantic tag.
4. Review `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, seed rights status, SBOM, and release checklist.
5. For a new repository, enable Actions with full-length SHA pinning required, allow GitHub-owned actions plus only the pinned `softprops/action-gh-release` community action, set the default `GITHUB_TOKEN` permission to read-only, and disable workflow pull-request approvals. Then push the initial `main` commit and wait for the hosted verification and CodeQL workflows to register and pass the exact `All native targets` and `JavaScript and TypeScript` check contexts.
6. Before pushing a release tag, create the `production-release` environment with a custom `v*` tag deployment policy, activate the maintainer-bypass `v*` tag ruleset, activate `main` protection with both exact required checks, enable immutable releases, and read every setting back through the GitHub API. Immutable releases must be enabled before v0.1.0 because the setting applies only to future releases; private drafts remain editable until publication.
7. Optional complete macOS Developer ID/notarization or Windows Authenticode secret groups in `production-release` automatically upgrade that platform. Absent groups produce conspicuously labeled unsigned artifacts; the macOS baseline has only a free ad-hoc execution signature and no publisher trust. Partial groups fail.
8. Create an annotated semantic tag such as `v0.1.0` at protected current `main`, and push it. A GitHub-verified SSH/GPG signature is stronger but is not required for the zero-cost path.
9. Watch all six target-native jobs. Do not approve publication when any package, trust disclosure, resource, checksum, provenance, attestation, or smoke check fails.
10. Confirm the workflow uploaded a private draft, downloaded and compared every asset byte-for-byte, published it, proved GitHub marked the release immutable, and downloaded and compared every immutable public asset again.
11. Download the public assets on each operating system, inspect `SIGNING-STATUS-<target>.json`, verify the corresponding SHA-256 manifest and GitHub attestation, install, complete a clean-vault launch, and record the result. Expect Gatekeeper/SmartScreen warnings only for explicitly unsigned files.

Release automation cannot create vendor certificates, a GitHub remote, repository protections, or a hosted release without the maintainer’s external accounts. Paid publisher certificates are optional distribution-trust upgrades, never application runtime requirements.
