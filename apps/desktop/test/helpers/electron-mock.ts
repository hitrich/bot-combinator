export const safeStorage = {
  getSelectedStorageBackend: (): string => 'basic_text',
  isEncryptionAvailable: (): boolean => false,
  encryptString: (): Buffer => {
    throw new Error('Electron safeStorage was used without an injected test backend');
  },
  decryptString: (): string => {
    throw new Error('Electron safeStorage was used without an injected test backend');
  },
};
