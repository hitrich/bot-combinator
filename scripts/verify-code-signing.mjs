#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, repoRoot, run, walkFiles } from './_lib.mjs';

const args = parseArgs();
const releaseDir = path.resolve(
  args['release-dir'] ?? path.join(repoRoot, 'apps', 'desktop', 'release'),
);
const files = await walkFiles(releaseDir);
const expectation = String(
  args.expect ?? (process.platform === 'linux' ? 'checksum-attested' : 'signed'),
);

if (!['signed', 'unsigned', 'checksum-attested'].includes(expectation)) {
  throw new Error(`Unknown code-signing expectation: ${expectation}`);
}

if (process.platform === 'darwin') {
  const appExecutables = files.filter((file) => /\.app\/Contents\/MacOS\/Outreachr$/.test(file));
  if (appExecutables.length !== 1)
    throw new Error(`Expected one packaged Outreachr.app, found ${appExecutables.length}`);
  const app = appExecutables[0].slice(0, appExecutables[0].indexOf('.app/') + 4);
  if (expectation === 'unsigned') {
    await verifyUntrustedMacDistribution(app, files);
    process.exit(0);
  }
  if (expectation !== 'signed') {
    throw new Error(`macOS does not support code-signing expectation ${expectation}`);
  }
  await run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { capture: false });
  const details = await run('codesign', ['--display', '--verbose=4', app]);
  const teamIdentifier = /TeamIdentifier=([^\r\n]+)/
    .exec(`${details.stdout}\n${details.stderr}`)?.[1]
    ?.trim();
  const expectedTeamIdentifier = process.env.OUTREACHR_MAC_EXPECTED_TEAM_ID;
  if (!expectedTeamIdentifier || teamIdentifier !== expectedTeamIdentifier) {
    throw new Error(
      `macOS signer team mismatch: expected ${expectedTeamIdentifier ?? '(not configured)'}, received ${teamIdentifier ?? '(missing)'}`,
    );
  }
  await run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app], { capture: false });
  await run('xcrun', ['stapler', 'validate', app], { capture: false });
  const dmgs = files.filter((file) => file.toLowerCase().endsWith('.dmg'));
  if (!dmgs.length) throw new Error('No signed DMG was produced');
  for (const dmg of dmgs) {
    await run('codesign', ['--verify', '--verbose=2', dmg], { capture: false });
    await run('xcrun', ['stapler', 'validate', dmg], { capture: false });
    await run(
      'spctl',
      ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose=2', dmg],
      { capture: false },
    );
  }
  console.log(`Verified code signing, Gatekeeper assessment, and notarization for ${app}.`);
} else if (process.platform === 'win32') {
  const executables = files.filter((file) => file.toLowerCase().endsWith('.exe'));
  if (!executables.length)
    throw new Error('No Windows executables were found for signature verification');
  if (expectation === 'unsigned') {
    await verifyUnsignedWindowsDistribution(executables);
    process.exit(0);
  }
  if (expectation !== 'signed') {
    throw new Error(`Windows does not support code-signing expectation ${expectation}`);
  }
  const expectedPublisher = process.env.OUTREACHR_WINDOWS_EXPECTED_PUBLISHER;
  if (!expectedPublisher) throw new Error('OUTREACHR_WINDOWS_EXPECTED_PUBLISHER is not configured');
  for (const executable of executables) {
    const script =
      '$signature = Get-AuthenticodeSignature -LiteralPath $env:OUTREACHR_VERIFY_EXECUTABLE; ' +
      'if ($signature.Status -ne \'Valid\') { throw "Invalid Authenticode signature: $($signature.Status)" }; ' +
      'if ($null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Subject.IndexOf($env:OUTREACHR_VERIFY_PUBLISHER, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) { throw "Unexpected Authenticode publisher: $($signature.SignerCertificate.Subject)" }; ' +
      'if ($null -eq $signature.TimeStamperCertificate) { throw "Authenticode signature is not timestamped" }';
    await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      capture: false,
      env: {
        ...process.env,
        OUTREACHR_VERIFY_EXECUTABLE: executable,
        OUTREACHR_VERIFY_PUBLISHER: expectedPublisher,
      },
    });
  }
  console.log(`Verified ${executables.length} Authenticode signatures.`);
} else {
  if (expectation !== 'checksum-attested') {
    throw new Error(
      `Linux release verification expects checksum-attested mode, not ${expectation}`,
    );
  }
  console.log(
    'Linux authenticity is covered by SHA-256 manifests, optional GPG signatures, and GitHub OIDC attestations.',
  );
}

async function verifyUntrustedMacDistribution(app, releaseFiles) {
  const details = await run('codesign', ['--display', '--verbose=4', app], { allowFailure: true });
  const signatureText = `${details.stdout}\n${details.stderr}`;
  if (
    /Authority=(?:Developer ID Application|Apple Distribution|Mac App Distribution)/i.test(
      signatureText,
    )
  ) {
    throw new Error(
      'Unsigned macOS mode unexpectedly contains an Apple-trusted publisher signature',
    );
  }
  const gatekeeper = await run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app], {
    allowFailure: true,
  });
  if (gatekeeper.code === 0) {
    throw new Error('Unsigned macOS mode unexpectedly passed Gatekeeper execution assessment');
  }
  const appStaple = await run('xcrun', ['stapler', 'validate', app], { allowFailure: true });
  if (appStaple.code === 0) {
    throw new Error('Unsigned macOS mode unexpectedly contains a valid notarization staple');
  }
  const dmgs = releaseFiles.filter((file) => file.toLowerCase().endsWith('.dmg'));
  if (dmgs.length !== 1) throw new Error(`Expected one unsigned macOS DMG, found ${dmgs.length}`);
  for (const dmg of dmgs) {
    const dmgDetails = await run('codesign', ['--display', '--verbose=4', dmg], {
      allowFailure: true,
    });
    if (
      /Authority=(?:Developer ID Application|Apple Distribution|Mac App Distribution)/i.test(
        `${dmgDetails.stdout}\n${dmgDetails.stderr}`,
      )
    ) {
      throw new Error('Unsigned macOS DMG unexpectedly contains an Apple-trusted signature');
    }
    const staple = await run('xcrun', ['stapler', 'validate', dmg], { allowFailure: true });
    if (staple.code === 0) {
      throw new Error('Unsigned macOS DMG unexpectedly contains a valid notarization staple');
    }
  }
  console.log(
    'Verified explicit unsigned/unnotarized macOS status; Gatekeeper warning is expected and must be disclosed.',
  );
}

async function verifyUnsignedWindowsDistribution(executables) {
  const script =
    '$signature = Get-AuthenticodeSignature -LiteralPath $env:OUTREACHR_VERIFY_EXECUTABLE; ' +
    'if ($signature.Status -eq \'Valid\') { throw "Unsigned mode unexpectedly contains a valid Authenticode signature: $($signature.SignerCertificate.Subject)" }';
  for (const executable of executables) {
    await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      capture: false,
      env: { ...process.env, OUTREACHR_VERIFY_EXECUTABLE: executable },
    });
  }
  console.log(
    `Verified explicit unsigned Windows status for ${executables.length} executables; SmartScreen warning is expected and must be disclosed.`,
  );
}
