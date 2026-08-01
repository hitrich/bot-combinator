import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process';

import { AgentRuntimeError } from './errors.js';

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: { readonly env?: Readonly<NodeJS.ProcessEnv>; readonly timeoutMs?: number },
) => Promise<CommandResult>;

export type ProcessSpawner = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

export const nodeProcessSpawner: ProcessSpawner = (command, args, options) =>
  spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'], shell: false });

export const nodeCommandRunner: CommandRunner = async (command, args, options = {}) => {
  return new Promise<CommandResult>((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = nodeProcessSpawner(command, args, {
        env: options.env ? { ...options.env } : process.env,
        windowsHide: true,
      });
    } catch (error) {
      reject(new AgentRuntimeError('BINARY_NOT_FOUND', `Could not start ${command}.`, error));
      return;
    }
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timeoutMs = options.timeoutMs ?? 10_000;
    const timer = setTimeout(() => {
      if (finished) return;
      child.kill();
      reject(
        new AgentRuntimeError('TIMEOUT', `${command} did not respond within ${timeoutMs} ms.`),
      );
    }, timeoutMs);
    timer.unref?.();
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout = appendCapped(stdout, chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr = appendCapped(stderr, chunk);
    });
    child.once('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(new AgentRuntimeError('BINARY_NOT_FOUND', `Could not run ${command}.`, error));
    });
    child.once('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
      });
    });
  });
};

const MAX_CAPTURE_CHARS = 64_000;

function appendCapped(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length <= MAX_CAPTURE_CHARS ? next : next.slice(next.length - MAX_CAPTURE_CHARS);
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\b(sk-(?:ant-|proj-)?)[A-Za-z0-9_-]{8,}\b/g, '$1[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi, 'Bearer [REDACTED]')
    .replace(
      /("?(?:OUTREACHR_MCP_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|REFRESH_TOKEN|ACCESS_TOKEN|OAUTH_TOKEN|ID_TOKEN|CLIENT_SECRET|API_KEY)"?\s*[=:]\s*"?)[^"',\s}]+/gi,
      '$1[REDACTED]',
    );
}

export function firstNonEmptyLine(value: string): string | undefined {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
}
