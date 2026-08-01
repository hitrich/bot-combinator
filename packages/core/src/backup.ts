import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { BackupEnvelopeSchema, stableJson, type BackupEnvelope } from './validation.js';

export interface BackupHooks {
  beforeEncrypt?(sqliteBytes: Uint8Array): void | Promise<void>;
  afterEncrypt?(envelope: BackupEnvelope): void | Promise<void>;
  beforeDecrypt?(envelope: BackupEnvelope): void | Promise<void>;
  afterDecrypt?(sqliteBytes: Uint8Array): void | Promise<void>;
}

export interface EncryptBackupOptions {
  readonly createdAt?: string;
  readonly hooks?: BackupHooks;
  readonly scrypt?: { readonly N?: number; readonly r?: number; readonly p?: number };
  readonly random?: (size: number) => Uint8Array;
}

interface BackupHeader {
  createdAt: string;
  sqliteSha256: string;
  kdf: BackupEnvelope['kdf'];
  cipher: Pick<BackupEnvelope['cipher'], 'name' | 'iv'>;
}

function authenticatedHeader(header: BackupHeader): Buffer {
  return Buffer.from(
    stableJson({ format: 'outreachr-encrypted-backup', version: 1, ...header }),
    'utf8',
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function deriveKey(
  password: string,
  salt: Uint8Array,
  parameters: { N: number; r: number; p: number },
): Buffer {
  if (password.length < 12)
    throw new Error('Backup passphrase must contain at least 12 characters');
  if (
    !Number.isInteger(parameters.N) ||
    parameters.N < 1024 ||
    parameters.N > 65_536 ||
    !Number.isInteger(Math.log2(parameters.N)) ||
    !Number.isInteger(parameters.r) ||
    parameters.r < 1 ||
    parameters.r > 16 ||
    !Number.isInteger(parameters.p) ||
    parameters.p < 1 ||
    parameters.p > 4
  ) {
    throw new Error('Backup scrypt parameters are outside the supported safety bounds');
  }
  return scryptSync(password, salt, 32, {
    ...parameters,
    maxmem: Math.max(128 * parameters.N * parameters.r * 2, 64 * 1024 * 1024),
  });
}

export async function createEncryptedBackup(
  sqliteBytes: Uint8Array,
  password: string,
  options: EncryptBackupOptions = {},
): Promise<Uint8Array> {
  await options.hooks?.beforeEncrypt?.(sqliteBytes);
  const random = options.random ?? randomBytes;
  const salt = random(32);
  const iv = random(12);
  if (salt.byteLength !== 32 || iv.byteLength !== 12) {
    throw new Error('Backup entropy source returned an invalid byte length');
  }
  const parameters = {
    N: options.scrypt?.N ?? 32_768,
    r: options.scrypt?.r ?? 8,
    p: options.scrypt?.p ?? 1,
  };
  const createdAt = options.createdAt ?? new Date().toISOString();
  const sqliteSha256 = sha256(sqliteBytes);
  const kdf = {
    name: 'scrypt' as const,
    salt: Buffer.from(salt).toString('base64'),
    ...parameters,
  };
  const cipherHeader = { name: 'aes-256-gcm' as const, iv: Buffer.from(iv).toString('base64') };
  const key = deriveKey(password, salt, parameters);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(authenticatedHeader({ createdAt, sqliteSha256, kdf, cipher: cipherHeader }));
  const ciphertext = Buffer.concat([cipher.update(sqliteBytes), cipher.final()]);
  const envelope = BackupEnvelopeSchema.parse({
    format: 'outreachr-encrypted-backup',
    version: 1,
    createdAt,
    sqliteSha256,
    kdf,
    cipher: { ...cipherHeader, authTag: cipher.getAuthTag().toString('base64') },
    ciphertext: ciphertext.toString('base64'),
  });
  await options.hooks?.afterEncrypt?.(envelope);
  return Buffer.from(`${stableJson(envelope)}\n`, 'utf8');
}

export async function restoreEncryptedBackup(
  envelopeBytes: Uint8Array,
  password: string,
  hooks: BackupHooks = {},
): Promise<Uint8Array> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(envelopeBytes).toString('utf8'));
  } catch {
    throw new Error('Backup envelope is not valid JSON');
  }
  const envelope = BackupEnvelopeSchema.parse(parsed);
  await hooks.beforeDecrypt?.(envelope);
  const salt = Buffer.from(envelope.kdf.salt, 'base64');
  const iv = Buffer.from(envelope.cipher.iv, 'base64');
  const authTag = Buffer.from(envelope.cipher.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const key = deriveKey(password, salt, {
    N: envelope.kdf.N,
    r: envelope.kdf.r,
    p: envelope.kdf.p,
  });
  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAAD(
      authenticatedHeader({
        createdAt: envelope.createdAt,
        sqliteSha256: envelope.sqliteSha256,
        kdf: envelope.kdf,
        cipher: { name: envelope.cipher.name, iv: envelope.cipher.iv },
      }),
    );
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Backup authentication failed: wrong passphrase or modified backup');
  }
  const expected = Buffer.from(envelope.sqliteSha256, 'hex');
  const actual = Buffer.from(sha256(plaintext), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error('Restored SQLite checksum does not match the envelope');
  const result = new Uint8Array(plaintext);
  await hooks.afterDecrypt?.(result);
  return result;
}
