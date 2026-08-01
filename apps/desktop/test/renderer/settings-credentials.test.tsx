import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/src/App';
import { HashRouter } from '../../src/renderer/src/lib/router';
import { WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import type { ConnectorStatus } from '../../src/shared/contracts';
import { bootstrapFixture, installBridge } from './fixtures';

function renderSettings(route: '#/settings/connectors' | '#/settings/agents'): void {
  window.location.hash = route;
  render(
    <HashRouter>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </HashRouter>,
  );
}

function section(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  const element = heading.closest('section');
  if (!element) throw new Error(`Missing settings section: ${name}`);
  return element;
}

describe('credential setup guidance and renderer boundary', () => {
  it('shows complete Google and Microsoft desktop OAuth requirements with official links', async () => {
    const bridge = installBridge(bootstrapFixture());
    renderSettings('#/settings/connectors');

    expect(await screen.findByRole('heading', { name: 'Google Workspace' })).toBeVisible();
    const google = section('Google Workspace');
    expect(within(google).getByText('Create a Google Cloud project')).toBeVisible();
    expect(within(google).getByText('Enable Gmail and Google Calendar APIs')).toBeVisible();
    expect(within(google).getByText('Configure branding, audience, and data access')).toBeVisible();
    expect(within(google).getByText('Create a Desktop app OAuth client')).toBeVisible();
    expect(within(google).getByText('gmail.readonly')).toBeVisible();
    expect(within(google).getByText(/Testing grants expire after seven days/u)).toBeVisible();
    fireEvent.click(within(google).getByRole('button', { name: 'Desktop OAuth details' }));
    expect(bridge.openExternal).toHaveBeenCalledWith(
      'https://developers.google.com/identity/protocols/oauth2/native-app',
    );

    const microsoft = section('Microsoft 365');
    expect(within(microsoft).getByText('Register the exact desktop callback')).toBeVisible();
    expect(within(microsoft).getByText('http://localhost/oauth/callback')).toBeVisible();
    expect(within(microsoft).getByText(/Mail\.ReadBasic/u)).toBeVisible();
    expect(
      within(microsoft).getByText(/Accounts in any organizational directory and personal/u),
    ).toBeVisible();
    fireEvent.click(within(microsoft).getByRole('button', { name: 'Redirect URI rules' }));
    expect(bridge.openExternal).toHaveBeenCalledWith(
      'https://learn.microsoft.com/en-us/entra/identity-platform/reply-url',
    );
  });

  it('passes only public connector configuration through the renderer bridge', async () => {
    const fixture = bootstrapFixture();
    const configured: ConnectorStatus = {
      ...fixture.connectors[0]!,
      state: 'configured',
      relationshipSync: true,
      scopes: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar.events.owned',
        'https://www.googleapis.com/auth/calendar.events.freebusy',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    };
    const connected: ConnectorStatus = {
      ...configured,
      state: 'connected',
      accountEmail: 'founder@local.test',
    };
    const command = vi.fn(async (name: string, payload: Record<string, unknown>) => {
      void payload;
      if (name === 'connector.configure') return configured;
      if (name === 'connector.connect') return connected;
      throw new Error(`Unexpected command: ${name}`);
    });
    installBridge(fixture, command as never);
    renderSettings('#/settings/connectors');

    await screen.findByRole('heading', { name: 'Google Workspace' });
    const google = section('Google Workspace');
    const clientId = within(google).getByPlaceholderText('Paste the provider-issued client ID');
    expect(clientId).toHaveAttribute('autocomplete', 'off');
    expect(
      within(google).queryByPlaceholderText(/client secret|password/u),
    ).not.toBeInTheDocument();
    expect(google.querySelector('input[type="password"]')).toBeNull();
    fireEvent.change(clientId, {
      target: { value: '123456789.apps.googleusercontent.com' },
    });
    fireEvent.click(within(google).getByRole('checkbox', { name: /Enable relationship sync/u }));
    fireEvent.click(within(google).getByRole('button', { name: 'Save and connect in browser' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('connector.configure', {
        provider: 'google',
        clientId: '123456789.apps.googleusercontent.com',
        relationshipSync: true,
      }),
    );
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('connector.connect', { provider: 'google' }),
    );
    for (const [, payload] of command.mock.calls) {
      expect(payload).not.toHaveProperty('clientSecret');
      expect(payload).not.toHaveProperty('accessToken');
      expect(payload).not.toHaveProperty('refreshToken');
      expect(payload).not.toHaveProperty('authorizationCode');
    }
  });

  it('keeps setup failures actionable and blocks connection without protected storage', async () => {
    const fixture = bootstrapFixture();
    fixture.connectors[0] = {
      ...fixture.connectors[0]!,
      state: 'configured',
      error: 'OAuth sign-in timed out after five minutes',
      encryptionAvailable: false,
    };
    installBridge(fixture);
    renderSettings('#/settings/connectors');

    await screen.findByRole('heading', { name: 'Google Workspace' });
    const google = section('Google Workspace');
    expect(within(google).getByText('OAuth sign-in timed out after five minutes')).toBeVisible();
    expect(within(google).getByText('Credential storage unavailable')).toBeVisible();
    expect(
      within(google).getByText(/Unlock or install an operating-system secret service/u),
    ).toBeVisible();
    fireEvent.change(within(google).getByPlaceholderText('Paste the provider-issued client ID'), {
      target: { value: 'cannot-connect.apps.googleusercontent.com' },
    });
    expect(
      within(google).getByRole('button', { name: 'Save and connect in browser' }),
    ).toBeDisabled();
  });

  it('saves and removes a Claude key through the write-only encrypted credential commands', async () => {
    const fixture = bootstrapFixture();
    const ready = {
      ...fixture.agents[1]!,
      state: 'ready' as const,
      version: '2.1.0',
      accountLabel: 'Anthropic API key',
    };
    const signedOut = { ...fixture.agents[1]!, state: 'signed_out' as const };
    const command = vi.fn(async (name: string) => {
      if (name === 'agent.credential.set') return ready;
      if (name === 'agent.credential.remove') return signedOut;
      throw new Error(`Unexpected command: ${name}`);
    });
    const bridge = installBridge(fixture, command as never);
    renderSettings('#/settings/agents');

    expect(await screen.findByRole('heading', { name: 'Local agents' })).toBeVisible();
    const agents = section('Local agents');
    expect(
      within(agents).getByText(/does not accept Claude subscription or setup-token/u),
    ).toBeVisible();
    fireEvent.click(within(agents).getByRole('button', { name: 'Codex authentication' }));
    expect(bridge.openExternal).toHaveBeenCalledWith('https://learn.chatgpt.com/docs/auth');
    fireEvent.click(within(agents).getByRole('button', { name: 'Anthropic legal guidance' }));
    expect(bridge.openExternal).toHaveBeenCalledWith(
      'https://code.claude.com/docs/en/legal-and-compliance',
    );

    const key = 'sk-ant-founder-owned-test-key-00000001';
    const keyInput = within(agents).getByPlaceholderText('Paste a founder-owned API key');
    expect(keyInput).toHaveAttribute('type', 'password');
    expect(keyInput).toHaveAttribute('autocomplete', 'new-password');
    expect(keyInput).toHaveAttribute('spellcheck', 'false');
    fireEvent.change(keyInput, { target: { value: key } });
    fireEvent.click(within(agents).getByRole('button', { name: 'Save encrypted API key' }));

    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.credential.set', {
        provider: 'claude',
        credential: key,
      }),
    );
    await waitFor(() => expect(keyInput).toHaveValue(''));
    expect(document.body).not.toHaveTextContent(key);
    expect(command.mock.calls.filter(([name]) => name === 'agent.credential.set')).toHaveLength(1);

    fireEvent.click(within(agents).getByRole('button', { name: 'Remove stored API key' }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith('agent.credential.remove', { provider: 'claude' }),
    );
  });

  it('blocks Claude key entry when protected credential storage is unavailable', async () => {
    const fixture = bootstrapFixture();
    fixture.connectors = fixture.connectors.map((connector) => ({
      ...connector,
      encryptionAvailable: false,
    }));
    fixture.agents[1] = {
      ...fixture.agents[1]!,
      error: 'Claude subscription credentials were detected but are not used.',
    };
    installBridge(fixture);
    renderSettings('#/settings/agents');

    expect(await screen.findByRole('heading', { name: 'Local agents' })).toBeVisible();
    const agents = section('Local agents');
    expect(within(agents).getByText('Credential storage unavailable')).toBeVisible();
    expect(within(agents).getByText(/app refuses plaintext API-key storage/u)).toBeVisible();
    expect(within(agents).getByPlaceholderText('Paste a founder-owned API key')).toBeDisabled();
    expect(within(agents).getByRole('button', { name: 'Save encrypted API key' })).toBeDisabled();
    expect(
      within(agents).getByText('Claude subscription credentials were detected but are not used.'),
    ).toBeVisible();
  });
});
