import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function renderRoute(route: string): void {
  window.location.hash = route;
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

describe('complete investor collections', () => {
  it('renders every portfolio result instead of silently truncating after sixty', async () => {
    const fixture = bootstrapFixture();
    const investor = fixture.investors[0]!;
    fixture.investors = Array.from({ length: 61 }, (_, index) => ({
      ...investor,
      id: `firm:portfolio:${index + 1}`,
      name: `Portfolio firm ${String(index + 1).padStart(2, '0')}`,
      portfolioCount: 1,
    }));
    fixture.counts.firms = fixture.investors.length;
    installBridge(fixture);
    renderRoute('#/investors');

    fireEvent.click(await screen.findByRole('tab', { name: /Portfolio evidence/u }));
    expect(screen.getByText('61 results')).toBeVisible();
    expect(screen.getByRole('button', { name: /Portfolio firm 61/u })).toBeVisible();
  });

  it('renders every uncontacted target on introduction research', async () => {
    const fixture = bootstrapFixture();
    const person = fixture.people[0]!;
    fixture.people = Array.from({ length: 51 }, (_, index) => ({
      ...person,
      id: `person:intro:${index + 1}`,
      name: `Introduction candidate ${String(index + 1).padStart(2, '0')}`,
      target: true,
      contacted: false,
    }));
    fixture.counts.people = fixture.people.length;
    installBridge(fixture);
    renderRoute('#/introductions');

    expect(await screen.findByText('51 candidates')).toBeVisible();
    expect(screen.getByText('Introduction candidate 51')).toBeVisible();
  });
});
