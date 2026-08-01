export type AgentErrorCode =
  | 'AUTH_REQUIRED'
  | 'BINARY_NOT_FOUND'
  | 'CANCELLED'
  | 'INVALID_OUTPUT'
  | 'POLICY_DENIED'
  | 'PROTOCOL_ERROR'
  | 'PROVIDER_ERROR'
  | 'RUN_NOT_FOUND'
  | 'TIMEOUT';

export class AgentRuntimeError extends Error {
  readonly code: AgentErrorCode;
  override readonly cause?: unknown;

  constructor(code: AgentErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AgentRuntimeError';
    this.code = code;
    this.cause = cause;
  }
}

export function asAgentError(
  error: unknown,
  fallback: AgentErrorCode = 'PROVIDER_ERROR',
): AgentRuntimeError {
  if (error instanceof AgentRuntimeError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new AgentRuntimeError(fallback, message, error);
}
