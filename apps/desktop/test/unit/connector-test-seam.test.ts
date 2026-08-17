import { describe, expect, it, vi } from 'vitest';
import { createConnectorTestSeam } from '../../src/main/connector-test-seam';

const validEnvironment = {
  NODE_ENV: 'test',
  BOT_COMBINATOR_E2E_GOOGLE_PROVIDER_URL: 'http://127.0.0.1:43123',
  BOT_COMBINATOR_E2E_SECRET_KEY: 'ab'.repeat(32),
} as const;

describe('built-Electron connector test seam', () => {
  it('is absent from ordinary application launches', () => {
    expect(createConnectorTestSeam({ NODE_ENV: 'production' }, false)).toBeNull();
  });

  it('fails closed in packaged apps, outside test mode, or with an unsafe endpoint', () => {
    expect(() => createConnectorTestSeam(validEnvironment, false)).toThrow(
      'disabled in packaged applications',
    );
    expect(() =>
      createConnectorTestSeam(
        {
          ...validEnvironment,
          NODE_ENV: 'production',
        },
        true,
      ),
    ).toThrow('disabled outside NODE_ENV=test');
    expect(() =>
      createConnectorTestSeam(
        {
          ...validEnvironment,
          BOT_COMBINATOR_E2E_GOOGLE_PROVIDER_URL: 'https://providers.example.test',
        },
        true,
      ),
    ).toThrow('http://127.0.0.1:<port>');
    expect(() =>
      createConnectorTestSeam(
        {
          NODE_ENV: 'test',
          BOT_COMBINATOR_E2E_GOOGLE_PROVIDER_URL: 'http://127.0.0.1:43123',
        },
        true,
      ),
    ).toThrow('must be provided together');
  });

  it('rewrites only Google provider requests and encrypts test credentials', async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response('{}'));
    const seam = createConnectorTestSeam(validEnvironment, true, fetchSpy);
    expect(seam).not.toBeNull();

    await seam!.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?pageToken=2');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:43123/gmail/v1/users/me/messages?pageToken=2',
      undefined,
    );
    await expect(seam!.fetch('https://api.example.test/private')).rejects.toThrow(
      'blocked an unexpected URL',
    );

    const ciphertext = await seam!.secretBackend.encrypt('refresh-token-secret');
    expect(ciphertext.toString()).not.toContain('refresh-token-secret');
    await expect(seam!.secretBackend.decrypt(ciphertext)).resolves.toEqual({
      plaintext: 'refresh-token-secret',
      shouldReEncrypt: false,
    });
  });

  it('returns a matching loopback callback only for Google authorization requests', async () => {
    const seam = createConnectorTestSeam(validEnvironment, true, vi.fn<typeof fetch>());
    const callback = await seam!.authorizeForTest({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
      state: 'state-value',
      pkce: { verifier: 'v'.repeat(43), challenge: 'challenge', method: 'S256' },
      redirectUri: 'http://127.0.0.1:19876/oauth/callback',
      scopes: ['openid'],
    });
    expect(new URL(callback).searchParams.get('code')).toBe('bot-combinator-e2e-google-code');
    expect(new URL(callback).searchParams.get('state')).toBe('state-value');

    await expect(
      seam!.authorizeForTest({
        authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        state: 'state-value',
        pkce: { verifier: 'v'.repeat(43), challenge: 'challenge', method: 'S256' },
        redirectUri: 'http://127.0.0.1:19876/oauth/callback',
        scopes: ['openid'],
      }),
    ).rejects.toThrow('only authorizes Google');
  });
});
