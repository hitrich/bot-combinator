import { describe, expect, it } from 'vitest';
import { createEncryptedBackup, restoreEncryptedBackup } from '../src/index.js';

const PASSPHRASE = 'correct horse battery staple';

describe('encrypted backup resource bounds', () => {
  it('rejects unsafe or invalid scrypt parameters before deriving a key', async () => {
    await expect(
      createEncryptedBackup(new Uint8Array([1, 2, 3]), PASSPHRASE, {
        scrypt: { N: 1_025, r: 8, p: 1 },
      }),
    ).rejects.toThrow('outside the supported safety bounds');

    await expect(
      createEncryptedBackup(new Uint8Array([1, 2, 3]), PASSPHRASE, {
        scrypt: { N: 131_072, r: 8, p: 1 },
      }),
    ).rejects.toThrow('outside the supported safety bounds');
  });

  it('rejects malformed salt, nonce, and tag encodings before decryption', async () => {
    const backup = await createEncryptedBackup(new Uint8Array([1, 2, 3]), PASSPHRASE, {
      scrypt: { N: 1_024, r: 8, p: 1 },
    });
    const parsed = JSON.parse(Buffer.from(backup).toString('utf8')) as {
      kdf: { salt: string };
      cipher: { iv: string; authTag: string };
    };

    for (const mutate of [
      (value: typeof parsed) => (value.kdf.salt = 'AA=='),
      (value: typeof parsed) => (value.cipher.iv = 'AA=='),
      (value: typeof parsed) => (value.cipher.authTag = 'AA=='),
    ]) {
      const copy = structuredClone(parsed);
      mutate(copy);
      await expect(
        restoreEncryptedBackup(Buffer.from(JSON.stringify(copy)), PASSPHRASE),
      ).rejects.toThrow();
    }
  });
});
