import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function renderApplication(route: string): void {
  window.location.hash = route;
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

describe('BOT Chain connected product surfaces', () => {
  it('hands only selected versioned documentation to a ready local agent', async () => {
    const fixture = bootstrapFixture();
    fixture.agents[0] = { ...fixture.agents[0]!, state: 'ready', version: 'test-codex' };
    const command = vi.fn(async (name: string) => {
      if (name === 'agent.run') return { runId: 'agent-run:bot-chain' };
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderApplication('#/bot-chain/docs');

    expect(await screen.findByRole('heading', { name: 'BOT Chain Docs' })).toBeVisible();
    expect(screen.getByText('Hash checked at app launch')).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Select BotAgents.md for agent context' }),
    ).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Use with agent' }));
    expect(await screen.findByRole('heading', { name: 'Agent' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /BOT Chain documentation/u })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /BotAgents.md/u })).toBeChecked();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'What should the agent do?',
        }) as HTMLTextAreaElement
      ).value,
    ).toContain('Do not invent network');

    fireEvent.click(screen.getByRole('button', { name: 'Run with Codex' }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.run', {
        provider: 'codex',
        prompt: expect.stringContaining('selected BOT Chain documentation'),
        disclosedContextIds: ['round', 'company', 'investors', 'bot_chain_docs'],
        botChainDocumentIds: ['bot-agents'],
      }),
    );
  });

  it('records an explicit Klineo gate decision from the project dossier', async () => {
    const fixture = bootstrapFixture();
    fixture.ecosystemProgram.gateDefinitions = [
      {
        key: 'bot_chain_integration',
        version: 1,
        title: 'BOT Chain integration',
        description: 'Versioned integration evidence.',
        sortOrder: 60,
      },
    ];
    fixture.ecosystemProgram.projects = [
      {
        id: 'ecosystem-project:test',
        programId: fixture.ecosystemProgram.id,
        name: 'Project Northstar',
        website: null,
        description: 'Applicant project under review.',
        stage: 'screening',
        source: 'application',
        ownerName: 'Applicant Owner',
        ownerEmail: 'owner@example.test',
        targetLaunchAt: null,
        launchedAt: null,
        cohortId: null,
        cohortName: null,
        gates: [],
        milestones: [],
        createdAt: '2026-07-31T19:00:00.000Z',
        updatedAt: '2026-07-31T19:00:00.000Z',
      },
    ];
    fixture.ecosystemProgram.summary.totalProjects = 1;
    const command = vi.fn(async (name: string) => {
      if (name === 'program.gate.review') return fixture.ecosystemProgram;
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderApplication('#/bot-chain/projects');

    expect(await screen.findByRole('heading', { name: 'BOT Chain projects' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /BOT Chain integration/u }));
    const dialog = screen.getByRole('dialog', { name: 'BOT Chain integration' });
    fireEvent.change(within(dialog).getByLabelText('Decision'), {
      target: { value: 'passed' },
    });
    fireEvent.change(within(dialog).getByLabelText('Reviewed by'), {
      target: { value: 'Klineo reviewer' },
    });
    fireEvent.change(within(dialog).getByLabelText('Rationale'), {
      target: { value: 'Current test evidence was reviewed.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Evidence references'), {
      target: { value: 'artifact:test-run-42' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record review' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('program.gate.review', {
        projectId: 'ecosystem-project:test',
        gateKey: 'bot_chain_integration',
        status: 'passed',
        rationale: 'Current test evidence was reviewed.',
        evidence: 'artifact:test-run-42',
        reviewedBy: 'Klineo reviewer',
      }),
    );
  });

  it('previews and exports only an explicit hosted portal submission', async () => {
    const fixture = bootstrapFixture();
    fixture.ecosystemProgram.projects = [
      {
        id: 'ecosystem-project:portal',
        programId: fixture.ecosystemProgram.id,
        name: 'Project Portal',
        website: 'https://project.example',
        description: 'Project-authored product summary.',
        stage: 'cohort',
        source: 'application',
        ownerName: 'Private Owner',
        ownerEmail: 'private@example.com',
        targetLaunchAt: null,
        launchedAt: null,
        cohortId: null,
        cohortName: null,
        gates: [],
        milestones: [],
        createdAt: '2026-07-31T19:00:00.000Z',
        updatedAt: '2026-07-31T19:00:00.000Z',
      },
    ];
    fixture.ecosystemProgram.summary.totalProjects = 1;
    const command = vi.fn(async (name: string) => {
      if (name === 'program.portalSubmission.export') {
        return {
          path: '/tmp/portal-submission.json',
          contentDigest: `sha256:${'a'.repeat(64)}`,
        };
      }
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    const bridge = installBridge(fixture, command as never);
    vi.mocked(bridge.selectDirectory).mockResolvedValue('/tmp');
    renderApplication('#/bot-chain/projects');

    fireEvent.click(await screen.findByRole('button', { name: 'Portal submission' }));
    const dialog = screen.getByRole('dialog', { name: 'Prepare hosted portal submission' });
    expect(within(dialog).getByText('Always excluded')).toBeVisible();
    expect(within(dialog).getByText(/Owner names and emails/u)).toBeVisible();
    expect(
      within(dialog).getByRole('checkbox', { name: /Milestones and evidence/u }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: /Gate reviews and evidence/u }),
    ).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Choose folder and export' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('program.portalSubmission.export', {
        directory: '/tmp',
        projectId: 'ecosystem-project:portal',
        visibility: 'project_and_klineo',
        includeMilestones: true,
        includeGateReviews: true,
      }),
    );
    expect(bridge.revealPath).toHaveBeenCalledWith('/tmp/portal-submission.json');
  });

  it('shows the controlled partner boundary and exports through the redacted report command', async () => {
    const fixture = bootstrapFixture();
    const command = vi.fn(async (name: string) => {
      if (name === 'program.partnerReport.export') return { path: '/tmp/partner-report.md' };
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    const bridge = installBridge(fixture, command as never);
    vi.mocked(bridge.selectDirectory).mockResolvedValue('/tmp');
    renderApplication('#/bot-chain/partner');

    expect(await screen.findByRole('heading', { name: 'BOT Chain partner view' })).toBeVisible();
    expect(
      screen.getByText('Export boundary is enforced in the application service.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Export report' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('program.partnerReport.export', { directory: '/tmp' }),
    );
    expect(bridge.revealPath).toHaveBeenCalledWith('/tmp/partner-report.md');
  });
});
