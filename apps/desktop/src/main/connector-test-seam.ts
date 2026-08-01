import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { PreparedAuthorizationRequest } from '@outreachr/connectors';
import type { SecretStoreBackend } from './secure-store';

const E2E_PROVIDER_URL = 'OUTREACHR_E2E_GOOGLE_PROVIDER_URL';
const E2E_SECRET_KEY = 'OUTREACHR_E2E_SECRET_KEY';
const GOOGLE_PROVIDER_ORIGINS = new Set([
  'https://oauth2.googleapis.com',
  'https://openidconnect.googleapis.com',
  'https://gmail.googleapis.com',
  'https://www.googleapis.com',
]);

interface ConnectorTestSeamEnvironment {
  [name: string]: string | undefined;
  NODE_ENV?: string;
  OUTREACHR_E2E_GOOGLE_PROVIDER_URL?: string;
  OUTREACHR_E2E_SECRET_KEY?: string;
}

export interface ConnectorTestSeam {
  fetch: typeof fetch;
  authorizeForTest: (request: PreparedAuthorizationRequest) => Promise<string>;
  secretBackend: SecretStoreBackend;
}

function validatedLoopbackBaseUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${E2E_PROVIDER_URL} must be an explicit http://127.0.0.1:<port> URL without credentials, query, or fragment`,
    );
  }
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url;
}

function rewrittenGoogleProviderUrl(input: RequestInfo | URL, mockBase: URL): string {
  const original =
    input instanceof Request
      ? new URL(input.url)
      : new URL(typeof input === 'string' ? input : input.toString());
  if (!GOOGLE_PROVIDER_ORIGINS.has(original.origin)) {
    throw new Error(
      `The Electron connector test seam blocked an unexpected URL: ${original.origin}`,
    );
  }
  const rewritten = new URL(mockBase.toString());
  const basePath = rewritten.pathname === '/' ? '' : rewritten.pathname;
  rewritten.pathname = `${basePath}${original.pathname}`;
  rewritten.search = original.search;
  return rewritten.toString();
}

class E2eEncryptedSecretBackend implements SecretStoreBackend {
  readonly #key: Buffer;

  constructor(keyHex: string) {
    if (!/^[a-f0-9]{64}$/u.test(keyHex)) {
      throw new Error(`${E2E_SECRET_KEY} must be exactly 32 random bytes encoded as lowercase hex`);
    }
    this.#key = Buffer.from(keyHex, 'hex');
  }

  async status(): Promise<{ available: true; backend: string; reason: null }> {
    return { available: true, backend: 'e2e-aes-256-gcm', reason: null };
  }

  async encrypt(value: string): Promise<Buffer> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.#key, nonce, { authTagLength: 16 });
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
  }

  async decrypt(value: Buffer): Promise<{ plaintext: string; shouldReEncrypt: false }> {
    if (value.length < 29) throw new Error('Encrypted E2E secret is malformed');
    const nonce = value.subarray(0, 12);
    const tag = value.subarray(12, 28);
    const ciphertext = value.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.#key, nonce, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return {
      plaintext: Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'),
      shouldReEncrypt: false,
    };
  }
}

/**
 * Returns the built-Electron provider seam used by Playwright, or null for every
 * normal application launch. A partially configured or non-test seam aborts
 * startup so these hooks can never silently become a production OAuth path.
 */
export function createConnectorTestSeam(
  environment: ConnectorTestSeamEnvironment,
  allowTestSeam: boolean,
  nativeFetch: typeof fetch = fetch,
): ConnectorTestSeam | null {
  const providerUrl = environment.OUTREACHR_E2E_GOOGLE_PROVIDER_URL;
  const testSeamProof = environment.OUTREACHR_E2E_SECRET_KEY;
  if (!providerUrl && !testSeamProof) return null;
  if (!allowTestSeam) {
    throw new Error('Electron connector test hooks are disabled in packaged applications');
  }
  if (environment.NODE_ENV !== 'test') {
    throw new Error('Electron connector test hooks are disabled outside NODE_ENV=test');
  }
  if (!providerUrl || !testSeamProof) {
    throw new Error(`${E2E_PROVIDER_URL} and ${E2E_SECRET_KEY} must be provided together`);
  }

  const mockBase = validatedLoopbackBaseUrl(providerUrl);
  const providerFetch: typeof fetch = async (input, init) => {
    const rewritten = rewrittenGoogleProviderUrl(input, mockBase);
    if (input instanceof Request) return nativeFetch(new Request(rewritten, input), init);
    return nativeFetch(rewritten, init);
  };

  return {
    fetch: providerFetch,
    authorizeForTest: async (request) => {
      const authorizationUrl = new URL(request.authorizationUrl);
      if (authorizationUrl.origin !== 'https://accounts.google.com') {
        throw new Error('The Electron connector test seam only authorizes Google test requests');
      }
      const callback = new URL(request.redirectUri);
      callback.searchParams.set('code', 'outreachr-e2e-google-code');
      callback.searchParams.set('state', request.state);
      return callback.toString();
    },
    secretBackend: new E2eEncryptedSecretBackend(testSeamProof),
  };
}
