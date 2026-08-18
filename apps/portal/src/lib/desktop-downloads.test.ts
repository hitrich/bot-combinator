import { describe, expect, it } from 'vitest';
import { buildDesktopReleaseConfig, detectDesktopPlatform } from './desktop-downloads';

describe('desktop download configuration', () => {
  it('detects the supported desktop operating systems', () => {
    expect(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macos');
    expect(detectDesktopPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('windows');
    expect(detectDesktopPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('linux');
    expect(
      detectDesktopPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile'),
    ).toBeNull();
  });

  it('leaves installers unavailable until direct files are configured', () => {
    const release = buildDesktopReleaseConfig({ version: 'v0.1.2' });

    expect(release.version).toBe('v0.1.2');
    expect(release.hasDirectDownloads).toBe(false);
    expect(
      release.platforms.every((platform) =>
        platform.installers.every((installer) => installer.url === null),
      ),
    ).toBe(true);
  });

  it('accepts HTTPS installers and rejects unsafe download protocols', () => {
    const release = buildDesktopReleaseConfig({
      macosArm64Url: 'https://downloads.klineo.io/Bot-Combinator-arm64.dmg',
      macosX64Url: 'https://downloads.klineo.io/Bot-Combinator-x64.dmg',
      windowsX64Url: 'javascript:alert(1)',
      windowsArm64Url: 'https://downloads.klineo.io/Bot-Combinator-arm64.exe',
      linuxX64Url: 'http://downloads.klineo.io/Bot-Combinator-x64.AppImage',
      linuxArm64Url: 'https://downloads.klineo.io/Bot-Combinator-arm64.AppImage',
    });

    const macos = release.platforms.find((platform) => platform.id === 'macos');
    const windows = release.platforms.find((platform) => platform.id === 'windows');
    const linux = release.platforms.find((platform) => platform.id === 'linux');

    expect(macos?.direct).toBe(true);
    expect(windows?.direct).toBe(true);
    expect(
      windows?.installers.find((installer) => installer.architecture === 'arm64')?.direct,
    ).toBe(true);
    expect(linux?.direct).toBe(true);
    expect(linux?.installers.find((installer) => installer.architecture === 'arm64')?.direct).toBe(
      true,
    );
    expect(release.hasDirectDownloads).toBe(true);
  });
});
