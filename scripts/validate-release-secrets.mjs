#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './_lib.mjs';

const MAC_SIGNING_GROUP = [
  'OUTREACHR_MAC_CERTIFICATE_BASE64',
  'OUTREACHR_MAC_CERTIFICATE_PASSWORD',
  'OUTREACHR_MAC_EXPECTED_TEAM_ID',
];
const WINDOWS_SIGNING_GROUP = [
  'OUTREACHR_WINDOWS_CERTIFICATE_BASE64',
  'OUTREACHR_WINDOWS_CERTIFICATE_PASSWORD',
  'OUTREACHR_WINDOWS_EXPECTED_PUBLISHER',
];
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

export function assessReleaseSecrets(environment = process.env, policy = 'required') {
  if (!['optional', 'required'].includes(policy)) {
    throw new Error(`Unknown release-signing policy: ${policy}`);
  }

  const problems = [];
  const macSigning = groupState(MAC_SIGNING_GROUP, environment);
  const windowsSigning = groupState(WINDOWS_SIGNING_GROUP, environment);
  const apiNotary = groupState(API_NOTARY_GROUP, environment);
  const appleIdNotary = groupState(APPLE_ID_NOTARY_GROUP, environment);

  rejectPartial('macOS certificate', macSigning, problems);
  rejectPartial('Windows certificate', windowsSigning, problems);
  rejectPartial('App Store Connect notarization', apiNotary, problems);
  rejectPartial('Apple ID notarization', appleIdNotary, problems);

  const hasAnyMacMaterial =
    macSigning.state !== 'absent' ||
    apiNotary.state !== 'absent' ||
    appleIdNotary.state !== 'absent';
  const hasCompleteNotary = apiNotary.state === 'complete' || appleIdNotary.state === 'complete';

  if (hasAnyMacMaterial && (macSigning.state !== 'complete' || !hasCompleteNotary)) {
    problems.push(
      'macOS signing is partially configured: a complete certificate group and one complete notarization group must be supplied together',
    );
  }
  if (policy === 'required' && macSigning.state !== 'complete') {
    problems.push('macOS signing certificate group is required by the selected policy');
  }
  if (policy === 'required' && !hasCompleteNotary) {
    problems.push(
      'one complete Apple notarization credential group is required by the selected policy',
    );
  }
  if (policy === 'required' && windowsSigning.state !== 'complete') {
    problems.push('Windows Authenticode certificate group is required by the selected policy');
  }

  if (problems.length) {
    throw new Error(`Release signing readiness failed:\n- ${[...new Set(problems)].join('\n- ')}`);
  }

  const mac = macSigning.state === 'complete' && hasCompleteNotary ? 'signed' : 'unsigned';
  const windows = windowsSigning.state === 'complete' ? 'signed' : 'unsigned';
  return {
    policy,
    mac,
    windows,
    overall: mac === 'signed' && windows === 'signed' ? 'fully-signed' : 'mixed-or-unsigned',
  };
}

function groupState(names, environment) {
  const present = names.filter((name) => Boolean(environment[name]));
  return {
    state:
      present.length === 0 ? 'absent' : present.length === names.length ? 'complete' : 'partial',
  };
}

function rejectPartial(label, state, problems) {
  if (state.state === 'partial') problems.push(`${label} credential group is partial`);
}

async function main() {
  const args = parseArgs();
  const policy = String(args.policy ?? 'required');
  const result = assessReleaseSecrets(process.env, policy);
  console.log(
    result.mac === 'signed'
      ? 'macOS Developer ID signing and notarization credentials are complete.'
      : 'macOS credentials are absent; the release will be explicitly unsigned and unnotarized.',
  );
  console.log(
    result.windows === 'signed'
      ? 'Windows Authenticode signing credentials are complete.'
      : 'Windows credentials are absent; the release will be explicitly unsigned.',
  );

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `mac_signing=${result.mac}\nwindows_signing=${result.windows}\noverall_signing=${result.overall}\n`,
      'utf8',
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
