#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { materializeSigningAssets } from './materialize-signing-assets.mjs';
import { parseArgs, repoRoot, run, runPnpm, targetId, walkFiles } from './_lib.mjs';

if (!['darwin', 'win32'].includes(process.platform)) {
  throw new Error('package-signed-target.mjs is only valid for macOS and Windows release jobs');
}

const args = parseArgs();
const expectedPlatform = String(args.platform ?? process.platform);
const expectedArch = String(args.arch ?? process.arch);
if (process.platform !== expectedPlatform || process.arch !== expectedArch) {
  throw new Error(
    `Refusing a non-native signed package: running ${process.platform}-${process.arch}, requested ${expectedPlatform}-${expectedArch}`,
  );
}
await fs.rm(path.join(repoRoot, 'apps', 'desktop', 'release'), {
  recursive: true,
  force: true,
});
await runPnpm(['prepare:resources'], { cwd: repoRoot, capture: false });
await runPnpm(['--filter', '@outreachr/desktop...', 'build'], {
  cwd: repoRoot,
  capture: false,
});

const assets = await materializeSigningAssets();
try {
  const platformFlag = process.platform === 'darwin' ? '--mac' : '--win';
  const platformTargets = process.platform === 'darwin' ? ['dmg', 'zip'] : ['nsis'];
  const builderArgs = [
    '--filter',
    '@outreachr/desktop',
    'exec',
    'electron-builder',
    platformFlag,
    ...platformTargets,
    `--${process.arch}`,
    '--publish',
    'never',
  ];
  if (process.platform === 'darwin') {
    builderArgs.push('--config.mac.notarize=true', '--config.dmg.sign=true');
  }
  await runPnpm(builderArgs, {
    capture: false,
    env: { ...process.env, ...assets.environment },
  });
  if (process.platform === 'darwin') await notarizeDiskImages(assets.environment);
} finally {
  await assets.cleanup();
}

console.log(
  `Signed ${targetId()} package build completed and temporary certificate/key files were removed.`,
);

async function notarizeDiskImages(signingEnvironment) {
  const releaseRoot = path.join(repoRoot, 'apps', 'desktop', 'release');
  const diskImages = (await walkFiles(releaseRoot)).filter((file) =>
    file.toLowerCase().endsWith('.dmg'),
  );
  if (diskImages.length !== 1) {
    throw new Error(`Expected one signed DMG for notarization, found ${diskImages.length}`);
  }
  const credentials = signingEnvironment.APPLE_API_KEY
    ? [
        '--key',
        signingEnvironment.APPLE_API_KEY,
        '--key-id',
        signingEnvironment.APPLE_API_KEY_ID,
        '--issuer',
        signingEnvironment.APPLE_API_ISSUER,
      ]
    : [
        '--apple-id',
        signingEnvironment.APPLE_ID,
        '--password',
        signingEnvironment.APPLE_APP_SPECIFIC_PASSWORD,
        '--team-id',
        signingEnvironment.APPLE_TEAM_ID,
      ];
  await run('xcrun', ['notarytool', 'submit', diskImages[0], '--wait', ...credentials], {
    capture: false,
    env: { ...process.env, ...signingEnvironment },
    sensitive: true,
    timeoutMs: 30 * 60_000,
  });
  await run('xcrun', ['stapler', 'staple', diskImages[0]], {
    capture: false,
    timeoutMs: 60_000,
  });
  console.log(`Notarized and stapled ${path.basename(diskImages[0])}.`);
}
