import { describe, expect, it } from 'vitest';
import {
  ConnectorError,
  InMemorySendAttemptLedger,
  assertSendAllowed,
  fingerprintEmail,
  type SendReceipt,
} from '../src/index.js';
import { FIXED_NOW, approvedSafety, message, sendContext } from './helpers.js';

describe('send safety', () => {
  it('binds founder approval to exact message content', async () => {
    const safety = await approvedSafety();
    await expect(assertSendAllowed(message, safety, sendContext)).resolves.toBe(
      safety.approval.messageFingerprint,
    );
    await expect(
      assertSendAllowed({ ...message, subject: 'Changed after approval' }, safety, sendContext),
    ).rejects.toMatchObject({ code: 'APPROVAL_STALE' });
    for (const context of [
      { ...sendContext, provider: 'microsoft' as const },
      { ...sendContext, senderAddress: 'another-founder@example.com' },
      { ...sendContext, messageKind: 'reply' as const },
      { ...sendContext, providerThreadId: 'changed-thread' },
    ]) {
      await expect(assertSendAllowed(message, safety, context)).rejects.toMatchObject({
        code: 'APPROVAL_STALE',
      });
    }
  });

  it('fails closed for unchecked and previously contacted recipients', async () => {
    const unchecked = await approvedSafety();
    unchecked.duplicateCheck.checkedRecipientKeys = [];
    await expect(assertSendAllowed(message, unchecked, sendContext)).rejects.toMatchObject({
      code: 'DUPLICATE_CHECK_REQUIRED',
    });

    const duplicate = await approvedSafety();
    duplicate.duplicateCheck.previouslyContactedRecipientKeys = ['PERSON-PAT'];
    await expect(assertSendAllowed(message, duplicate, sendContext)).rejects.toMatchObject({
      code: 'DUPLICATE_BLOCKED',
    });
  });

  it('atomically replays the same claim and rejects operation-key reuse', async () => {
    const ledger = new InMemorySendAttemptLedger();
    const fingerprint = await fingerprintEmail(message, sendContext);
    const receipt: SendReceipt = {
      provider: 'google',
      operationKey: 'operation-key',
      messageFingerprint: fingerprint,
      status: 'pending',
      attemptedAt: FIXED_NOW.toISOString(),
      updatedAt: FIXED_NOW.toISOString(),
      deliveryConfirmed: false,
      replayed: false,
      retrySafe: false,
    };
    await expect(ledger.claim(receipt)).resolves.toMatchObject({ claimed: true });
    await expect(ledger.claim(receipt)).resolves.toMatchObject({
      claimed: false,
      receipt: { replayed: true },
    });
    await expect(
      ledger.claim({ ...receipt, messageFingerprint: 'sha256:different' }),
    ).rejects.toBeInstanceOf(ConnectorError);
  });
});
