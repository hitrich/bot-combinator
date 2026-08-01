import { ConnectorError, isConnectorError } from './errors.js';
import { assertSendAllowed } from './safety.js';
import type {
  ConnectorProvider,
  EmailMessage,
  SendContext,
  SendAttemptLedger,
  SendReceipt,
  SendSafety,
} from './types.js';

interface SendExecutionOptions {
  provider: ConnectorProvider;
  message: EmailMessage;
  context: SendContext;
  safety: SendSafety;
  ledger: SendAttemptLedger;
  now: () => Date;
  perform: () => Promise<
    Pick<
      SendReceipt,
      | 'status'
      | 'providerMessageId'
      | 'providerThreadId'
      | 'providerRequestId'
      | 'httpStatus'
      | 'deliveryConfirmed'
    >
  >;
}

export async function executeGuardedSend(options: SendExecutionOptions): Promise<SendReceipt> {
  if (options.context.provider !== options.provider) {
    throw new ConnectorError({
      provider: options.provider,
      operation: 'email.send.guard',
      code: 'APPROVAL_STALE',
      message: 'Approved provider does not match the connector selected for dispatch',
    });
  }
  const fingerprint = await assertSendAllowed(options.message, options.safety, options.context);
  const timestamp = options.now().toISOString();
  const pending: SendReceipt = {
    provider: options.provider,
    operationKey: options.safety.operationKey,
    messageFingerprint: fingerprint,
    status: 'pending',
    attemptedAt: timestamp,
    updatedAt: timestamp,
    deliveryConfirmed: false,
    replayed: false,
    retrySafe: false,
  };
  const claim = await options.ledger.claim(pending);
  if (!claim.claimed) return { ...claim.receipt, replayed: true };

  try {
    const result = await options.perform();
    const receipt: SendReceipt = {
      ...pending,
      ...result,
      updatedAt: options.now().toISOString(),
      replayed: false,
      retrySafe: false,
    };
    await options.ledger.update(receipt);
    return receipt;
  } catch (error) {
    const connectorError = isConnectorError(error)
      ? error
      : new ConnectorError({
          provider: options.provider,
          operation: 'email.send',
          code: 'AMBIGUOUS_SEND',
          message: 'Send outcome could not be recorded safely',
          mayHaveSucceeded: true,
          cause: error,
        });
    const ambiguous = connectorError.mayHaveSucceeded || connectorError.code === 'AMBIGUOUS_SEND';
    const receipt: SendReceipt = {
      ...pending,
      status: ambiguous ? 'ambiguous' : 'rejected',
      updatedAt: options.now().toISOString(),
      providerRequestId: connectorError.providerRequestId,
      httpStatus: connectorError.httpStatus,
      deliveryConfirmed: false,
      retrySafe: !ambiguous && connectorError.retryable,
      errorCode: connectorError.code,
    };
    try {
      await options.ledger.update(receipt);
    } catch (ledgerError) {
      throw new ConnectorError({
        provider: options.provider,
        operation: 'email.send.ledger',
        code: 'AMBIGUOUS_SEND',
        message: 'Send outcome could not be persisted; the operation remains claimed',
        mayHaveSucceeded: true,
        receipt,
        cause: ledgerError,
      });
    }
    throw new ConnectorError({
      provider: connectorError.provider ?? options.provider,
      operation: connectorError.operation,
      code: connectorError.code,
      message: connectorError.message,
      httpStatus: connectorError.httpStatus,
      retryable: connectorError.retryable,
      retryAfterMs: connectorError.retryAfterMs,
      mayHaveSucceeded: connectorError.mayHaveSucceeded,
      providerCode: connectorError.providerCode,
      providerRequestId: connectorError.providerRequestId,
      details: connectorError.details,
      receipt,
      cause: connectorError,
    });
  }
}
