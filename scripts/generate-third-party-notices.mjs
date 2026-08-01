#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { packageMetadataFromPnpmStore, parseArgs, repoRoot } from './_lib.mjs';

export async function generateThirdPartyNotices(options = {}) {
  const output = path.resolve(options.output ?? path.join(repoRoot, 'THIRD_PARTY_NOTICES.md'));
  const reportOutput = path.resolve(
    options.reportOutput ?? path.join(repoRoot, 'release-metadata', 'licenses.json'),
  );
  const packages = await packageMetadataFromPnpmStore(repoRoot);
  const texts = new Map();
  const report = [];

  for (const item of packages) {
    const textHashes = [];
    for (const licenseFile of item.licenseFiles) {
      const text = (await fs.readFile(licenseFile, 'utf8')).replaceAll('\r\n', '\n').trim();
      if (!text) continue;
      const hash = createHash('sha256').update(text).digest('hex');
      textHashes.push(hash);
      const entry = texts.get(hash) ?? { hash, text, packages: [] };
      entry.packages.push(`${item.name}@${item.version}`);
      texts.set(hash, entry);
    }
    report.push({
      name: item.name,
      version: item.version,
      license: item.license,
      homepage: item.homepage,
      repository: item.repository,
      licenseTextSha256: [...new Set(textHashes)].sort(),
    });
  }

  const lines = [
    '# Third-Party Notices',
    '',
    'Outreachr is built with the following installed build and runtime dependencies. This file is generated from the frozen pnpm virtual store; package license files remain authoritative.',
    '',
    '| Package | Version | Declared license | Source |',
    '| --- | --- | --- | --- |',
  ];
  for (const item of report) {
    const source = item.homepage ?? item.repository ?? '';
    lines.push(
      `| ${escapeCell(item.name)} | ${escapeCell(item.version)} | ${escapeCell(item.license)} | ${escapeCell(source)} |`,
    );
  }
  lines.push('', '## Included license texts', '');
  for (const item of [...texts.values()].sort((left, right) =>
    left.hash.localeCompare(right.hash),
  )) {
    lines.push(
      `### ${item.hash}`,
      '',
      `Applies to: ${item.packages.sort().join(', ')}`,
      '',
      '```text',
      item.text.replaceAll('```', '```\u200b'),
      '```',
      '',
    );
  }
  const outputPrettierConfig = (await prettier.resolveConfig(output)) ?? {};
  const rendered = await prettier.format(`${lines.join('\n').trim()}\n`, {
    ...outputPrettierConfig,
    filepath: output,
  });
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, rendered, 'utf8');
  const reportJson = await prettier.format(
    `${JSON.stringify({
      schemaVersion: 1,
      packageCount: report.length,
      packages: report,
    })}\n`,
    {
      ...((await prettier.resolveConfig(reportOutput)) ?? {}),
      filepath: reportOutput,
    },
  );
  await fs.mkdir(path.dirname(reportOutput), { recursive: true });
  await fs.writeFile(reportOutput, reportJson, 'utf8');
  console.log(`Wrote ${output} and ${reportOutput} for ${report.length} installed packages.`);
  return { output, reportOutput, packages: report };
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  await generateThirdPartyNotices({ output: args.output, reportOutput: args.report });
}
