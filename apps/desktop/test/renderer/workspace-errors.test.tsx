import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspace, WorkspaceProvider } from '../../src/renderer/src/state/WorkspaceContext';
import { bootstrapFixture, installBridge } from './fixtures';

function rejectionEvent(reason: unknown): PromiseRejectionEvent {
  const event = new Event('unhandledrejection', { cancelable: true }) as PromiseRejectionEvent;
  Object.defineProperty(event, 'reason', { configurable: true, value: reason });
  return event;
}

function FailureProbe({
  onCommandEvent,
  onBridgeEvent,
}: {
  onCommandEvent: (event: PromiseRejectionEvent) => void;
  onBridgeEvent: (event: PromiseRejectionEvent) => void;
}): React.JSX.Element {
  const { command, toasts } = useWorkspace();

  const runFailingCommand = async (): Promise<void> => {
    try {
      await command('search', { query: 'failure' });
    } catch (reason) {
      const event = rejectionEvent(reason);
      onCommandEvent(event);
      window.dispatchEvent(event);
    }
  };

  return (
    <div>
      <button onClick={() => void runFailingCommand()}>Run failing command</button>
      <button
        onClick={() => {
          const event = rejectionEvent(new Error('Native file chooser unavailable'));
          onBridgeEvent(event);
          window.dispatchEvent(event);
        }}
      >
        Emit bridge rejection
      </button>
      <output aria-label="reported failures">
        {toasts.map((toast) => toast.detail).join('|')}
      </output>
    </div>
  );
}

describe('workspace renderer error boundary', () => {
  it('reports direct bridge rejections and deduplicates command failures already shown to the user', async () => {
    const commandFailure = new Error('Search index unavailable');
    installBridge(
      bootstrapFixture(),
      vi.fn(async () => {
        throw commandFailure;
      }) as never,
    );
    let commandEvent: PromiseRejectionEvent | null = null;
    let bridgeEvent: PromiseRejectionEvent | null = null;
    render(
      <WorkspaceProvider>
        <FailureProbe
          onCommandEvent={(event) => {
            commandEvent = event;
          }}
          onBridgeEvent={(event) => {
            bridgeEvent = event;
          }}
        />
      </WorkspaceProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run failing command' }));
    await waitFor(() =>
      expect(screen.getByLabelText('reported failures')).toHaveTextContent(
        'Search index unavailable',
      ),
    );
    expect(commandEvent).not.toBeNull();
    expect(commandEvent?.defaultPrevented).toBe(true);
    expect(screen.getByLabelText('reported failures').textContent).toBe('Search index unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Emit bridge rejection' }));
    await waitFor(() =>
      expect(screen.getByLabelText('reported failures')).toHaveTextContent(
        'Native file chooser unavailable',
      ),
    );
    expect(bridgeEvent).not.toBeNull();
    expect(bridgeEvent?.defaultPrevented).toBe(true);
    expect(screen.getByLabelText('reported failures').textContent).toBe(
      'Search index unavailable|Native file chooser unavailable',
    );
  });
});
