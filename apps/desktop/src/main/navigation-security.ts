import { pathToFileURL } from 'node:url';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export interface DesktopLaunchEnvironment {
  NODE_ENV?: string;
  ELECTRON_RENDERER_URL?: string;
  OUTREACHR_E2E_DATA_DIR?: string;
  OUTREACHR_OPEN_DEVTOOLS?: string;
}

export interface DesktopLaunchHooks {
  developmentRendererUrl: string | undefined;
  e2eDataDirectory: string | undefined;
  openDevTools: boolean;
}

/**
 * Development hooks are never honored by a packaged binary. Unpackaged builds
 * accept only an exact loopback HTTP origin, and the test data-directory seam
 * additionally requires NODE_ENV=test.
 */
export function resolveDesktopLaunchHooks(
  environment: DesktopLaunchEnvironment,
  isPackaged: boolean,
): DesktopLaunchHooks {
  if (isPackaged) {
    return {
      developmentRendererUrl: undefined,
      e2eDataDirectory: undefined,
      openDevTools: false,
    };
  }

  let developmentRendererUrl: string | undefined;
  if (environment.ELECTRON_RENDERER_URL) {
    const url = new URL(environment.ELECTRON_RENDERER_URL);
    if (
      url.protocol !== 'http:' ||
      !LOOPBACK_HOSTS.has(url.hostname) ||
      !url.port ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        'ELECTRON_RENDERER_URL must be an exact http://localhost:<port> loopback origin',
      );
    }
    developmentRendererUrl = url.origin;
  }

  let e2eDataDirectory: string | undefined;
  if (environment.OUTREACHR_E2E_DATA_DIR) {
    if (environment.NODE_ENV !== 'test') {
      throw new Error('OUTREACHR_E2E_DATA_DIR is disabled outside NODE_ENV=test');
    }
    if (
      environment.OUTREACHR_E2E_DATA_DIR.length > 4_096 ||
      environment.OUTREACHR_E2E_DATA_DIR.includes('\0')
    ) {
      throw new Error('OUTREACHR_E2E_DATA_DIR is invalid');
    }
    e2eDataDirectory = environment.OUTREACHR_E2E_DATA_DIR;
  }

  return {
    developmentRendererUrl,
    e2eDataDirectory,
    openDevTools: environment.OUTREACHR_OPEN_DEVTOOLS === '1',
  };
}

export function isAllowedExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4_096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isAllowedRendererNavigation(
  value: string,
  rendererEntryPath: string,
  developmentRendererUrl?: string,
): boolean {
  try {
    const candidate = new URL(value);
    if (developmentRendererUrl) {
      const developmentOrigin = new URL(developmentRendererUrl).origin;
      if (candidate.origin === developmentOrigin) return true;
    }
    if (candidate.protocol !== 'file:') return false;
    candidate.hash = '';
    candidate.search = '';
    return candidate.href === pathToFileURL(rendererEntryPath).href;
  } catch {
    return false;
  }
}
