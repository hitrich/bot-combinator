import type { ConnectorProvider, SendReceipt } from './types.js';

export type ConnectorErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'AMBIGUOUS_SEND'
  | 'AMBIGUOUS_CREATE'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_STALE'
  | 'DUPLICATE_CHECK_REQUIRED'
  | 'DUPLICATE_BLOCKED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'OAUTH_CALLBACK_INVALID'
  | 'UNKNOWN';

export interface ConnectorErrorOptions {
  provider?: ConnectorProvider;
  operation: string;
  code: ConnectorErrorCode;
  message: string;
  httpStatus?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  mayHaveSucceeded?: boolean;
  providerCode?: string;
  providerRequestId?: string;
  details?: unknown;
  receipt?: SendReceipt;
  cause?: unknown;
}

export class ConnectorError extends Error {
  readonly provider?: ConnectorProvider;
  readonly operation: string;
  readonly code: ConnectorErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly mayHaveSucceeded: boolean;
  readonly providerCode?: string;
  readonly providerRequestId?: string;
  readonly details?: unknown;
  readonly receipt?: SendReceipt;

  constructor(options: ConnectorErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'ConnectorError';
    this.provider = options.provider;
    this.operation = options.operation;
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.mayHaveSucceeded = options.mayHaveSucceeded ?? false;
    this.providerCode = options.providerCode;
    this.providerRequestId = options.providerRequestId;
    this.details = options.details;
    this.receipt = options.receipt;
  }
}

export function isConnectorError(error: unknown): error is ConnectorError {
  return error instanceof ConnectorError;
}

export function errorCodeForStatus(status: number): ConnectorErrorCode {
  switch (status) {
    case 400:
      return 'INVALID_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 412:
      return 'PRECONDITION_FAILED';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN';
  }
}
