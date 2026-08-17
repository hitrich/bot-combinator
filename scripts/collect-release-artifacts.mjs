#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  copyCanonicalText,
  copyTree,
  parseArgs,
  repoRoot,
  targetId,
  walkFiles,
  writeJson,
} from './_lib.mjs';

const args = parseArgs();
const releaseDir = path.resolve(
  args['release-dir'] ?? path.join(repoRoot, 'apps', 'desktop', 'release'),
);
const target = String(args.target ?? process.env.BOT_COMBINATOR_TARGET ?? targetId());
const output = path.resolve(args.output ?? path.join(repoRoot, 'artifacts', target));
const releaseMode = String(
  args['release-mode'] ?? process.env.BOT_COMBINATOR_RELEASE_MODE ?? 'verification',
);
const extensions = new Set(['.dmg', '.zip', '.exe', '.appimage', '.deb', '.blockmap']);

if (!['signed', 'unsigned', 'checksum-provenance', 'verification'].includes(releaseMode)) {
  throw new Error(`Unknown release mode: ${releaseMode}`);
}

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
const copied = [];
for (const file of await walkFiles(releaseDir)) {
  const relativeParts = path.relative(releaseDir, file).split(path.sep);
  if (relativeParts.some((part) => /unpacked$/i.test(part) || part.endsWith('.app'))) continue;
  const extension = path.extname(file).toLowerCase();
  if (!extensions.has(extension)) continue;
  const name = distributionName(path.basename(file), releaseMode);
  if (/builder-(debug|effective-config)\.ya?ml$/i.test(name)) continue;
  if (copied.includes(name)) {
    throw new Error(`Distributable basename collision under ${releaseDir}: ${name}`);
  }
  const destination = path.join(output, name);
  await copyTree(file, destination);
  copied.push(name);
}

const required =
  process.platform === 'darwin'
    ? [['.dmg'], ['.zip']]
    : process.platform === 'win32'
      ? [['.exe']]
      : [['.appimage'], ['.deb']];
for (const alternatives of required) {
  if (!copied.some((name) => alternatives.includes(path.extname(name).toLowerCase()))) {
    throw new Error(`Missing required ${alternatives.join('/')} artifact for ${target}`);
  }
}

for (const legalFile of ['LICENSE', 'NOTICE']) {
  await copyCanonicalText(path.join(repoRoot, legalFile), path.join(output, legalFile));
}
await copyTree(
  path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'),
  path.join(output, `THIRD_PARTY_NOTICES-${target}.md`),
);
await copyTree(
  path.join(repoRoot, 'release-metadata', 'licenses.json'),
  path.join(output, `licenses-${target}.json`),
);
await writeJson(path.join(output, `build-target-${target}.json`), {
  schemaVersion: 1,
  target,
  platform: process.platform,
  arch: process.arch,
  releaseMode,
  node: process.version,
  github: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    sha: process.env.GITHUB_SHA ?? null,
    ref: process.env.GITHUB_REF ?? null,
  },
  artifacts: copied.sort(),
});
console.log(`Collected ${copied.length} distributable files in ${output}`);

function distributionName(name, mode) {
  if (mode !== 'unsigned') return name;
  const label = process.platform === 'darwin' ? 'UNSIGNED-UNNOTARIZED' : 'UNSIGNED';
  const lower = name.toLowerCase();
  for (const suffix of [
    '.dmg.blockmap',
    '.zip.blockmap',
    '.exe.blockmap',
    '.dmg',
    '.zip',
    '.exe',
  ]) {
    if (lower.endsWith(suffix))
      return `${name.slice(0, -suffix.length)}-${label}${name.slice(-suffix.length)}`;
  }
  return name;
}
