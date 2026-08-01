#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, repoRoot, run, targetId, walkFiles } from './_lib.mjs';

if (process.platform !== 'linux') {
  console.log('Linux artifact signing skipped on non-Linux target.');
  process.exit(0);
}

const privateKey = process.env.OUTREACHR_LINUX_GPG_PRIVATE_KEY;
if (!privateKey) {
  console.log(
    'OUTREACHR_LINUX_GPG_PRIVATE_KEY is not configured; relying on checksums and GitHub attestations.',
  );
  process.exit(0);
}

const args = parseArgs();
const directory = path.resolve(args.directory ?? path.join(repoRoot, 'artifacts', targetId()));
const gnupgHome = await fs.mkdtemp(
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'outreachr-gpg-'),
);
const keyFile = path.join(gnupgHome, 'release-key.asc');
await fs.chmod(gnupgHome, 0o700);
await fs.writeFile(keyFile, privateKey, { mode: 0o600 });
const baseArgs = ['--batch', '--yes', '--homedir', gnupgHome];
const passphrase = process.env.OUTREACHR_LINUX_GPG_PASSPHRASE;
if (passphrase) {
  const passphraseFile = path.join(gnupgHome, 'passphrase');
  await fs.writeFile(passphraseFile, passphrase, { mode: 0o600 });
  baseArgs.push('--pinentry-mode', 'loopback', '--passphrase-file', passphraseFile);
}

try {
  await run('gpg', [...baseArgs, '--import', keyFile], { capture: false });
  const artifacts = (await walkFiles(directory)).filter((file) =>
    ['.appimage', '.deb'].includes(path.extname(file).toLowerCase()),
  );
  if (!artifacts.length) throw new Error(`No Linux packages found under ${directory}`);
  for (const artifact of artifacts) {
    await run(
      'gpg',
      [...baseArgs, '--armor', '--detach-sign', '--output', `${artifact}.asc`, artifact],
      {
        capture: false,
      },
    );
  }
  console.log(`Created ${artifacts.length} detached GPG signatures.`);
} finally {
  await fs.rm(gnupgHome, { recursive: true, force: true });
}
