import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function renderDocumentsPage(): void {
  window.location.hash = '#/documents';
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

async function suggestedPackage(): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: 'Suggested package' });
  const section = heading.closest('section');
  if (!section) throw new Error('Suggested package heading must belong to a section.');
  return section;
}

describe('DocumentsPage suggested package', () => {
  it('shows honest missing and later states when no founder document references are tracked', async () => {
    installBridge(bootstrapFixture());
    renderDocumentsPage();

    expect(await screen.findByRole('heading', { name: 'Documents & data room' })).toBeVisible();
    const packageSection = within(await suggestedPackage());

    expect(packageSection.getByRole('list', { name: 'Suggested package status' })).toBeVisible();
    expect(packageSection.getAllByText('Missing')).toHaveLength(2);
    expect(packageSection.getByText('Later')).toBeVisible();
    expect(
      packageSection.getByText(
        'Matched from your tracked links and local references. A match does not grant access or prove that a document is current.',
      ),
    ).toBeVisible();
    expect(packageSection.queryByText('Linked')).not.toBeInTheDocument();
  });

  it('matches the newest tracked package items and explains each disclosure boundary', async () => {
    const fixture = bootstrapFixture();
    fixture.knowledge = [
      {
        id: 'knowledge:short-old',
        title: 'Old short deck',
        category: 'narrative',
        content: 'https://docs.local.test/short-old',
        updatedAt: '2026-06-01T12:00:00.000Z',
        sharePolicy: 'safe_for_outreach',
      },
      {
        id: 'knowledge:short-current',
        title: 'Local Labs investor intro slides',
        category: 'narrative',
        content: 'file:/Users/founder/Local Labs intro.pdf',
        updatedAt: '2026-07-31T12:00:00.000Z',
        sharePolicy: 'meeting_only',
      },
      {
        id: 'knowledge:full',
        title: 'Local Labs full fundraising deck',
        category: 'company',
        content: 'https://docs.local.test/full-deck',
        updatedAt: '2026-07-30T12:00:00.000Z',
        sharePolicy: 'meeting_only',
      },
      {
        id: 'knowledge:diligence',
        title: 'Investor data-room index',
        category: 'company',
        content: 'https://docs.local.test/data-room',
        updatedAt: '2026-07-29T12:00:00.000Z',
        sharePolicy: 'safe_for_outreach',
      },
      {
        id: 'knowledge:note',
        title: 'Pitch deck narrative note',
        category: 'narrative',
        content: 'A private working note, not a document reference.',
        updatedAt: '2026-08-01T12:00:00.000Z',
        sharePolicy: 'internal',
      },
    ];
    installBridge(fixture);
    renderDocumentsPage();

    const packageSection = within(await suggestedPackage());
    expect(packageSection.getAllByText('Linked')).toHaveLength(3);
    expect(
      packageSection.getByText('Current tracked item: Local Labs investor intro slides'),
    ).toBeVisible();
    expect(
      packageSection.getByText('Meeting only; it stays out of initial outreach.'),
    ).toBeVisible();
    expect(
      packageSection.getByText('Current tracked item: Local Labs full fundraising deck'),
    ).toBeVisible();
    expect(
      packageSection.getByText(
        'Meeting only; suitable for a scheduled meeting or explicit follow-up.',
      ),
    ).toBeVisible();
    expect(
      packageSection.getByText('Current tracked item: Investor data-room index'),
    ).toBeVisible();
    expect(
      packageSection.getByText(
        'Safe for outreach is broader than this material usually needs; consider tightening its policy.',
      ),
    ).toBeVisible();
    expect(
      packageSection.queryByText('Current tracked item: Old short deck'),
    ).not.toBeInTheDocument();
    expect(packageSection.queryByText(/Pitch deck narrative note/u)).not.toBeInTheDocument();
  });
});
