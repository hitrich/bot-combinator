import { utf8Base64Url } from './encoding.js';
import { normalizeEmail, validateEmailMessage } from './safety.js';
import type { EmailAddress, EmailMessage } from './types.js';

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/u.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function formatAddress(address: EmailAddress): string {
  const email = normalizeEmail(address.email);
  if (!address.name?.trim()) return `<${email}>`;
  const escaped = encodeHeader(address.name.trim()).replaceAll('"', '\\"');
  return `"${escaped}" <${email}>`;
}

function headerLines(message: EmailMessage, operationKey?: string): string[] {
  const lines = [
    `To: ${message.to.map(formatAddress).join(', ')}`,
    ...(message.cc?.length ? [`Cc: ${message.cc.map(formatAddress).join(', ')}`] : []),
    ...(message.bcc?.length ? [`Bcc: ${message.bcc.map(formatAddress).join(', ')}`] : []),
    ...(message.replyTo ? [`Reply-To: ${formatAddress(message.replyTo)}`] : []),
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (message.inReplyTo) lines.push(`In-Reply-To: ${message.inReplyTo}`);
  if (message.references?.length) lines.push(`References: ${message.references.join(' ')}`);
  if (operationKey) lines.push(`X-Bot-Combinator-Operation-Key: ${operationKey}`);
  for (const [name, value] of Object.entries(message.headers ?? {})) {
    lines.push(`${name}: ${value}`);
  }
  return lines;
}

export function buildMimeMessage(message: EmailMessage, operationKey?: string): string {
  validateEmailMessage(message);
  const headers = headerLines(message, operationKey);
  if (message.text !== undefined && message.html !== undefined) {
    const boundary = `bot_combinator_${(operationKey ?? globalThis.crypto.randomUUID()).replace(/[^A-Za-z0-9]/gu, '')}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return [
      ...headers,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.html,
      `--${boundary}--`,
      '',
    ].join('\r\n');
  }
  const isHtml = message.html !== undefined;
  headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
  headers.push('Content-Transfer-Encoding: 8bit');
  return [...headers, '', isHtml ? message.html! : message.text!, ''].join('\r\n');
}

export function buildGmailRaw(message: EmailMessage, operationKey?: string): string {
  return utf8Base64Url(buildMimeMessage(message, operationKey));
}
