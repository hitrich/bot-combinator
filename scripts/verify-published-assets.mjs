#!/usr/bin/env node
import path from 'node:path';
import { hashManifest, parseArgs, repoRoot } from './_lib.mjs';

const args = parseArgs();
const expectedDirectory = path.resolve(args.expected ?? path.join(repoRoot, 'publish-assets'));
const actualDirectory = path.resolve(
  args.actual ?? path.join(repoRoot, 'downloaded-publish-assets'),
);
const expected = await hashManifest(expectedDirectory);
const actual = await hashManifest(actualDirectory);

if (!expected.length)
  throw new Error(`Expected release asset directory is empty: ${expectedDirectory}`);
const expectedMap = new Map(expected.map((item) => [item.path, item]));
const actualMap = new Map(actual.map((item) => [item.path, item]));

for (const [name, item] of expectedMap) {
  const downloaded = actualMap.get(name);
  if (!downloaded) throw new Error(`Published draft release is missing ${name}`);
  if (downloaded.sha256 !== item.sha256 || downloaded.size !== item.size) {
    throw new Error(`Published draft release does not match the verified local asset: ${name}`);
  }
}
for (const name of actualMap.keys()) {
  if (!expectedMap.has(name))
    throw new Error(`Published draft release contains unexpected asset ${name}`);
}

console.log(
  `Verified ${expected.length} draft-release assets byte-for-byte before public publication.`,
);
