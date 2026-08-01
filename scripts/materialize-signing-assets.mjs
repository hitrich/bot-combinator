#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function materializeSigningAssets(options = {}) {
  const temporaryRoot = await fs.mkdtemp(
    path.join(
      options.temporaryRoot ?? process.env.RUNNER_TEMP ?? os.tmpdir(),
      'outreachr-signing-',
    ),
  );
  const environment = {};
  try {
    if (process.platform === 'darwin') {
      environment.CSC_LINK = await materialize(
        'OUTREACHR_MAC_CERTIFICATE_BASE64',
        path.join(temporaryRoot, 'macos-certificate.p12'),
      );
      environment.CSC_KEY_PASSWORD = required('OUTREACHR_MAC_CERTIFICATE_PASSWORD');
      if (complete(API_NOTARY_GROUP)) {
        environment.APPLE_API_KEY = await materialize(
          'OUTREACHR_APPLE_API_KEY_BASE64',
          path.join(temporaryRoot, 'notary-key.p8'),
        );
        environment.APPLE_API_KEY_ID = required('OUTREACHR_APPLE_API_KEY_ID');
        environment.APPLE_API_ISSUER = required('OUTREACHR_APPLE_API_ISSUER');
      } else if (complete(APPLE_ID_NOTARY_GROUP)) {
        environment.APPLE_ID = required('OUTREACHR_APPLE_ID');
        environment.APPLE_APP_SPECIFIC_PASSWORD = required('OUTREACHR_APPLE_APP_SPECIFIC_PASSWORD');
        environment.APPLE_TEAM_ID = required('OUTREACHR_APPLE_TEAM_ID');
      } else {
        throw new Error('A complete Apple notarization credential group is required');
      }
      console.log('Materialized isolated macOS signing and notarization assets.');
    } else if (process.platform === 'win32') {
      environment.CSC_LINK = await materialize(
        'OUTREACHR_WINDOWS_CERTIFICATE_BASE64',
        path.join(temporaryRoot, 'windows-certificate.pfx'),
      );
      environment.CSC_KEY_PASSWORD = required('OUTREACHR_WINDOWS_CERTIFICATE_PASSWORD');
      console.log('Materialized isolated Windows signing assets.');
    } else {
      console.log('No platform code-signing asset is required for Linux packaging.');
    }
    return {
      environment,
      temporaryRoot,
      async cleanup() {
        await fs.rm(temporaryRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  async function materialize(variable, destination) {
    const encoded = required(variable).replaceAll(/\s/g, '');
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length) throw new Error(`${variable} did not decode to a certificate/key`);
    await fs.writeFile(destination, bytes, { mode: 0o600 });
    return destination;
  }
}

const API_NOTARY_GROUP = [
  'OUTREACHR_APPLE_API_KEY_BASE64',
  'OUTREACHR_APPLE_API_KEY_ID',
  'OUTREACHR_APPLE_API_ISSUER',
];
const APPLE_ID_NOTARY_GROUP = [
  'OUTREACHR_APPLE_ID',
  'OUTREACHR_APPLE_APP_SPECIFIC_PASSWORD',
  'OUTREACHR_APPLE_TEAM_ID',
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Required release secret ${name} is not configured`);
  return value;
}

function complete(names) {
  return names.every((name) => Boolean(process.env[name]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assets = await materializeSigningAssets();
  console.log(
    `Signing assets are ready in ${assets.temporaryRoot}; direct invocation cleans them immediately.`,
  );
  await assets.cleanup();
}
