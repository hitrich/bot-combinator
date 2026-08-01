#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs, repoRoot, run } from './_lib.mjs';

const args = parseArgs();
const root = path.resolve(args.directory ?? path.join(repoRoot, 'release-assets'));
const repository = String(args.repo ?? process.env.GITHUB_REPOSITORY ?? '');
const sourceRef = String(args.ref ?? process.env.GITHUB_REF ?? '');
const sourceDigest = String(args['source-digest'] ?? process.env.GITHUB_SHA ?? '').toLowerCase();
if (!/^[^/]+\/[^/]+$/.test(repository))
  throw new Error(`Invalid GitHub repository identity: ${repository}`);
if (!sourceRef.startsWith('refs/tags/v'))
  throw new Error(`Attestation source must be a v* tag ref: ${sourceRef}`);
if (!/^[a-f0-9]{40}$/.test(sourceDigest))
  throw new Error(`Attestation source digest must be the exact 40-character Git commit SHA`);
const signerWorkflow = `${repository}/.github/workflows/release.yml`;
const targets = [
  'macos-x64',
  'macos-arm64',
  'windows-x64',
  'windows-arm64',
  'linux-x64',
  'linux-arm64',
];

for (const target of targets) {
  const directory = path.join(root, `outreachr-${target}`);
  const bundle = path.join(directory, `outreachr-${target}.attestation.intoto.jsonl`);
  const lines = (await fs.readFile(path.join(directory, `SHA256SUMS-${target}`), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean);
  const subjects = [];
  const seen = new Set();
  for (const line of lines) {
    const match = /^[a-f0-9]{64} {2}([^/]+)$/i.exec(line);
    if (!match) throw new Error(`Unsafe checksum subject in ${target}: ${line}`);
    if (seen.has(match[1]))
      throw new Error(`Duplicate attestation subject in ${target}: ${match[1]}`);
    seen.add(match[1]);
    subjects.push(match[1]);
  }
  subjects.push(`SHA256SUMS-${target}`);
  for (const subject of subjects) {
    await run(
      'gh',
      [
        'attestation',
        'verify',
        path.join(directory, subject),
        '--repo',
        repository,
        '--bundle',
        bundle,
        '--signer-workflow',
        signerWorkflow,
        '--source-ref',
        sourceRef,
        '--source-digest',
        sourceDigest,
        '--deny-self-hosted-runners',
      ],
      { capture: false, timeoutMs: 60_000 },
    );
  }
  console.log(`Cryptographically verified ${subjects.length} attested subjects for ${target}.`);
}
