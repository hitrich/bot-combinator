import {
  fingerprintEmail,
  InMemorySendAttemptLedger,
  type EmailMessage,
  type SendContext,
  type SendSafety,
} from '../src/index.js';

export const FIXED_NOW = new Date('2026-07-31T18:00:00.000Z');
export const now = (): Date => new Date(FIXED_NOW);
export const noSleep = async (): Promise<void> => undefined;

export const message: EmailMessage = {
  to: [{ email: 'Partner@Example.com', name: 'Pat Partner', recipientKey: 'person-pat' }],
  subject: 'Bot Combinator intro',
  text: 'Hello from Bot Combinator.',
  html: '<p>Hello from <strong>Bot Combinator</strong>.</p>',
};

export const sendContext: SendContext = {
  provider: 'google',
  senderAddress: 'founder@example.com',
  messageKind: 'initial',
};

export async function approvedSafety(
  input: EmailMessage = message,
  operationKey = 'send-operation-0001',
  context: SendContext = sendContext,
): Promise<SendSafety> {
  return {
    operationKey,
    approval: {
      approved: true,
      approvalId: `approval-${operationKey}`,
      approvedAt: FIXED_NOW.toISOString(),
      messageFingerprint: await fingerprintEmail(input, context),
      context,
    },
    duplicateCheck: {
      checkedAt: FIXED_NOW.toISOString(),
      checkedRecipientKeys: ['person-pat'],
      previouslyContactedRecipientKeys: [],
    },
  };
}

export function ledger(): InMemorySendAttemptLedger {
  return new InMemorySendAttemptLedger();
}
