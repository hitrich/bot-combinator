import { createRequire } from 'node:module';
import { CoreVault, initializeSqlite, type OpenVaultOptions } from './database.js';

const require = createRequire(import.meta.url);

export interface OpenNodeVaultOptions extends OpenVaultOptions {
  readonly wasmPath?: string;
}

export async function openNodeVault(options: OpenNodeVaultOptions = {}): Promise<CoreVault> {
  const wasmPath = options.wasmPath ?? require.resolve('sql.js/dist/sql-wasm.wasm');
  const sqlite = await initializeSqlite({ locateFile: () => wasmPath });
  return new CoreVault(sqlite, {
    ...(options.bytes ? { bytes: options.bytes } : {}),
    ...(options.appliedAt ? { appliedAt: options.appliedAt } : {}),
  });
}
