#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { copyTree, parseArgs, sha256File } from './_lib.mjs';

const args = parseArgs();
const sourceInput = args.source ?? process.env.ATTESTATION_BUNDLE;
if (!sourceInput || !args.output) {
  throw new Error(
    'Usage: copy-attestation.mjs [--source <bundle> or ATTESTATION_BUNDLE] --output <file>',
  );
}
const source = path.resolve(String(sourceInput));
const output = path.resolve(String(args.output));
const stat = await fs.stat(source);
if (!stat.isFile() || stat.size === 0)
  throw new Error(`Attestation bundle is missing or empty: ${source}`);
await copyTree(source, output);
const digest = await sha256File(output);
await fs.writeFile(`${output}.sha256`, `${digest}  ${path.basename(output)}\n`, 'utf8');
console.log(`Copied GitHub attestation bundle to ${output} (${digest})`);
