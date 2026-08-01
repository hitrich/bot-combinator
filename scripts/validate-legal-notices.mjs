#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists, readJson, repoRoot, sha256File } from './_lib.mjs';

export async function validateLegalNotices() {
  const required = {
    LICENSE: ['Apache License', 'Version 2.0'],
    NOTICE: ['Outreachr', 'source-specific rights'],
    'THIRD_PARTY_NOTICES.md': ['# Third-Party Notices', 'Included license texts'],
  };
  for (const [relative, markers] of Object.entries(required)) {
    const target = path.join(repoRoot, relative);
    if (!(await exists(target))) throw new Error(`Required legal file is missing: ${relative}`);
    const text = await fs.readFile(target, 'utf8');
    for (const marker of markers) {
      if (!text.includes(marker))
        throw new Error(`${relative} is missing required marker: ${marker}`);
    }
  }

  const report = await readJson(path.join(repoRoot, 'release-metadata', 'licenses.json'));
  if (!Number.isInteger(report.packageCount) || report.packageCount < 1) {
    throw new Error('Installed dependency license report is empty');
  }
  if (report.packageCount !== report.packages?.length) {
    throw new Error('Installed dependency license report count does not match its rows');
  }
  const unresolved = report.packages.filter(
    (item) => item.license === 'UNKNOWN' && !item.licenseTextSha256?.length,
  );
  if (unresolved.length) {
    throw new Error(
      `Dependencies without declared license or bundled license text: ${unresolved
        .map((item) => `${item.name}@${item.version}`)
        .join(', ')}`,
    );
  }

  const seedManifest = await readJson(path.join(repoRoot, 'resources', 'seed-manifest.json'));
  const seedPath = path.join(repoRoot, 'resources', seedManifest.artifact);
  if (!(await exists(seedPath)))
    throw new Error(`Declared seed artifact is missing: ${seedManifest.artifact}`);
  const seedHash = await sha256File(seedPath);
  if (seedHash !== seedManifest.fileSha256)
    throw new Error('Investor seed does not match seed-manifest.json');
  for (const key of ['logicalDigestSha256', 'signatureStatus', 'rights', 'productionNotice']) {
    if (!seedManifest[key]) throw new Error(`Seed manifest is missing ${key}`);
  }

  console.log(
    `Validated first-party notices, ${report.packageCount} dependency license rows, and investor seed ${seedManifest.fileSha256}.`,
  );
  return { packageCount: report.packageCount, seedHash };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await validateLegalNotices();
