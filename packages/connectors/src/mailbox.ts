import type { EmailAddress, ListMailboxMessagesInput } from './types.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function validateMailboxListInput(input: ListMailboxMessagesInput): void {
  if (input.since !== undefined && !Number.isFinite(Date.parse(input.since))) {
    throw new TypeError('Mailbox since must be an ISO timestamp');
  }
  if (input.mailbox !== undefined && !['all', 'sent'].includes(input.mailbox)) {
    throw new TypeError('Mailbox selection must be all or sent');
  }
  if (
    input.pageSize !== undefined &&
    (!Number.isInteger(input.pageSize) || input.pageSize < 1 || input.pageSize > 250)
  ) {
    throw new TypeError('Mailbox page size must be between 1 and 250');
  }
}

export function parseMailboxAddresses(value: string | undefined): EmailAddress[] {
  if (!value) return [];
  const addresses: EmailAddress[] = [];
  const pattern = /(?:"([^"]+)"|([^,<]+?))?\s*<([^<>\s]+@[^<>\s]+)>|([^\s,<]+@[^\s,>]+)/gu;
  for (const match of value.matchAll(pattern)) {
    const email = (match[3] ?? match[4] ?? '').trim();
    if (!isProviderEmail(email)) continue;
    const name = (match[1] ?? match[2] ?? '').trim().replace(/^"|"$/gu, '');
    addresses.push({ email, ...(name ? { name } : {}) });
  }
  return addresses;
}

/**
 * Provider payloads are untrusted even after a successful API response. This
 * deliberately returns `undefined` instead of inventing an identity that could
 * become a local relationship.
 */
export function providerEmailAddress(email: unknown, name?: unknown): EmailAddress | undefined {
  if (!isProviderEmail(email)) return undefined;
  const displayName =
    typeof name === 'string' && name.trim() && !/[\r\n]/u.test(name) ? name.trim() : undefined;
  return { email: email.trim(), ...(displayName ? { name: displayName } : {}) };
}

export function isProviderEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim()) && !/[\r\n]/u.test(value);
}

/** Return a canonical provider timestamp, or `undefined` for missing/invalid data. */
export function safeIsoTimestamp(value: string | number | undefined): string | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/u.test(value)
        ? Number(value)
        : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) return undefined;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
