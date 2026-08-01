#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, repoRoot, walkFiles } from './_lib.mjs';

const FUSE_SENTINEL = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX', 'ascii');
const FUSE_VERSION_V1 = 1;
const FUSE_DISABLED = '0'.charCodeAt(0);
const FUSE_ENABLED = '1'.charCodeAt(0);
const EXPECTED_V1 = new Map([
  [0, { name: 'RunAsNode', state: FUSE_DISABLED }],
  [1, { name: 'EnableCookieEncryption', state: FUSE_ENABLED }],
  [2, { name: 'EnableNodeOptionsEnvironmentVariable', state: FUSE_DISABLED }],
  [3, { name: 'EnableNodeCliInspectArguments', state: FUSE_DISABLED }],
  [4, { name: 'EnableEmbeddedAsarIntegrityValidation', state: FUSE_ENABLED }],
  [5, { name: 'OnlyLoadAppFromAsar', state: FUSE_ENABLED }],
]);

export function verifyFuseBinary(binary, label = 'Electron binary') {
  const sentinelOffsets = allOffsets(binary, FUSE_SENTINEL);
  if (!sentinelOffsets.length) throw new Error(`Electron fuse sentinel is absent from ${label}`);

  for (const sentinelOffset of sentinelOffsets) {
    const versionOffset = sentinelOffset + FUSE_SENTINEL.length;
    const version = binary[versionOffset];
    const wireLength = binary[versionOffset + 1];
    if (version !== FUSE_VERSION_V1) {
      throw new Error(`Unsupported Electron fuse wire version ${version} in ${label}`);
    }
    if (wireLength < Math.max(...EXPECTED_V1.keys()) + 1) {
      throw new Error(`Electron V1 fuse wire is unexpectedly short (${wireLength})`);
    }
    for (const [index, expectation] of EXPECTED_V1) {
      const actual = binary[versionOffset + 2 + index];
      if (actual !== expectation.state) {
        throw new Error(
          `${expectation.name} fuse is ${describeState(actual)}, expected ${describeState(expectation.state)}`,
        );
      }
    }
  }
  return sentinelOffsets.length;
}

async function main() {
  const args = parseArgs();
  const releaseDir = path.resolve(
    args['release-dir'] ?? path.join(repoRoot, 'apps', 'desktop', 'release'),
  );
  const files = await walkFiles(releaseDir);
  const candidates = files.filter(isElectronFuseBinary);
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one packaged Electron fuse binary for ${process.platform}, found ${candidates.length} under ${releaseDir}`,
    );
  }

  const count = verifyFuseBinary(await fs.readFile(candidates[0]), candidates[0]);
  console.log(
    `Verified ${EXPECTED_V1.size} hardened Electron V1 fuses across ${count} binary slice(s) in ${candidates[0]}.`,
  );
}

function isElectronFuseBinary(file) {
  const normalized = file.split(path.sep).join('/');
  if (process.platform === 'darwin') {
    return /\.app\/Contents\/Frameworks\/Electron Framework\.framework\/Versions\/A\/Electron Framework$/.test(
      normalized,
    );
  }
  if (!/(?:^|\/)\w[^/]*-unpacked\//.test(normalized)) return false;
  if (process.platform === 'win32') return path.basename(file).toLowerCase() === 'outreachr.exe';
  return path.basename(file) === 'outreachr';
}

function allOffsets(haystack, needle) {
  const offsets = [];
  let offset = 0;
  while (offset <= haystack.length - needle.length) {
    const found = haystack.indexOf(needle, offset);
    if (found === -1) break;
    offsets.push(found);
    offset = found + needle.length;
  }
  return offsets;
}

function describeState(state) {
  if (state === FUSE_DISABLED) return 'disabled';
  if (state === FUSE_ENABLED) return 'enabled';
  if (state === 'r'.charCodeAt(0)) return 'removed';
  if (state === 0x90) return 'inherited';
  return `unknown(${state})`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
