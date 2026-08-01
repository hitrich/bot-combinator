#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, repoRoot, run } from './_lib.mjs';

const args = parseArgs();
const manifest = await readJson(path.join(repoRoot, 'package.json'));
const desktopManifest = await readJson(path.join(repoRoot, 'apps', 'desktop', 'package.json'));
const tag = String(args.tag ?? process.env.GITHUB_REF_NAME ?? '');
const allowUnverifiedTag =
  args['allow-unverified-tag'] === true || args['allow-unverified-tag'] === 'true';
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`Release tag must be a semantic v* tag; received ${tag || '(empty)'}`);
}
if (tag !== `v${manifest.version}`) {
  throw new Error(`Tag ${tag} does not match package version v${manifest.version}`);
}
if (desktopManifest.version !== manifest.version) {
  throw new Error(
    `Desktop version ${desktopManifest.version} does not match root release version ${manifest.version}`,
  );
}
const objectType = await run('git', ['cat-file', '-t', tag]);
if (objectType.stdout.trim() !== 'tag')
  throw new Error(`${tag} is a lightweight tag; releases require an annotated tag`);
const contents = await run('git', ['cat-file', '-p', tag]);
const containsSignature = /-----BEGIN (?:PGP|SSH) SIGNATURE-----/.test(contents.stdout);
if (!containsSignature && !allowUnverifiedTag) {
  throw new Error(`${tag} does not contain a PGP or SSH tag signature`);
}
const taggedCommit = (await run('git', ['rev-list', '-n', '1', tag])).stdout.trim();
const mainCommit = (await run('git', ['rev-parse', 'refs/remotes/origin/main'])).stdout.trim();
if (taggedCommit !== mainCommit) {
  throw new Error(`${tag} points to ${taggedCommit}, but protected origin/main is ${mainCommit}`);
}
const requiredFiles = [
  'LICENSE',
  'NOTICE',
  'SECURITY.md',
  'THIRD_PARTY_NOTICES.md',
  'pnpm-lock.yaml',
];
for (const relative of requiredFiles) {
  const stat = await fs.stat(path.join(repoRoot, relative));
  if (!stat.isFile() || stat.size === 0)
    throw new Error(`Release prerequisite is missing or empty: ${relative}`);
}
console.log(
  `${tag} matches both application versions, points to protected main, and is annotated (${containsSignature ? 'tag signature present' : 'unsigned tag accepted by explicit policy'}).`,
);
console.log(
  'GitHub cryptographic tag verification is enforced separately through the GitHub API release preflight.',
);
