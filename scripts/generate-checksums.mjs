#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { hashManifest, parseArgs, repoRoot, targetId } from './_lib.mjs';

const args = parseArgs();
const directory = path.resolve(
  args.directory ?? path.join(repoRoot, 'artifacts', String(args.target ?? targetId())),
);
const output = path.resolve(args.output ?? path.join(directory, 'SHA256SUMS'));
const outputRelative = path.relative(directory, output).split(path.sep).join('/');
const rows = await hashManifest(directory, { exclude: [outputRelative] });
if (!rows.length) throw new Error(`No files found to checksum under ${directory}`);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(
  output,
  `${rows.map((item) => `${item.sha256}  ${item.path}`).join('\n')}\n`,
  'utf8',
);
console.log(`Wrote ${rows.length} checksums to ${output}`);
