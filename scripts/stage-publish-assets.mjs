#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { copyTree, parseArgs, readJson, repoRoot, sha256File, walkFiles } from './_lib.mjs';

const args = parseArgs();
const input = path.resolve(args.input ?? path.join(repoRoot, 'release-assets'));
const output = path.resolve(args.output ?? path.join(repoRoot, 'publish-assets'));
const targets = [
  'macos-x64',
  'macos-arm64',
  'windows-x64',
  'windows-arm64',
  'linux-x64',
  'linux-arm64',
];
const allowed =
  /(?:\.(?:dmg|zip|exe|appimage|deb|blockmap|asc|json|jsonl|sha256|md|txt)|SHA256SUMS-[a-z0-9-]+|LICENSE|NOTICE)$/i;
const seen = new Map();

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const target of targets) {
  const directory = path.join(input, `outreachr-${target}`);
  for (const file of await walkFiles(directory)) {
    const name = path.basename(file);
    if (!allowed.test(name)) continue;
    const digest = await sha256File(file);
    if (seen.has(name)) {
      if (seen.get(name) !== digest)
        throw new Error(`Release asset name collision with different contents: ${name}`);
      continue;
    }
    seen.set(name, digest);
    await copyTree(file, path.join(output, name));
  }
}

const requiredUnique = [
  'LICENSE',
  'NOTICE',
  ...targets.flatMap((target) => [
    `THIRD_PARTY_NOTICES-${target}.md`,
    `licenses-${target}.json`,
    `build-target-${target}.json`,
    `outreachr-${target}.cdx.json`,
    `outreachr-${target}.provenance.json`,
    `outreachr-${target}.attestation.intoto.jsonl`,
    `outreachr-${target}.attestation.intoto.jsonl.sha256`,
    `SHA256SUMS-${target}`,
    `SIGNING-STATUS-${target}.json`,
  ]),
];
for (const name of requiredUnique) {
  if (!seen.has(name)) throw new Error(`Staged release is missing ${name}`);
}
for (const target of targets) {
  for (const checksumName of [
    `SHA256SUMS-${target}`,
    `outreachr-${target}.attestation.intoto.jsonl.sha256`,
  ]) {
    const lines = (await fs.readFile(path.join(output, checksumName), 'utf8'))
      .split(/\r?\n/)
      .filter(Boolean);
    for (const line of lines) {
      const match = /^([a-f0-9]{64}) {2}([^/]+)$/i.exec(line);
      if (!match) throw new Error(`Unsafe or malformed line in ${checksumName}: ${line}`);
      const publishedFile = path.join(output, match[2]);
      if ((await sha256File(publishedFile)) !== match[1].toLowerCase()) {
        throw new Error(`Flattened release checksum mismatch for ${match[2]}`);
      }
    }
  }
}

const trustSummary = await releaseTrustSummary(output, targets);
await fs.writeFile(path.join(output, 'RELEASE-TRUST.md'), trustSummary, 'utf8');
console.log(
  `Staged ${seen.size} uniquely named GitHub release assets plus RELEASE-TRUST.md in ${output}`,
);

async function releaseTrustSummary(directory, releaseTargets) {
  const rows = [];
  let hasUntrustedPlatformPackage = false;
  for (const target of releaseTargets) {
    const status = await readJson(path.join(directory, `SIGNING-STATUS-${target}.json`));
    if (status.releaseMode === 'unsigned') hasUntrustedPlatformPackage = true;
    rows.push(
      `| ${target} | ${status.releaseMode} | ${status.platformTrust.codeSigning} | ${status.platformTrust.notarization} | ${status.tag.githubVerification} |`,
    );
  }
  return [
    '# Verify this Outreachr release',
    '',
    hasUntrustedPlatformPackage
      ? '> **Platform warning:** One or more macOS/Windows packages are explicitly **UNSIGNED**. Unsigned macOS packages are also **UNNOTARIZED**. Their filenames and status manifests say so; expect Gatekeeper or SmartScreen warnings.'
      : '> All macOS and Windows packages passed their native publisher-signature gates.',
    '',
    'Every target, signed or unsigned, is release-blocked on its SHA-256 manifest and GitHub OIDC build attestation. Verify both before installing.',
    '',
    '| Target | Release mode | Code signing | Notarization | Tag verification |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'See each `SIGNING-STATUS-<target>.json` asset for the machine-readable disclosure.',
    '',
  ].join('\n');
}
