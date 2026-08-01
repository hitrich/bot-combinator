#!/usr/bin/env node
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  copyCanonicalText,
  copyTree,
  normalizeCodeSignature,
  parseArgs,
  pnpmInvocation,
  repoRoot,
  run,
  sha256File,
  targetId,
} from './_lib.mjs';
import { assessReleaseSecrets } from './validate-release-secrets.mjs';
import { verifyFuseBinary } from './verify-electron-fuses.mjs';
import { signingStatus } from './write-signing-status.mjs';

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'outreachr-release-script-test-'));
try {
  const payload = path.join(temporaryRoot, 'payload');
  await fs.mkdir(path.join(payload, 'nested'), { recursive: true });
  await fs.writeFile(path.join(payload, 'alpha.txt'), 'alpha\n', 'utf8');
  await fs.writeFile(path.join(payload, 'nested', 'beta.txt'), 'beta\n', 'utf8');
  assert.equal(
    await sha256File(path.join(payload, 'alpha.txt')),
    'b6a98d9ce9a2d9149288fa3df42d377c3e42737afdcdaf714e33c0a100b51060',
  );
  assert.deepEqual(parseArgs(['--platform', 'linux', '--arch=arm64', 'positional']), {
    _: ['positional'],
    platform: 'linux',
    arch: 'arm64',
  });
  assert.equal(targetId('darwin', 'x64'), 'macos-x64');
  assert.equal(targetId('win32', 'arm64'), 'windows-arm64');
  assert.equal(targetId('linux', 'arm64'), 'linux-arm64');
  const fuseSentinel = Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX', 'ascii');
  const hardenedFuseWire = Buffer.concat([
    fuseSentinel,
    Buffer.from([1, 8, 48, 49, 48, 48, 49, 49, 0x90, 0x90]),
  ]);
  assert.equal(verifyFuseBinary(hardenedFuseWire), 1);
  const unsafeFuseWire = Buffer.from(hardenedFuseWire);
  unsafeFuseWire[fuseSentinel.length + 2] = 49;
  assert.throws(() => verifyFuseBinary(unsafeFuseWire), /RunAsNode fuse is enabled/);
  assert.deepEqual(assessReleaseSecrets({}, 'optional'), {
    policy: 'optional',
    mac: 'unsigned',
    windows: 'unsigned',
    overall: 'mixed-or-unsigned',
  });
  assert.throws(
    () => assessReleaseSecrets({ OUTREACHR_MAC_CERTIFICATE_BASE64: 'partial' }, 'optional'),
    /partially configured|partial/,
  );
  const completeReleaseSecrets = {
    OUTREACHR_MAC_CERTIFICATE_BASE64: 'certificate',
    OUTREACHR_MAC_CERTIFICATE_PASSWORD: 'password',
    OUTREACHR_MAC_EXPECTED_TEAM_ID: 'TEAM',
    OUTREACHR_APPLE_API_KEY_BASE64: 'key',
    OUTREACHR_APPLE_API_KEY_ID: 'key-id',
    OUTREACHR_APPLE_API_ISSUER: 'issuer',
    OUTREACHR_WINDOWS_CERTIFICATE_BASE64: 'certificate',
    OUTREACHR_WINDOWS_CERTIFICATE_PASSWORD: 'password',
    OUTREACHR_WINDOWS_EXPECTED_PUBLISHER: 'publisher',
  };
  assert.deepEqual(assessReleaseSecrets(completeReleaseSecrets, 'optional'), {
    policy: 'optional',
    mac: 'signed',
    windows: 'signed',
    overall: 'fully-signed',
  });
  assert.equal(
    signingStatus({
      target: 'macos-arm64',
      mode: 'unsigned',
      tagVerification: 'unsigned',
    }).platformTrust.notarization,
    'none',
  );
  assert.deepEqual(pnpmInvocation(['--filter', '@outreachr/desktop', 'build'], 'linux'), {
    command: 'pnpm',
    args: ['--filter', '@outreachr/desktop', 'build'],
  });
  assert.deepEqual(
    pnpmInvocation(['--filter', '@outreachr/desktop', 'build'], 'win32', {
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    }),
    {
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm.cmd --filter @outreachr/desktop build'],
    },
  );
  assert.throws(() => pnpmInvocation(['build & echo unsafe'], 'win32', {}), /Unsafe pnpm argument/);
  const windowsLegalText = path.join(temporaryRoot, 'windows-legal.txt');
  const canonicalLegalText = path.join(temporaryRoot, 'canonical-legal.txt');
  await fs.writeFile(windowsLegalText, 'first line\r\nsecond line\r\n', 'utf8');
  await copyCanonicalText(windowsLegalText, canonicalLegalText);
  assert.equal(
    await fs.readFile(canonicalLegalText, 'utf8'),
    'first line\nsecond line\n',
    'public legal assets must be byte-identical across checkout line-ending policies',
  );
  const nativeReleaseMatrix = [
    ['macos-x64', 'macos-15-intel'],
    ['macos-arm64', 'macos-15'],
    ['windows-x64', 'windows-2025'],
    ['windows-arm64', 'windows-11-arm'],
    ['linux-x64', 'ubuntu-24.04'],
    ['linux-arm64', 'ubuntu-24.04-arm'],
  ];
  for (const workflowName of ['verify.yml', 'release.yml', 'codeql.yml']) {
    const workflow = await fs.readFile(
      path.join(repoRoot, '.github', 'workflows', workflowName),
      'utf8',
    );
    const actionReferences = [...workflow.matchAll(/^\s*uses:\s*[^@\s]+@([^\s#]+)/gm)].map(
      ([, reference]) => reference,
    );
    assert.ok(actionReferences.length > 0, `${workflowName} must declare external actions`);
    for (const reference of actionReferences) {
      assert.match(
        reference,
        /^[a-f0-9]{40}$/,
        `${workflowName} action references must be pinned to full commit SHAs`,
      );
    }
  }
  for (const workflowName of ['verify.yml', 'release.yml']) {
    const workflow = await fs.readFile(
      path.join(repoRoot, '.github', 'workflows', workflowName),
      'utf8',
    );
    const configuredMatrix = [
      ...workflow.matchAll(/^\s+- target: ([\w-]+)\r?\n\s+runner: ([\w.-]+)/gm),
    ].map(([, target, runner]) => [target, runner]);
    assert.deepEqual(
      configuredMatrix,
      nativeReleaseMatrix,
      `${workflowName} must use the supported six-target native runner matrix`,
    );
    assert.doesNotMatch(
      workflow,
      /windows-11-vs2026-arm/,
      `${workflowName} must not depend on the VS2026 preview runner`,
    );
  }
  const releaseChecklist = await fs.readFile(
    path.join(repoRoot, '.github', 'RELEASE_CHECKLIST.md'),
    'utf8',
  );
  const releaseWorkflow = await fs.readFile(
    path.join(repoRoot, '.github', 'workflows', 'release.yml'),
    'utf8',
  );
  const verifyWorkflow = await fs.readFile(
    path.join(repoRoot, '.github', 'workflows', 'verify.yml'),
    'utf8',
  );
  assert.match(
    verifyWorkflow,
    /verify-complete:[\s\S]*?needs: \[native-verify, quality-security, attest-verified-builds\]/,
    'the stable branch-protection check must wait for every push attestation',
  );
  assert.match(
    releaseWorkflow,
    /verify-attestations\.mjs[^\r\n]*--source-digest "\$GITHUB_SHA"/,
    'release attestation verification must bind the protected tag to its exact source commit',
  );
  assert.match(
    releaseWorkflow,
    /for \(const requiredCheck of \['All native targets', 'JavaScript and TypeScript'\]\)/,
    'release preflight must require both exact hosted check-run contexts on protected main',
  );
  assert.match(
    releaseWorkflow,
    /release\.data\.immutable !== true/,
    'release publication must fail closed unless GitHub reports an immutable public release',
  );
  assert.match(
    releaseWorkflow,
    /verify-published-assets\.mjs --expected publish-assets --actual downloaded-public-assets/,
    'release publication must compare the immutable public assets byte-for-byte',
  );
  assert.match(
    releaseChecklist,
    /Windows arm64 on `windows-11-arm`/,
    'the maintainer release checklist must name the supported Windows arm64 runner',
  );
  assert.doesNotMatch(
    releaseChecklist,
    /windows-11-vs2026-arm/,
    'the maintainer release checklist must not recommend the VS2026 preview runner',
  );
  assert.match(
    releaseChecklist,
    /CodeQL check context \*\*JavaScript and TypeScript\*\*/,
    'the maintainer release checklist must name the exact CodeQL check-run context',
  );
  const seedManifest = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'resources', 'seed-manifest.json'), 'utf8'),
  );
  const sqliteResources = (await fs.readdir(path.join(repoRoot, 'resources')))
    .filter((name) => name.endsWith('.sqlite'))
    .sort();
  assert.deepEqual(
    sqliteResources,
    [seedManifest.artifact],
    'resources must contain exactly the seed database named by its manifest',
  );
  assert.equal(
    await sha256File(path.join(repoRoot, 'resources', seedManifest.artifact)),
    seedManifest.fileSha256,
    'the repository seed bytes must match the pinned manifest digest',
  );
  const syntheticPePath = path.join(temporaryRoot, 'signed.exe');
  const syntheticPe = Buffer.alloc(0x280, 0);
  syntheticPe.write('MZ', 0, 'ascii');
  syntheticPe.writeUInt32LE(0x80, 0x3c);
  syntheticPe.write('PE\0\0', 0x80, 'binary');
  syntheticPe.writeUInt16LE(0xf0, 0x80 + 20);
  syntheticPe.writeUInt16LE(0x20b, 0x98);
  syntheticPe.writeUInt32LE(0x12345678, 0x98 + 64);
  syntheticPe.writeUInt32LE(0x200, 0x98 + 112 + 32);
  syntheticPe.writeUInt32LE(0x80, 0x98 + 112 + 36);
  syntheticPe.fill(0xa5, 0x200);
  await fs.writeFile(syntheticPePath, syntheticPe);
  assert.equal(await normalizeCodeSignature(syntheticPePath, 'win32'), true);
  const normalizedPe = await fs.readFile(syntheticPePath);
  assert.equal(normalizedPe.length, 0x200);
  assert.equal(normalizedPe.readUInt32LE(0x98 + 64), 0);
  assert.equal(normalizedPe.readUInt32LE(0x98 + 112 + 32), 0);
  assert.equal(normalizedPe.readUInt32LE(0x98 + 112 + 36), 0);

  const generate = path.join(repoRoot, 'scripts', 'generate-checksums.mjs');
  const verify = path.join(repoRoot, 'scripts', 'verify-checksums.mjs');
  await run(process.execPath, [generate, '--directory', payload]);
  await run(process.execPath, [verify, '--manifest', path.join(payload, 'SHA256SUMS')]);

  await fs.writeFile(path.join(payload, 'alpha.txt'), 'tampered\n', 'utf8');
  const tamperResult = await run(
    process.execPath,
    [verify, '--manifest', path.join(payload, 'SHA256SUMS')],
    { allowFailure: true },
  );
  assert.notEqual(tamperResult.code, 0, 'tampered artifact must fail checksum verification');

  const unsafeManifest = path.join(temporaryRoot, 'unsafe-sums');
  await fs.writeFile(unsafeManifest, `${'0'.repeat(64)}  ../outside\n`, 'utf8');
  const traversalResult = await run(process.execPath, [verify, '--manifest', unsafeManifest], {
    allowFailure: true,
  });
  assert.notEqual(
    traversalResult.code,
    0,
    'path traversal in a checksum manifest must be rejected',
  );

  const targets = nativeReleaseMatrix.map(([target]) => target);
  const releaseAssets = path.join(temporaryRoot, 'release-assets');
  const attestationSource = path.join(temporaryRoot, 'attestation.jsonl');
  await fs.writeFile(attestationSource, '{"test":"attestation"}\n', 'utf8');
  for (const target of targets) {
    const bundle = path.join(releaseAssets, `outreachr-${target}`);
    await fs.mkdir(bundle, { recursive: true });
    const required = {
      LICENSE: 'test license\n',
      NOTICE: 'test notice\n',
      [`THIRD_PARTY_NOTICES-${target}.md`]: '# Test notices\n',
      [`licenses-${target}.json`]: '{}\n',
      [`build-target-${target}.json`]: '{}\n',
      [`outreachr-${target}.cdx.json`]: '{}\n',
      [`outreachr-${target}.provenance.json`]: '{}\n',
      ...distributionFixtures(target),
    };
    for (const [name, contents] of Object.entries(required)) {
      await fs.writeFile(path.join(bundle, name), contents, 'utf8');
    }
    const releaseMode = target.startsWith('linux') ? 'checksum-attested' : 'unsigned';
    await fs.writeFile(
      path.join(bundle, `SIGNING-STATUS-${target}.json`),
      `${JSON.stringify(
        signingStatus({
          target,
          mode: releaseMode,
          tagVerification: 'unsigned',
          tagVerificationReason: 'unsigned',
        }),
        null,
        2,
      )}\n`,
      'utf8',
    );
    await run(process.execPath, [
      generate,
      '--directory',
      bundle,
      '--output',
      path.join(bundle, `SHA256SUMS-${target}`),
    ]);
    await run(
      process.execPath,
      [
        path.join(repoRoot, 'scripts', 'copy-attestation.mjs'),
        '--output',
        path.join(bundle, `outreachr-${target}.attestation.intoto.jsonl`),
      ],
      { env: { ...process.env, ATTESTATION_BUNDLE: attestationSource } },
    );
  }

  const verifyBundles = path.join(repoRoot, 'scripts', 'verify-release-bundle.mjs');
  const stageBundles = path.join(repoRoot, 'scripts', 'stage-publish-assets.mjs');
  const stagedAssets = path.join(temporaryRoot, 'publish-assets');
  await run(process.execPath, [verifyBundles, '--directory', releaseAssets]);
  await run(process.execPath, [stageBundles, '--input', releaseAssets, '--output', stagedAssets]);
  assert.equal(await fs.readFile(path.join(stagedAssets, 'NOTICE'), 'utf8'), 'test notice\n');
  assert.match(await fs.readFile(path.join(stagedAssets, 'RELEASE-TRUST.md'), 'utf8'), /UNSIGNED/);
  const downloadedAssets = path.join(temporaryRoot, 'downloaded-publish-assets');
  await copyTree(stagedAssets, downloadedAssets);
  const verifyPublishedAssets = path.join(repoRoot, 'scripts', 'verify-published-assets.mjs');
  await run(process.execPath, [
    verifyPublishedAssets,
    '--expected',
    stagedAssets,
    '--actual',
    downloadedAssets,
  ]);
  await fs.writeFile(path.join(downloadedAssets, 'NOTICE'), 'tampered draft asset\n', 'utf8');
  const draftTamperResult = await run(
    process.execPath,
    [verifyPublishedAssets, '--expected', stagedAssets, '--actual', downloadedAssets],
    { allowFailure: true },
  );
  assert.notEqual(draftTamperResult.code, 0, 'tampered draft-release asset must be rejected');

  const firstBundle = path.join(releaseAssets, 'outreachr-macos-x64');
  const unattested = path.join(firstBundle, 'unattested-extra.txt');
  await fs.writeFile(unattested, 'must fail closed\n', 'utf8');
  const unattestedResult = await run(
    process.execPath,
    [verifyBundles, '--directory', releaseAssets],
    { allowFailure: true },
  );
  assert.notEqual(unattestedResult.code, 0, 'an unchecksummed release asset must be rejected');
  await fs.rm(unattested, { force: true });

  const firstChecksum = path.join(firstBundle, 'SHA256SUMS-macos-x64');
  const originalChecksums = await fs.readFile(firstChecksum, 'utf8');
  await fs.appendFile(firstChecksum, originalChecksums.split(/\r?\n/)[0] + '\n', 'utf8');
  const duplicateResult = await run(
    process.execPath,
    [verifyBundles, '--directory', releaseAssets],
    { allowFailure: true },
  );
  assert.notEqual(duplicateResult.code, 0, 'duplicate checksum subjects must be rejected');
  await fs.writeFile(firstChecksum, originalChecksums, 'utf8');

  const collisionRoot = path.join(temporaryRoot, 'collision-release');
  const collisionExtension =
    process.platform === 'darwin' ? '.dmg' : process.platform === 'win32' ? '.exe' : '.AppImage';
  for (const directory of ['one', 'two']) {
    await fs.mkdir(path.join(collisionRoot, directory), { recursive: true });
    await fs.writeFile(
      path.join(collisionRoot, directory, `Outreachr-collision${collisionExtension}`),
      directory,
      'utf8',
    );
  }
  const collisionResult = await run(
    process.execPath,
    [
      path.join(repoRoot, 'scripts', 'collect-release-artifacts.mjs'),
      '--release-dir',
      collisionRoot,
      '--target',
      targetId(),
      '--output',
      path.join(temporaryRoot, 'collision-output'),
    ],
    { allowFailure: true },
  );
  assert.notEqual(collisionResult.code, 0, 'artifact basename collisions must be rejected');

  console.log(
    'Release-script self-test passed: command portability, Electron fuse enforcement, optional/partial signing policy, trust disclosures, pinned seed integrity, checksums, tamper/path safety, all six release bundles, complete attestation coverage, draft-asset comparison, and collision rejection.',
  );
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

function distributionFixtures(target) {
  if (target.startsWith('macos')) {
    return {
      [`Outreachr-test-${target}-UNSIGNED-UNNOTARIZED.dmg`]: 'dmg\n',
      [`Outreachr-test-${target}-UNSIGNED-UNNOTARIZED.zip`]: 'zip\n',
    };
  }
  if (target.startsWith('windows')) {
    return { [`Outreachr-test-${target}-UNSIGNED.exe`]: 'exe\n' };
  }
  return {
    [`Outreachr-test-${target}.AppImage`]: 'appimage\n',
    [`Outreachr-test-${target}.deb`]: 'deb\n',
  };
}
