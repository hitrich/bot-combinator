#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, repoRoot, writeJson } from './_lib.mjs';

const TARGETS = new Map([
  ['macos-x64', { platform: 'macos', arch: 'x64' }],
  ['macos-arm64', { platform: 'macos', arch: 'arm64' }],
  ['windows-x64', { platform: 'windows', arch: 'x64' }],
  ['windows-arm64', { platform: 'windows', arch: 'arm64' }],
  ['linux-x64', { platform: 'linux', arch: 'x64' }],
  ['linux-arm64', { platform: 'linux', arch: 'arm64' }],
]);
const TAG_STATES = new Set(['github-verified', 'unsigned', 'unverified', 'not-applicable']);

export function signingStatus(input) {
  const target = TARGETS.get(input.target);
  if (!target) throw new Error(`Unknown release target: ${input.target}`);
  if (!TAG_STATES.has(input.tagVerification)) {
    throw new Error(`Unknown tag verification state: ${input.tagVerification}`);
  }

  const allowedModes =
    target.platform === 'linux' ? new Set(['checksum-attested']) : new Set(['signed', 'unsigned']);
  if (!allowedModes.has(input.mode)) {
    throw new Error(`${input.target} cannot use release mode ${input.mode}`);
  }

  const signed = input.mode === 'signed';
  const platformTrust =
    target.platform === 'macos'
      ? {
          codeSigning: signed ? 'developer-id' : 'ad-hoc-only',
          notarization: signed ? 'apple-notarized-and-stapled' : 'none',
        }
      : target.platform === 'windows'
        ? {
            codeSigning: signed ? 'authenticode-timestamped' : 'none',
            notarization: 'not-applicable',
          }
        : {
            codeSigning: 'none-required',
            notarization: 'not-applicable',
          };

  const userNotice =
    target.platform === 'macos' && !signed
      ? 'UNSIGNED AND UNNOTARIZED: macOS Gatekeeper will not recognize an Outreachr Developer ID. Verify the SHA-256 manifest and GitHub attestation before opening.'
      : target.platform === 'windows' && !signed
        ? 'UNSIGNED: Windows SmartScreen will not recognize an Outreachr publisher. Verify the SHA-256 manifest and GitHub attestation before running.'
        : target.platform === 'linux'
          ? 'Linux package authenticity is established by the SHA-256 manifest and GitHub OIDC build attestation; a detached GPG signature may also be present.'
          : `${input.target} passed its native publisher-signature and platform-trust gates.`;

  return {
    schemaVersion: 1,
    target: input.target,
    platform: target.platform,
    arch: target.arch,
    releaseMode: input.mode,
    tag: {
      annotated: input.tagVerification !== 'not-applicable',
      githubVerification: input.tagVerification,
      reason: input.tagVerificationReason || null,
    },
    platformTrust,
    mandatoryIntegrity: ['sha256-manifest', 'github-oidc-build-attestation'],
    userNotice,
  };
}

async function main() {
  const args = parseArgs();
  const target = String(args.target ?? process.env.OUTREACHR_TARGET ?? '');
  const status = signingStatus({
    target,
    mode: String(args.mode ?? process.env.OUTREACHR_RELEASE_MODE ?? ''),
    tagVerification: String(
      args['tag-verification'] ?? process.env.OUTREACHR_TAG_VERIFICATION ?? 'not-applicable',
    ),
    tagVerificationReason: String(
      args['tag-verification-reason'] ?? process.env.OUTREACHR_TAG_VERIFICATION_REASON ?? '',
    ),
  });
  const output = path.resolve(
    String(
      args.output ?? path.join(repoRoot, 'artifacts', target, `SIGNING-STATUS-${target}.json`),
    ),
  );
  await writeJson(output, status);
  console.log(`${status.userNotice} Wrote ${output}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
