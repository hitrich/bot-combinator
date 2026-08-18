import type { ReactNode } from 'react';
import {
  Apple,
  Download,
  FileCheck2,
  HardDriveDownload,
  LockKeyhole,
  Monitor,
  PackageCheck,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  desktopReleaseConfig,
  detectDesktopPlatform,
  type DesktopPlatformId,
} from '../lib/desktop-downloads';
import { Badge, cx } from '../components/Primitives';

const PLATFORM_ICONS: Record<DesktopPlatformId, ReactNode> = {
  macos: <Apple aria-hidden="true" />,
  windows: <Monitor aria-hidden="true" />,
  linux: <Terminal aria-hidden="true" />,
};

const INSTALL_STEPS = [
  {
    icon: <HardDriveDownload aria-hidden="true" />,
    number: '01',
    title: 'Choose your installer',
    detail:
      'Use the package and processor architecture that match the computer running your workspace.',
  },
  {
    icon: <FileCheck2 aria-hidden="true" />,
    number: '02',
    title: 'Check the release',
    detail: 'Review the signing status and SHA-256 manifest supplied with every verified package.',
  },
  {
    icon: <PackageCheck aria-hidden="true" />,
    number: '03',
    title: 'Install once',
    detail:
      'Launch Bot Combinator from your Applications folder or system menu—no development command required.',
  },
];

export function DesktopDownloadsView(): React.JSX.Element {
  const detectedPlatform = detectDesktopPlatform(
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
  );

  return (
    <section className="desktop-downloads view-enter">
      <header className="desktop-downloads__header">
        <div>
          <p className="eyebrow">Desktop distribution</p>
          <h1>Desktop app</h1>
          <p>
            Install the private Bot Combinator workspace for CRM, integrations, and local agents.
            Only progress you explicitly submit is shared with the portal.
          </p>
        </div>
        <aside aria-label="Current desktop release">
          <span>
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <small>Release channel</small>
            <strong>{desktopReleaseConfig.version}</strong>
            <em>Verified packages</em>
          </div>
        </aside>
      </header>

      <div className="desktop-platforms" aria-label="Desktop installers">
        {desktopReleaseConfig.platforms.map((platform) => {
          const recommended = platform.id === detectedPlatform;
          return (
            <article
              key={platform.id}
              className={cx('desktop-platform', recommended && 'is-recommended')}
            >
              <div className="desktop-platform__identity">
                <span>{PLATFORM_ICONS[platform.id]}</span>
                <div>
                  <small>{platform.packageLabel}</small>
                  <h2>{platform.name}</h2>
                </div>
              </div>
              <div className="desktop-platform__architecture">
                <small>Available builds</small>
                <strong>
                  {platform.installers.map((installer) => installer.label).join(' · ')}
                </strong>
              </div>
              <div className="desktop-platform__status">
                {recommended ? <Badge tone="lime">Recommended for this device</Badge> : null}
                {!platform.direct ? <Badge tone="neutral">Awaiting package</Badge> : null}
              </div>
              <div className="desktop-platform__downloads">
                {platform.installers.map((installer) =>
                  installer.url ? (
                    <a
                      key={installer.id}
                      className={cx(
                        'button button--medium',
                        recommended ? 'button--primary' : 'button--secondary',
                      )}
                      href={installer.url}
                      aria-label={`Download Bot Combinator for ${platform.name} ${installer.label}`}
                    >
                      <Download aria-hidden="true" />
                      <span>{installer.label}</span>
                    </a>
                  ) : (
                    <button
                      key={installer.id}
                      className="button button--secondary button--medium"
                      type="button"
                      disabled
                    >
                      <Download aria-hidden="true" />
                      <span>{installer.label}</span>
                    </button>
                  ),
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="desktop-release-access" aria-labelledby="release-access-title">
        <span>
          <LockKeyhole aria-hidden="true" />
        </span>
        <div>
          <p className="section-kicker">Release access</p>
          <h2 id="release-access-title">
            {desktopReleaseConfig.hasDirectDownloads
              ? 'Installers are ready from the portal.'
              : 'Installer files are not published yet.'}
          </h2>
          <p>
            {desktopReleaseConfig.hasDirectDownloads
              ? 'Each button downloads its matching package directly from Vercel Blob. You remain in the portal and are never redirected to GitHub.'
              : 'Each architecture will download its own verified package here after the six native bundles are uploaded to Bot Combinator’s Vercel storage.'}
          </p>
        </div>
      </section>

      <section className="desktop-installation" aria-labelledby="installation-title">
        <header className="section-heading">
          <div>
            <p className="section-kicker">Installation</p>
            <h2 id="installation-title">From package to workspace</h2>
          </div>
          <span>Three steps</span>
        </header>
        <div className="desktop-installation__steps">
          {INSTALL_STEPS.map((step) => (
            <article key={step.number}>
              <header>
                <span>{step.icon}</span>
                <small>{step.number}</small>
              </header>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
