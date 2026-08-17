import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import {
  filterInvestorsByMemberIds,
  recommendedMemberFirmIds,
} from '../../src/renderer/src/lib/investor-lists';
import { bootstrapFixture, installBridge } from './fixtures';

function renderApplication(): void {
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

describe('desktop renderer smoke and accessibility contracts', () => {
  it('renders an accessible first-run flow and prevents incomplete progression', async () => {
    installBridge(bootstrapFixture(true));
    renderApplication();

    expect(
      await screen.findByRole('heading', { name: 'Who is running this round?' }),
    ).toBeVisible();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('1 of 5')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    const founderName = screen.getByLabelText('Your name');
    const founderEmail = screen.getByLabelText(/^Work email/u);
    expect(founderName).toHaveAccessibleName('Your name');
    expect(founderEmail).toHaveAccessibleName(/^Work email/u);
    fireEvent.change(founderName, { target: { value: 'Ada Founder' } });
    fireEvent.change(founderEmail, {
      target: { value: 'ada@local.test' },
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'What are you building?' })).toBeVisible();
    expect(screen.getByLabelText('Company name')).toHaveFocus();
    expect(screen.getByLabelText('One-line description')).toHaveAccessibleName(
      'One-line description',
    );
    expect(screen.getByLabelText('Fundraising narrative')).toBeInTheDocument();
  });

  it('renders the authenticated shell, investor table, skip link, and named navigation', async () => {
    window.location.hash = '#/investors';
    installBridge(bootstrapFixture());
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Investor universe' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Skip to content' }));
    expect(document.querySelector('#main-content')).toHaveFocus();
    expect(window.location.hash).toBe('#/investors');
    expect(screen.getByRole('table')).toHaveAccessibleName('');
    expect(screen.getByRole('columnheader', { name: 'Investor' })).toBeVisible();
    expect(screen.getByRole('button', { name: /^Calm Capital/u })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add Calm Capital to round' })).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search firms' })).toBeVisible();
  });

  it('filters the investor universe to the exact static list selected in the URL', async () => {
    window.location.hash = '#/investors?list=list%3Afocus';
    const fixture = bootstrapFixture();
    const excluded = {
      ...fixture.investors[0]!,
      id: 'firm:excluded',
      name: 'Excluded Ventures',
      fitScore: 80,
    };
    fixture.investors.push(excluded);
    fixture.lists = [
      {
        id: 'list:focus',
        name: 'Focus list',
        description: 'Exact membership',
        count: 1,
        memberFirmIds: ['firm:test'],
      },
    ];
    installBridge(fixture);
    renderApplication();

    expect(await screen.findByText('Focus list · 1')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Calm Capital/u })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Excluded Ventures/u })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear list' })).toBeVisible();
  });

  it('builds bounded recommended snapshots and filters membership without mutating source data', () => {
    const fixture = bootstrapFixture();
    const nyc = {
      ...fixture.investors[0]!,
      id: 'firm:nyc',
      name: 'NYC Seed Fund',
      headquarters: 'New York, NY',
      geographies: ['New York City'],
      stages: ['Seed'],
      fitScore: 75,
    };
    const investors = [fixture.investors[0]!, nyc];

    expect(recommendedMemberFirmIds('high_fit', investors)).toEqual(['firm:test', 'firm:nyc']);
    expect(recommendedMemberFirmIds('nyc_seed', investors)).toEqual(['firm:nyc']);
    expect(filterInvestorsByMemberIds(investors, ['firm:nyc']).map((item) => item.id)).toEqual([
      'firm:nyc',
    ]);
    expect(investors).toHaveLength(2);
  });

  it('opens keyboard search and sends a debounced, bounded command through the bridge', async () => {
    const bridge = installBridge(bootstrapFixture());
    renderApplication();
    await screen.findByRole('link', { name: 'Investors' });

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Search Bot Combinator');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search query' }), {
      target: { value: 'Calm' },
    });

    expect(await within(dialog).findByRole('button', { name: /Calm Capital/u })).toBeVisible();
    await waitFor(() => expect(bridge.command).toHaveBeenCalledWith('search', { query: 'Calm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a blocked draft editable and enables approval only when the exact footer is visible', async () => {
    window.location.hash = '#/outreach';
    const fixture = bootstrapFixture();
    fixture.drafts = [
      {
        id: 'message:blocked-footer',
        provider: 'google',
        accountEmail: 'ada@local.test',
        personId: 'person:test',
        recipientName: 'Pat Partner',
        recipientEmail: 'pat@calm.example',
        subject: 'A possible fit',
        bodyText: 'Hi Pat,\n\nA founder-reviewed note.',
        threadId: null,
        kind: 'initial',
        contentHash: 'a'.repeat(64),
        approvalState: 'draft',
        blockReason: 'The message body must include the exact configured sender postal address.',
        canApprove: false,
        canSend: false,
        approvalBlockReasons: [
          'The message body must include the exact configured sender postal address.',
          'The message body must include the exact configured opt-out wording.',
        ],
        sendBlockReasons: [
          'The message body must include the exact configured sender postal address.',
        ],
        approvedAt: null,
        sentAt: null,
        providerMessageId: null,
      },
    ];
    installBridge(fixture);
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Outreach' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Pat Partner/u }));
    expect(screen.getByRole('button', { name: 'Approve exact message' })).toBeDisabled();
    expect(
      screen.getAllByText(
        'The message body must include the exact configured sender postal address.',
      )[0],
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Body'), {
      target: {
        value:
          'Hi Pat,\n\nA founder-reviewed note.\n\n—\n123 Founder Way\nSan Francisco, CA 94107\nUnited States\nIf you prefer no further email from me, reply "opt out" and I will not contact you again.',
      },
    });
    expect(screen.getByRole('button', { name: 'Approve exact message' })).toBeEnabled();
  });

  it('shows the exact durable agent payload and routes founder approval through review', async () => {
    window.location.hash = '#/agent';
    const fixture = bootstrapFixture();
    fixture.agentProposals = [
      {
        id: 'proposal:renderer',
        agentRunId: 'agent-run:renderer',
        provider: 'codex',
        kind: 'task',
        title: 'Verify partner fit',
        rationale: 'The source evidence needs a founder decision.',
        investorId: 'firm:test',
        payload: {
          title: 'Verify partner fit',
          notes: 'Inspect the cited portfolio evidence.',
          investorId: 'firm:test',
        },
        status: 'pending',
        createdAt: '2026-07-31T19:00:00.000Z',
      },
    ];
    const command = vi.fn(async () => ({
      id: 'proposal:renderer',
      status: 'accepted',
      operation: 'applied',
      appliedEntityType: 'task',
      appliedEntityId: 'task:renderer',
    }));
    installBridge(fixture, command as never);
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Agent' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Verify partner fit' })).toBeVisible();
    expect(screen.getByLabelText('Exact agent proposal payload')).toHaveTextContent(
      'Inspect the cited portfolio evidence.',
    );
    expect(screen.getByText('Calm Capital')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Apply local change' }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.proposal.review', {
        id: 'proposal:renderer',
        decision: 'apply',
      }),
    );
  });

  it('creates a provider meeting with an explicit investor and validated canonical attendees', async () => {
    window.location.hash = '#/meetings';
    const fixture = bootstrapFixture();
    fixture.people[0] = {
      ...fixture.people[0]!,
      email: 'pat@calm.example',
      emailConfidence: 'supported',
      canSendInitial: true,
    };
    fixture.connectors[0] = {
      ...fixture.connectors[0]!,
      state: 'connected',
      accountEmail: 'founder@local.test',
    };
    const command = vi.fn(async (name: string, payload: Record<string, unknown>) => {
      if (name === 'meeting.create') return { id: 'meeting:renderer', ...payload };
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Meetings' })).toBeVisible();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add meeting' })[0]!);
    const dialog = screen.getByRole('dialog', { name: 'Add a meeting' });
    fireEvent.change(within(dialog).getByLabelText('Investor'), {
      target: { value: 'firm:test' },
    });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Pat Partner/u }));
    fireEvent.change(within(dialog).getByLabelText('Calendar'), {
      target: { value: 'google' },
    });
    fireEvent.change(within(dialog).getByLabelText('Starts'), {
      target: { value: '2026-08-03T10:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('Ends'), {
      target: { value: '2026-08-03T09:30' },
    });
    expect(within(dialog).getByText('End time must be after the start time.')).toBeVisible();
    expect(
      within(dialog).getByText('Creating this meeting sends 1 provider invitation.'),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Create and send invitation' }),
    ).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Ends'), {
      target: { value: '2026-08-03T10:30' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create and send invitation' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('meeting.create', {
        title: 'Investor meeting',
        startsAt: new Date('2026-08-03T10:00').toISOString(),
        endsAt: new Date('2026-08-03T10:30').toISOString(),
        provider: 'google',
        investorId: 'firm:test',
        personIds: ['person:test'],
        location: null,
        agenda: null,
        notes: null,
        status: 'upcoming',
      }),
    );
  });

  it('edits private individual email and attributable profiles with domain validation', async () => {
    window.location.hash = '#/investors/firm:test';
    const fixture = bootstrapFixture();
    const detail = {
      ...fixture.investors[0]!,
      website: 'https://calm.example',
      description: 'A fixture investor.',
      thesis: 'Seed AI.',
      applicationUrl: null,
      contactEmail: null,
      leadBehavior: null,
      currentFund: null,
      people: fixture.people,
      portfolio: [],
      sources: [],
      activity: [],
    };
    let updatedPerson = fixture.people[0]!;
    const command = vi.fn(async (name: string, payload: Record<string, unknown>) => {
      if (name === 'investor.get') return detail;
      if (name === 'person.contact.add') {
        updatedPerson = {
          ...updatedPerson,
          ...(payload.kind === 'personal_email'
            ? {
                personalEmail: String(payload.value),
                email: updatedPerson.workEmail ?? String(payload.value),
              }
            : {}),
          ...(payload.kind === 'linkedin' ? { linkedinUrl: String(payload.value) } : {}),
          ...(payload.kind === 'x' ? { xUrl: String(payload.value) } : {}),
        };
        return updatedPerson;
      }
      throw new Error(`Unexpected renderer test command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderApplication();

    expect(await screen.findByRole('heading', { name: 'Calm Capital' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit contacts' }));
    const dialog = screen.getByRole('dialog', { name: /Edit contact details/u });
    fireEvent.change(within(dialog).getByLabelText('LinkedIn profile'), {
      target: { value: 'https://lookalike.example/in/pat' },
    });
    expect(within(dialog).getByText('Use a secure linkedin.com profile URL.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save contact details' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('LinkedIn profile'), {
      target: { value: 'https://www.linkedin.com/in/pat-partner-updated' },
    });
    fireEvent.change(within(dialog).getByLabelText('X profile'), {
      target: { value: 'https://x.com/patpartner' },
    });
    fireEvent.change(within(dialog).getByLabelText('Individual email'), {
      target: { value: 'pat.personal@example.test' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save contact details' }));

    await waitFor(() => {
      expect(command).toHaveBeenCalledWith('person.contact.add', {
        personId: 'person:test',
        kind: 'personal_email',
        value: 'pat.personal@example.test',
        visibility: 'private',
        contributionEligible: false,
      });
      expect(command).toHaveBeenCalledWith('person.contact.add', {
        personId: 'person:test',
        kind: 'linkedin',
        value: 'https://www.linkedin.com/in/pat-partner-updated',
        visibility: 'public',
        sourceUrl: 'https://www.linkedin.com/in/pat-partner-updated',
        contributionEligible: false,
      });
      expect(command).toHaveBeenCalledWith('person.contact.add', {
        personId: 'person:test',
        kind: 'x',
        value: 'https://x.com/patpartner',
        visibility: 'public',
        sourceUrl: 'https://x.com/patpartner',
        contributionEligible: false,
      });
    });
  });
});
