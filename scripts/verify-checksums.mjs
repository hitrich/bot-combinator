#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { exists, parseArgs, repoRoot, sha256File } from './_lib.mjs';

const args = parseArgs();
const manifest = path.resolve(args.manifest ?? path.join(repoRoot, 'SHA256SUMS'));
const directory = path.dirname(manifest);
const lines = (await fs.readFile(manifest, 'utf8')).split(/\r?\n/).filter(Boolean);
if (!lines.length) throw new Error(`Checksum manifest is empty: ${manifest}`);
for (const line of lines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/i.exec(line);
  if (!match) throw new Error(`Malformed checksum line in ${manifest}: ${line}`);
  const target = path.resolve(directory, ...match[2].split('/'));
  if (!target.startsWith(`${directory}${path.sep}`))
    throw new Error(`Unsafe checksum path: ${match[2]}`);
  if (!(await exists(target))) throw new Error(`Checksummed file is missing: ${target}`);
  const actual = await sha256File(target);
  if (actual !== match[1].toLowerCase()) throw new Error(`Checksum mismatch: ${target}`);
}
console.log(`Verified ${lines.length} checksums from ${manifest}`);
