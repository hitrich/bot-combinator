import type { SecretStoreBackend, SecretStoreStatus } from '../../src/main/secure-store';

const PREFIX = Buffer.from('bot-combinator-test-cipher-v1:', 'utf8');

export class FakeSecretBackend implements SecretStoreBackend {
  available = true;
  backend = 'test-keyring';
  reason: string | null = null;
  encryptions = 0;
  decryptions = 0;
  reEncryptNext = false;

  async status(): Promise<SecretStoreStatus> {
    return { available: this.available, backend: this.backend, reason: this.reason };
  }

  async encrypt(value: string): Promise<Buffer> {
    if (!this.available) throw new Error(this.reason ?? 'Test credential backend unavailable');
    this.encryptions += 1;
    const bytes = Buffer.from(value, 'utf8');
    const encrypted = Buffer.alloc(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      encrypted[index] = bytes[index]! ^ 0xa5;
    }
    return Buffer.concat([PREFIX, encrypted]);
  }

  async decrypt(value: Buffer): Promise<{ plaintext: string; shouldReEncrypt: boolean }> {
    if (!this.available) throw new Error(this.reason ?? 'Test credential backend unavailable');
    if (!value.subarray(0, PREFIX.length).equals(PREFIX))
      throw new Error('Invalid test ciphertext');
    this.decryptions += 1;
    const bytes = value.subarray(PREFIX.length);
    const decrypted = Buffer.alloc(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      decrypted[index] = bytes[index]! ^ 0xa5;
    }
    const shouldReEncrypt = this.reEncryptNext;
    this.reEncryptNext = false;
    return { plaintext: decrypted.toString('utf8'), shouldReEncrypt };
  }
}
