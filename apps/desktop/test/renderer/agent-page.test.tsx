import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function renderAgentPage(): void {
  window.location.hash = '#/agent';
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

describe('Agent page disclosure defaults', () => {
  it('shares round, company, and investor evidence by default without private activity', async () => {
    const fixture = bootstrapFixture();
    fixture.agents[0] = {
      ...fixture.agents[0]!,
      state: 'ready',
      version: 'codex-renderer-test',
    };
    fixture.agentContextGrants = [];
    const command = vi.fn(async (name: string) => {
      if (name === 'agent.run') return { runId: 'agent-run:renderer-defaults' };
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderAgentPage();

    expect(await screen.findByRole('heading', { name: 'Agent' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Round strategy/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Company knowledge/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Investor graph/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Private activity/u })).not.toBeChecked();

    const prompt = screen.getByRole('textbox', { name: 'What should the agent do?' });
    expect(prompt).toHaveValue(
      'Find five high-fit investors I have not contacted and explain each recommendation with the available local evidence.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Run with Codex' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.run', {
        provider: 'codex',
        prompt:
          'Find five high-fit investors I have not contacted and explain each recommendation with the available local evidence.',
        disclosedContextIds: ['round', 'company', 'investors'],
      }),
    );
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('keeps durable-grant controls separate from run disclosure and supports radio arrow keys', async () => {
    const fixture = bootstrapFixture();
    fixture.agents = fixture.agents.map((agent) => ({ ...agent, state: 'ready' }));
    const command = vi.fn(async (name: string) => {
      if (name === 'agent.contextGrant.set') return [];
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderAgentPage();

    const codex = await screen.findByRole('radio', { name: /Codex/u });
    codex.focus();
    fireEvent.keyDown(codex, { key: 'ArrowRight' });

    const claude = screen.getByRole('radio', { name: /Claude/u });
    await waitFor(() => expect(claude).toHaveFocus());
    expect(claude).toHaveAttribute('aria-checked', 'true');

    const privateActivity = screen.getByRole('checkbox', { name: /Private activity/u });
    const privateOption = privateActivity.closest('.agent-disclosure__option');
    expect(privateOption).not.toBeNull();
    fireEvent.click(
      within(privateOption as HTMLElement).getByRole('button', { name: 'Remember as default' }),
    );

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.contextGrant.set', {
        provider: 'claude',
        contextClass: 'activity',
        granted: true,
      }),
    );
    expect(privateActivity).not.toBeChecked();
  });
});
