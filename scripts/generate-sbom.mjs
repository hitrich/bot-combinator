#!/usr/bin/env node
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  packageMetadataFromPnpmStore,
  parseArgs,
  readJson,
  repoRoot,
  sha256File,
  targetId,
  writeJson,
} from './_lib.mjs';

const args = parseArgs();
const target = String(args.target ?? targetId());
const output = path.resolve(
  args.output ?? path.join(repoRoot, 'artifacts', target, `bot-combinator-${target}.cdx.json`),
);
const rootManifestPath = path.join(repoRoot, 'package.json');
const rootManifest = await readJson(rootManifestPath);
const packages = await packageMetadataFromPnpmStore(repoRoot);
const lockPath = path.join(repoRoot, 'pnpm-lock.yaml');
const lockHash = await sha256File(lockPath);
const componentRefs = packages.map((item) => bomRef(item.name, item.version));

await writeJson(output, {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${deterministicUuid(`${rootManifest.version}:${target}:${lockHash}`)}`,
  version: 1,
  metadata: {
    timestamp: process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : new Date().toISOString(),
    tools: {
      components: [
        {
          type: 'application',
          name: 'bot-combinator-release-scripts',
          version: rootManifest.version,
        },
      ],
    },
    component: {
      type: 'application',
      'bom-ref': `pkg:npm/${rootManifest.name}@${rootManifest.version}?target=${target}`,
      name: rootManifest.name,
      version: rootManifest.version,
      licenses: [{ license: { id: rootManifest.license } }],
      properties: [
        { name: 'bot-combinator:target', value: target },
        { name: 'bot-combinator:pnpm-lock-sha256', value: lockHash },
      ],
    },
  },
  components: packages.map((item) => ({
    type: 'library',
    'bom-ref': bomRef(item.name, item.version),
    group: item.name.startsWith('@') ? item.name.split('/')[0].slice(1) : undefined,
    name: item.name.startsWith('@') ? item.name.split('/')[1] : item.name,
    version: item.version,
    purl: bomRef(item.name, item.version),
    licenses: [cycloneDxLicense(item.license)],
    externalReferences: externalReferences(item),
  })),
  dependencies: [
    {
      ref: `pkg:npm/${rootManifest.name}@${rootManifest.version}?target=${target}`,
      dependsOn: componentRefs,
    },
    ...componentRefs.map((ref) => ({ ref, dependsOn: [] })),
  ],
});
console.log(`Wrote CycloneDX SBOM with ${packages.length} components to ${output}`);

function bomRef(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.slice(1).split('/');
    return `pkg:npm/%40${scope}/${packageName}@${version}`;
  }
  return `pkg:npm/${name}@${version}`;
}

function deterministicUuid(seed) {
  const bytes = Buffer.from(createHash('sha256').update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cycloneDxLicense(value) {
  if (/^[A-Za-z0-9-.+]+$/.test(value)) return { license: { id: value } };
  if (/^[A-Za-z0-9-.+]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9-.+]+)+$/.test(value)) {
    return { expression: value };
  }
  return { license: { name: value } };
}

function normalizeRepository(value) {
  let normalized = String(value).trim();
  normalized = normalized.replace(/^git\+/, '').replace(/^git:\/\//, 'https://');
  normalized = normalized.replace(/^git@github\.com:/, 'https://github.com/');
  normalized = normalized.replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/');
  normalized = normalized.replace(/^github:/, 'https://github.com/');
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    normalized = `https://github.com/${normalized}`;
  }
  normalized = normalized.replace(/\.git$/, '');
  return validWebUrl(normalized);
}

function externalReferences(item) {
  const references = [];
  const homepage = validWebUrl(item.homepage);
  const repository = normalizeRepository(item.repository ?? '');
  if (homepage) references.push({ type: 'website', url: homepage });
  if (repository) references.push({ type: 'vcs', url: repository });
  return references;
}

function validWebUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
