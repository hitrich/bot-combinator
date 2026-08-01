import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CommandResultMap } from '../../src/shared/contracts';
import { App } from '../../src/renderer/src/App';
import { isSecureExternalUrl } from '../../src/renderer/src/lib/external-links';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function renderApplication(route = '#/'): void {
  window.location.hash = route;
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

describe('renderer production UX boundaries', () => {
  it('only treats credential-free HTTPS destinations as safe external links', () => {
    expect(isSecureExternalUrl('https://example.com/path?q=1')).toBe(true);
    expect(isSecureExternalUrl('https://user:pass@example.com/private')).toBe(false);
    expect(isSecureExternalUrl('http://example.com')).toBe(false);
    expect(isSecureExternalUrl('mailto:founder@example.com')).toBe(false);
    expect(isSecureExternalUrl('not a URL')).toBe(false);
  });

  it('restores focus to the dialog opener and exposes the dialog description', async () => {
    installBridge(bootstrapFixture());
    renderApplication('#/investors');

    const opener = await screen.findByRole('button', { name: 'Add investor' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Add an investor' });
    expect(dialog).toHaveAccessibleDescription(
      'Create a private local firm record. Add sources before contributing public facts.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('moves investor tabs with arrow keys and teaches an empty people result', async () => {
    const fixture = bootstrapFixture();
    fixture.people = [];
    installBridge(fixture);
    renderApplication('#/investors');

    const firmsTab = await screen.findByRole('tab', { name: /Firms/u });
    firmsTab.focus();
    fireEvent.keyDown(firmsTab, { key: 'ArrowRight' });

    const peopleTab = screen.getByRole('tab', { name: /People/u });
    await waitFor(() => expect(peopleTab).toHaveFocus());
    expect(peopleTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/People/u);
    expect(screen.getByRole('heading', { name: 'No people match this view' })).toBeVisible();
  });

  it('finds additional investor kinds by label and filters by every tagged type', async () => {
    const fixture = bootstrapFixture();
    fixture.investors[0] = {
      ...fixture.investors[0]!,
      additionalKinds: ['crypto_fund'],
    };
    fixture.investors.push({
      ...fixture.investors[0]!,
      id: 'firm:angel',
      name: 'Independent Angel',
      kind: 'angel',
      additionalKinds: [],
    });
    installBridge(fixture);
    renderApplication('#/investors');

    const search = await screen.findByRole('searchbox', { name: 'Search firms' });
    fireEvent.change(search, { target: { value: 'Crypto Fund' } });
    let table = screen.getByRole('table');
    expect(within(table).getByText('Calm Capital')).toBeVisible();
    expect(within(table).queryByText('Independent Angel')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by investor type' }), {
      target: { value: 'crypto_fund' },
    });
    table = screen.getByRole('table');
    expect(within(table).getByText('Calm Capital')).toBeVisible();
    expect(within(table).queryByText('Independent Angel')).not.toBeInTheDocument();
  });

  it('focuses the main landmark and updates the window title after route navigation', async () => {
    installBridge(bootstrapFixture());
    renderApplication();
    const investorsLink = await screen.findByRole('link', { name: 'Investors' });

    fireEvent.click(investorsLink);

    expect(await screen.findByRole('heading', { name: 'Investor universe' })).toBeVisible();
    await waitFor(() => expect(document.querySelector('#main-content')).toHaveFocus());
    expect(document.title).toBe('Investors · Outreachr');
  });

  it('shows an honest search loading state without stale or false-empty results', async () => {
    let resolveSearch: ((results: CommandResultMap['search']) => void) | undefined;
    const command = vi.fn(
      (name: string) =>
        new Promise((resolve, reject) => {
          if (name !== 'search') {
            reject(new Error(`Unexpected renderer test command: ${name}`));
            return;
          }
          resolveSearch = resolve as (results: CommandResultMap['search']) => void;
        }),
    );
    installBridge(bootstrapFixture(), command as never);
    renderApplication();
    await screen.findByRole('link', { name: 'Investors' });

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search query' }), {
      target: { value: 'Calm' },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Search Outreachr' });
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Searching local records…');
    expect(screen.queryByRole('heading', { name: 'No matching records' })).not.toBeInTheDocument();

    await waitFor(() => expect(resolveSearch).toBeDefined());
    resolveSearch?.([
      {
        id: 'firm:test',
        kind: 'investor',
        title: 'Calm Capital',
        subtitle: '90 fit · AI',
        href: '/investors/firm:test',
      },
    ]);
    expect(await within(dialog).findByRole('button', { name: /Calm Capital/u })).toBeVisible();
  });
});
