# Release runbook

1. Confirm the working tree contains only intended source, generated legal notices, lockfile, seed manifest, icons, tests, and documentation.
2. Run `pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm test:e2e`, `pnpm prepare:resources`, the native package command, hardened Electron-fuse verification, and packaged smoke/resource verification.
3. Verify `package.json` and `apps/desktop/package.json` versions match the intended semantic tag.
4. Review `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`, seed rights status, SBOM, and release checklist.
5. For the private repository on GitHub Free, enable Actions, require full-length SHA pinning, set the default `GITHUB_TOKEN` permission to read-only, and disable workflow pull-request approvals. Selected third-party action patterns, CodeQL uploads, artifact attestations, protected branches/tags, and protected environment secrets are unavailable on this plan, so the workflow does not pretend to enforce them.
6. Push the initial `main` commit and wait for the hosted verification workflow's exact `All native targets` check to pass. The aggregate check includes all six native builds plus the quality/security gate.
7. Enable immutable releases before the first release tag is pushed and read the setting back through the GitHub API. Private drafts remain editable until publication; published release assets become immutable.
8. Optional complete hosted macOS Developer ID/notarization or Windows Authenticode groups stored as repository Actions secrets automatically upgrade that platform. Absent groups produce conspicuously labeled unsigned artifacts; the macOS baseline has only a free ad-hoc execution signature and no publisher trust. Partial groups fail.
9. Create a GitHub-verified SSH- or GPG-signed annotated semantic tag such as `v0.1.2` at current `main`, and push it. The verified signature compensates for tag rulesets being unavailable on the private Free plan.
10. Watch all six target-native jobs. Do not approve publication when any package, trust disclosure, resource, checksum, local provenance, SBOM, or smoke check fails.
11. Confirm the workflow uploaded a private draft, downloaded and compared every asset byte-for-byte, published it, proved GitHub marked the release immutable, and downloaded and compared every immutable repository asset again.
12. Download the assets while authenticated as an authorized repository member, inspect `SIGNING-STATUS-<target>.json`, verify the corresponding SHA-256 manifest and local provenance, install, complete a clean-vault launch, and record the result. Expect Gatekeeper/SmartScreen warnings only for explicitly unsigned files.

Release automation cannot create vendor certificates, a GitHub remote, repository protections, or a hosted release without the maintainer’s external accounts. Paid publisher certificates are optional distribution-trust upgrades, never application runtime requirements.

## Local macOS Developer ID release

An eligible `Developer ID Application` certificate installed by Xcode can sign Bot Combinator on that Mac. The Xcode account is not itself a signing credential: the certificate’s private key lives in that Mac’s Keychain, and a GitHub-hosted runner has a separate, temporary Keychain. The local route therefore uses the installed identity directly; the hosted route above continues to require the portable `.p12` secret group.

Configure notarization once with Apple’s interactive credential prompt. The command stores the resulting credentials in Keychain; it does not put the app-specific password in shell history:

```bash
xcrun notarytool store-credentials "bot-combinator-notary" \
  --apple-id "YOUR_APPLE_ID" \
  --team-id "ABCDE12345"
```

Then select the exact Developer ID identity and expected Team ID for each local release:

```bash
export BOT_COMBINATOR_MAC_KEYCHAIN_IDENTITY="Developer ID Application: YOUR NAME (ABCDE12345)"
export BOT_COMBINATOR_MAC_EXPECTED_TEAM_ID="ABCDE12345"
export BOT_COMBINATOR_APPLE_KEYCHAIN_PROFILE="bot-combinator-notary"
pnpm release:mac:local
node scripts/verify-code-signing.mjs --expect signed --release-dir apps/desktop/release
```

Use the identity’s 40-character SHA-1 fingerprint instead of its name if more than one valid certificate has the same name. For a non-default Keychain, add `--keychain "/absolute/path/to/custom.keychain-db"` to `notarytool store-credentials` and set `BOT_COMBINATOR_APPLE_KEYCHAIN` to that same absolute path; the same Keychain must contain both the signing private key and the named notarization profile.

The preflight calls `security find-identity -v -p codesigning`, requires an exact identity match, rejects Apple Development certificates, and verifies the certificate name’s Team ID against `BOT_COMBINATOR_MAC_EXPECTED_TEAM_ID` before building. The DMG and app are submitted with the named `notarytool` profile and stapled. Local Keychain mode is deliberately mutually exclusive with `BOT_COMBINATOR_MAC_CERTIFICATE_*`, App Store Connect API-key variables, and Apple ID/password release variables; mixed configuration fails instead of choosing credentials implicitly.

`release:mac:local` creates and notarizes native-architecture artifacts only and never publishes them. Publishing all desktop targets still goes through the signed-tag workflow. To let hosted macOS runners sign, a maintainer must separately export a password-protected Developer ID `.p12` and configure the repository Actions secrets; do not upload a local Keychain or an unencrypted private key.
