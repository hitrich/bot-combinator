#!/usr/bin/env node
import path from 'node:path';
import { hashManifest, parseArgs, repoRoot, sha256File, targetId, writeJson } from './_lib.mjs';

const args = parseArgs();
const target = String(args.target ?? targetId());
const artifactDir = path.resolve(args['artifact-dir'] ?? path.join(repoRoot, 'artifacts', target));
const output = path.resolve(
  args.output ?? path.join(artifactDir, `outreachr-${target}.provenance.json`),
);
const outputRelative = path.relative(artifactDir, output).split(path.sep).join('/');
const subjects = await hashManifest(artifactDir, {
  exclude: [outputRelative, 'SHA256SUMS'],
});
const materials = [];
for (const name of ['pnpm-lock.yaml', 'package.json', 'apps/desktop/electron-builder.yml']) {
  const source = path.join(repoRoot, ...name.split('/'));
  materials.push({ uri: name, digest: { sha256: await sha256File(source) } });
}

await writeJson(output, {
  _type: 'https://in-toto.io/Statement/v1',
  subject: subjects.map((item) => ({ name: item.path, digest: { sha256: item.sha256 } })),
  predicateType: 'https://slsa.dev/provenance/v1',
  predicate: {
    buildDefinition: {
      buildType: process.env.GITHUB_WORKFLOW_REF
        ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_WORKFLOW_REF}`
        : 'https://outreachr.local/build-types/native-electron-v1',
      externalParameters: {
        target,
        ref: process.env.GITHUB_REF ?? null,
      },
      internalParameters: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      resolvedDependencies: [
        ...materials,
        ...(process.env.GITHUB_SHA
          ? [
              {
                uri: `git+https://github.com/${process.env.GITHUB_REPOSITORY ?? 'local/outreachr'}@${process.env.GITHUB_SHA}`,
                digest: { gitCommit: process.env.GITHUB_SHA },
              },
            ]
          : []),
      ],
    },
    runDetails: {
      builder: {
        id: process.env.GITHUB_ACTIONS
          ? 'https://github.com/actions/runner/github-hosted'
          : 'https://outreachr.local/manual-build',
      },
      metadata: {
        invocationId: process.env.GITHUB_RUN_ID
          ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/attempts/${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`
          : null,
        startedOn: process.env.OUTREACHR_BUILD_STARTED_AT ?? null,
        finishedOn: new Date().toISOString(),
      },
    },
  },
});
console.log(
  `Wrote unsigned local provenance statement for ${subjects.length} subjects to ${output}`,
);
