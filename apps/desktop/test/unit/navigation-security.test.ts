import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
  resolveDesktopLaunchHooks,
} from '../../src/main/navigation-security';

describe('renderer navigation boundary', () => {
  const entry = join('/Applications', 'Outreachr.app', 'renderer', 'index.html');

  it('allows only the packaged renderer file, including its local hash routes', () => {
    const url = pathToFileURL(entry).toString();
    expect(isAllowedRendererNavigation(url, entry)).toBe(true);
    expect(isAllowedRendererNavigation(`${url}#/investors?list=focus`, entry)).toBe(true);
    expect(isAllowedRendererNavigation(`${url}?unexpected=1`, entry)).toBe(true);
  });

  it('rejects every other local file and non-application scheme', () => {
    expect(isAllowedRendererNavigation('file:///tmp/attacker.html', entry)).toBe(false);
    expect(isAllowedRendererNavigation('https://example.com/', entry)).toBe(false);
    expect(isAllowedRendererNavigation('javascript:alert(1)', entry)).toBe(false);
    expect(isAllowedRendererNavigation('data:text/html,attacker', entry)).toBe(false);
    expect(isAllowedRendererNavigation('not a url', entry)).toBe(false);
  });

  it('allows same-origin development routes without weakening packaged navigation', () => {
    const developmentUrl = 'http://127.0.0.1:5173';
    expect(
      isAllowedRendererNavigation('http://127.0.0.1:5173/src/main.tsx', entry, developmentUrl),
    ).toBe(true);
    expect(isAllowedRendererNavigation('http://localhost:5173/', entry, developmentUrl)).toBe(
      false,
    );
    expect(isAllowedRendererNavigation('https://127.0.0.1:5173/', entry, developmentUrl)).toBe(
      false,
    );
  });

  it('removes every development and test hook from packaged launches', () => {
    expect(
      resolveDesktopLaunchHooks(
        {
          NODE_ENV: 'test',
          ELECTRON_RENDERER_URL: 'http://127.0.0.1:5173',
          OUTREACHR_E2E_DATA_DIR: '/tmp/attacker-vault',
          OUTREACHR_OPEN_DEVTOOLS: '1',
        },
        true,
      ),
    ).toEqual({
      developmentRendererUrl: undefined,
      e2eDataDirectory: undefined,
      openDevTools: false,
    });
  });

  it('accepts only an exact loopback HTTP origin for an unpackaged renderer', () => {
    expect(
      resolveDesktopLaunchHooks({ ELECTRON_RENDERER_URL: 'http://localhost:5173' }, false)
        .developmentRendererUrl,
    ).toBe('http://localhost:5173');
    expect(
      resolveDesktopLaunchHooks({ ELECTRON_RENDERER_URL: 'http://[::1]:5173/' }, false)
        .developmentRendererUrl,
    ).toBe('http://[::1]:5173');

    for (const value of [
      'https://localhost:5173',
      'http://renderer.example.test:5173',
      'http://127.0.0.1:5173/application',
      'http://user@127.0.0.1:5173',
      'http://127.0.0.1:5173/?token=secret',
    ]) {
      expect(() => resolveDesktopLaunchHooks({ ELECTRON_RENDERER_URL: value }, false)).toThrow(
        'exact http://localhost:<port> loopback origin',
      );
    }
  });

  it('allows the isolated data directory only in an unpackaged test process', () => {
    expect(
      resolveDesktopLaunchHooks(
        { NODE_ENV: 'test', OUTREACHR_E2E_DATA_DIR: '/tmp/outreachr-e2e' },
        false,
      ).e2eDataDirectory,
    ).toBe('/tmp/outreachr-e2e');
    expect(() =>
      resolveDesktopLaunchHooks(
        { NODE_ENV: 'production', OUTREACHR_E2E_DATA_DIR: '/tmp/outreachr-e2e' },
        false,
      ),
    ).toThrow('disabled outside NODE_ENV=test');
  });

  it('opens only credential-free HTTPS URLs in the system browser', () => {
    expect(isAllowedExternalUrl('https://example.com/path?q=1')).toBe(true);
    expect(isAllowedExternalUrl('http://example.com/')).toBe(false);
    expect(isAllowedExternalUrl('http://127.0.0.1:8080/admin')).toBe(false);
    expect(isAllowedExternalUrl('https://user:password@example.com/')).toBe(false);
    expect(isAllowedExternalUrl('file:///tmp/attacker.html')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl({ toString: () => 'https://example.com/' })).toBe(false);
  });
});
