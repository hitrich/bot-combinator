import { describe, expect, it } from 'vitest';

import { AGENT_RESULT_JSON_SCHEMA, parseAgentResult } from '../src/output.js';
import { allowlist, validRawResult } from './helpers.js';

describe('agent output validation', () => {
  it('keeps every structured-output object closed and every property required', () => {
    assertStrictOutputSchema(AGENT_RESULT_JSON_SCHEMA, '$');
  });

  it('parses plain and fenced JSON into explicitly non-executable proposals', () => {
    const policy = allowlist('propose.draft');
    const parsed = parseAgentResult(JSON.stringify(validRawResult), policy, 'codex');
    expect(parsed.proposals[0]).toMatchObject({ kind: 'draft', executable: false });
    expect(
      parseAgentResult(`\`\`\`json\n${JSON.stringify(validRawResult)}\n\`\`\``, policy, 'codex'),
    ).toEqual(parsed);
  });

  it.each([
    { send: true },
    { nested: { provider_message_id: 'danger' } },
    { nested: { providerMessageId: 'danger' } },
    { sendNow: true },
    { scheduledFor: 'tomorrow' },
    { operation: 'delete' },
    { items: [{ action: 'send_email' }] },
  ])('rejects executable payload %#', (payload) => {
    expect(() =>
      parseAgentResult(
        { ...validRawResult, proposals: [{ ...validRawResult.proposals[0], payload }] },
        allowlist('propose.draft'),
        'codex',
      ),
    ).toThrow(/forbidden/i);
  });

  it('requires the exact proposal capability, including investor scope', () => {
    expect(() => parseAgentResult(validRawResult, allowlist('propose.task'), 'codex')).toThrow(
      'propose.draft',
    );
  });

  it('rejects malformed output, duplicates, invalid kinds, and oversized collections', () => {
    const policy = allowlist('propose.draft');
    expect(() => parseAgentResult('not json', policy, 'codex')).toThrow('not valid JSON');
    expect(() => parseAgentResult({ summary: '', proposals: [] }, policy, 'codex')).toThrow(
      'non-empty summary',
    );
    expect(() => parseAgentResult({ summary: 'x', proposals: {} }, policy, 'codex')).toThrow(
      'at most 100',
    );
    expect(() =>
      parseAgentResult(
        { summary: 'x', proposals: [validRawResult.proposals[0], validRawResult.proposals[0]] },
        policy,
        'codex',
      ),
    ).toThrow('duplicate id');
    expect(() =>
      parseAgentResult(
        { summary: 'x', proposals: [{ ...validRawResult.proposals[0], kind: 'send' }] },
        policy,
        'codex',
      ),
    ).toThrow('unsupported kind');
    expect(() =>
      parseAgentResult({ summary: 'x', proposals: new Array(101).fill({}) }, policy, 'codex'),
    ).toThrow('at most 100');
    expect(() =>
      parseAgentResult({ summary: 'x', proposals: [], extra: true }, policy, 'codex'),
    ).toThrow('Unexpected field');
    expect(() =>
      parseAgentResult(
        { summary: 'x', proposals: [{ ...validRawResult.proposals[0], executable: true }] },
        policy,
        'codex',
      ),
    ).toThrow('Unexpected field');
  });
});

function assertStrictOutputSchema(value: unknown, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const schema = value as Record<string, unknown>;
  if (schema.type === 'object') {
    expect(schema.additionalProperties, `${path}.additionalProperties`).toBe(false);
    const properties = (schema.properties ?? {}) as Record<string, unknown>;
    expect([...((schema.required ?? []) as string[])].sort(), `${path}.required`).toEqual(
      Object.keys(properties).sort(),
    );
    for (const [name, property] of Object.entries(properties)) {
      const propertySchema = property as Record<string, unknown>;
      expect(
        'type' in propertySchema || 'anyOf' in propertySchema,
        `${path}.properties.${name} needs an explicit type or anyOf`,
      ).toBe(true);
      assertStrictOutputSchema(property, `${path}.properties.${name}`);
    }
  }
  if (Array.isArray(schema.anyOf)) {
    schema.anyOf.forEach((entry, index) =>
      assertStrictOutputSchema(entry, `${path}.anyOf.${index}`),
    );
  }
  if (schema.items) assertStrictOutputSchema(schema.items, `${path}.items`);
}
