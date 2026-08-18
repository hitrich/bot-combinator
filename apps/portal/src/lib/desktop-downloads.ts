export type DesktopPlatformId = 'macos' | 'windows' | 'linux';
export type DesktopArchitectureId = 'arm64' | 'x64';

export interface DesktopDownloadEnvironment {
  version?: string;
  macosArm64Url?: string;
  macosX64Url?: string;
  windowsX64Url?: string;
  windowsArm64Url?: string;
  linuxX64Url?: string;
  linuxArm64Url?: string;
}

export interface DesktopInstallerDownload {
  id: `${DesktopPlatformId}-${DesktopArchitectureId}`;
  architecture: DesktopArchitectureId;
  label: string;
  url: string | null;
  direct: boolean;
}

export interface DesktopPlatformDownload {
  id: DesktopPlatformId;
  name: string;
  packageLabel: string;
  installers: DesktopInstallerDownload[];
  direct: boolean;
}

export interface DesktopReleaseConfig {
  version: string;
  platforms: DesktopPlatformDownload[];
  hasDirectDownloads: boolean;
}

const PLATFORM_DETAILS: Array<
  Omit<DesktopPlatformDownload, 'installers' | 'direct'> & {
    installers: Array<
      Omit<DesktopInstallerDownload, 'url' | 'direct'> & {
        environmentKey: Exclude<keyof DesktopDownloadEnvironment, 'version'>;
      }
    >;
  }
> = [
  {
    id: 'macos',
    name: 'macOS',
    packageLabel: 'DMG installer',
    installers: [
      {
        id: 'macos-arm64',
        architecture: 'arm64',
        label: 'Apple silicon',
        environmentKey: 'macosArm64Url',
      },
      {
        id: 'macos-x64',
        architecture: 'x64',
        label: 'Intel',
        environmentKey: 'macosX64Url',
      },
    ],
  },
  {
    id: 'windows',
    name: 'Windows',
    packageLabel: 'EXE installer',
    installers: [
      {
        id: 'windows-x64',
        architecture: 'x64',
        label: 'x64',
        environmentKey: 'windowsX64Url',
      },
      {
        id: 'windows-arm64',
        architecture: 'arm64',
        label: 'ARM64',
        environmentKey: 'windowsArm64Url',
      },
    ],
  },
  {
    id: 'linux',
    name: 'Linux',
    packageLabel: 'AppImage',
    installers: [
      {
        id: 'linux-x64',
        architecture: 'x64',
        label: 'x64',
        environmentKey: 'linuxX64Url',
      },
      {
        id: 'linux-arm64',
        architecture: 'arm64',
        label: 'ARM64',
        environmentKey: 'linuxArm64Url',
      },
    ],
  },
];

function safeHttpsUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function detectDesktopPlatform(userAgent = ''): DesktopPlatformId | null {
  const normalized = userAgent.toLowerCase();
  if (/(android|iphone|ipad|ipod|mobile|cros)/.test(normalized)) return null;
  if (normalized.includes('macintosh') || normalized.includes('mac os')) return 'macos';
  if (normalized.includes('windows')) return 'windows';
  if (normalized.includes('linux') || normalized.includes('x11')) return 'linux';
  return null;
}

export function buildDesktopReleaseConfig(
  environment: DesktopDownloadEnvironment,
): DesktopReleaseConfig {
  const platforms = PLATFORM_DETAILS.map((platform) => {
    const installers = platform.installers.map(({ environmentKey, ...installer }) => {
      const url = safeHttpsUrl(environment[environmentKey]);
      return { ...installer, url, direct: Boolean(url) };
    });
    return {
      id: platform.id,
      name: platform.name,
      packageLabel: platform.packageLabel,
      installers,
      direct: installers.some((installer) => installer.direct),
    };
  });

  return {
    version: environment.version?.trim() || 'Latest verified release',
    platforms,
    hasDirectDownloads: platforms.every((platform) => platform.direct),
  };
}

export const desktopReleaseConfig = buildDesktopReleaseConfig({
  version: import.meta.env.VITE_DESKTOP_VERSION,
  macosArm64Url: import.meta.env.VITE_DESKTOP_MACOS_ARM64_URL,
  macosX64Url: import.meta.env.VITE_DESKTOP_MACOS_X64_URL,
  windowsX64Url: import.meta.env.VITE_DESKTOP_WINDOWS_X64_URL,
  windowsArm64Url: import.meta.env.VITE_DESKTOP_WINDOWS_ARM64_URL,
  linuxX64Url: import.meta.env.VITE_DESKTOP_LINUX_X64_URL,
  linuxArm64Url: import.meta.env.VITE_DESKTOP_LINUX_ARM64_URL,
});
