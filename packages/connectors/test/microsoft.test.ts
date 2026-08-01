import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MicrosoftConnector } from '../src/index.js';
import { approvedSafety, ledger, message, noSleep, now, sendContext } from './helpers.js';

const microsoftContext = { ...sendContext, provider: 'microsoft' as const };

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client() {
  return new MicrosoftConnector({
    fetch,
    getAccessToken: () => 'graph-access-token',
    sendLedger: ledger(),
    retryPolicy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
    sleep: noSleep,
    now,
  });
}

describe('Microsoft Graph mail and calendar connector', () => {
  it('creates and sends provider drafts', async () => {
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/messages', async ({ request }) => {
        expect(request.headers.get('authorization')).toBe('Bearer graph-access-token');
        const body = (await request.json()) as { subject: string };
        expect(body.subject).toBe('Outreachr intro');
        return HttpResponse.json({ id: 'graph-draft-1', conversationId: 'conversation-1' });
      }),
      http.post(
        'https://graph.microsoft.com/v1.0/me/messages/graph-draft-1/send',
        () =>
          new HttpResponse(null, { status: 202, headers: { 'request-id': 'request-draft-send' } }),
      ),
    );
    const connector = client();
    await expect(connector.createDraft({ message })).resolves.toMatchObject({
      id: 'graph-draft-1',
      threadId: 'conversation-1',
    });
    await expect(
      connector.sendDraft({
        draftId: 'graph-draft-1',
        message,
        context: microsoftContext,
        safety: await approvedSafety(message, 'graph-draft-send-operation', microsoftContext),
      }),
    ).resolves.toMatchObject({
      status: 'accepted',
      providerMessageId: 'graph-draft-1',
      deliveryConfirmed: false,
      httpStatus: 202,
    });
  });

  it('treats Graph 202 as accepted-but-unconfirmed and never repeats it', async () => {
    let calls = 0;
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/sendMail', async ({ request }) => {
        calls += 1;
        const body = (await request.json()) as {
          message: { internetMessageHeaders: Array<{ name: string; value: string }> };
          saveToSentItems: boolean;
        };
        expect(body.saveToSentItems).toBe(true);
        expect(body.message.internetMessageHeaders).toContainEqual({
          name: 'X-Outreachr-Operation-Key',
          value: 'graph-send-operation',
        });
        return new HttpResponse(null, {
          status: 202,
          headers: { 'request-id': 'graph-request-1' },
        });
      }),
    );
    const connector = client();
    const input = {
      message,
      context: microsoftContext,
      safety: await approvedSafety(message, 'graph-send-operation', microsoftContext),
    };
    const receipt = await connector.sendEmail(input);
    const replay = await connector.sendEmail(input);

    expect(receipt).toMatchObject({
      status: 'accepted',
      providerMessageId: undefined,
      providerRequestId: 'graph-request-1',
      deliveryConfirmed: false,
      retrySafe: false,
    });
    expect(replay).toMatchObject({ status: 'accepted', replayed: true });
    expect(calls).toBe(1);
  });

  it('retries an explicit 429 send response but not an accepted request', async () => {
    let calls = 0;
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/sendMail', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json(
            { error: { code: 'TooManyRequests', message: 'Try later' } },
            { status: 429, headers: { 'x-ms-retry-after-ms': '0' } },
          );
        }
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await expect(
      client().sendEmail({
        message,
        context: microsoftContext,
        safety: await approvedSafety(message, 'graph-rate-limit-operation', microsoftContext),
      }),
    ).resolves.toMatchObject({ status: 'accepted' });
    expect(calls).toBe(2);
  });

  it('creates, lists, pages, and queries schedules through Graph', async () => {
    const nextLink =
      'https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=2026-08-01T00%3A00%3A00Z&endDateTime=2026-08-02T00%3A00%3A00Z&%24skiptoken=opaque';
    let listCalls = 0;
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/events', async ({ request }) => {
        const body = (await request.json()) as { subject: string; transactionId: string };
        expect(body).toMatchObject({
          subject: 'Investor call',
          transactionId: 'graph-calendar-operation',
        });
        return HttpResponse.json({
          id: 'graph-event-1',
          subject: 'Investor call',
          start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
          end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
          webLink: 'https://outlook.office.com/calendar/item/1',
        });
      }),
      http.get('https://graph.microsoft.com/v1.0/me/calendarView', () => {
        listCalls += 1;
        return HttpResponse.json({
          value:
            listCalls === 1
              ? [
                  {
                    id: 'graph-event-1',
                    subject: 'Investor call',
                    start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
                    end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
                  },
                ]
              : [],
          '@odata.nextLink': listCalls === 1 ? nextLink : undefined,
        });
      }),
      http.post('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', async ({ request }) => {
        const body = (await request.json()) as { schedules: string[] };
        expect(body.schedules).toEqual(['founder@example.com', 'investor@example.com']);
        return HttpResponse.json({
          value: [
            {
              scheduleId: 'founder@example.com',
              scheduleItems: [
                {
                  status: 'busy',
                  start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
                  end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
                },
              ],
            },
            { scheduleId: 'investor@example.com', scheduleItems: [] },
          ],
        });
      }),
    );
    const connector = client();
    await expect(
      connector.createEvent({
        title: 'Investor call',
        start: { dateTime: '2026-08-01T17:00:00Z' },
        end: { dateTime: '2026-08-01T17:30:00Z' },
        operationKey: 'graph-calendar-operation',
      }),
    ).resolves.toMatchObject({ id: 'graph-event-1', provider: 'microsoft' });

    const firstPage = await connector.listEvents({
      timeMin: '2026-08-01T00:00:00Z',
      timeMax: '2026-08-02T00:00:00Z',
    });
    expect(firstPage).toMatchObject({
      events: [{ id: 'graph-event-1' }],
      nextPageToken: nextLink,
    });
    await expect(
      connector.listEvents({
        timeMin: '2026-08-01T00:00:00Z',
        timeMax: '2026-08-02T00:00:00Z',
        pageToken: nextLink,
      }),
    ).resolves.toMatchObject({ events: [] });

    await expect(
      connector.queryFreeBusy({
        calendarIds: ['founder@example.com', 'investor@example.com'],
        timeMin: '2026-08-01T00:00:00Z',
        timeMax: '2026-08-02T00:00:00Z',
      }),
    ).resolves.toMatchObject({
      calendars: [
        { calendarId: 'founder@example.com', busy: [{ status: 'busy' }] },
        { calendarId: 'investor@example.com', busy: [] },
      ],
    });
  });

  it('uses sent-folder context as authoritative outbound direction for send-as aliases', async () => {
    server.use(
      http.get(
        'https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages',
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('$filter')).toBe('sentDateTime ge 2010-01-01T00:00:00.000Z');
          expect(url.searchParams.get('$orderby')).toBe('sentDateTime desc');
          expect(url.searchParams.get('$select')).toContain('internetMessageHeaders');
          return HttpResponse.json({
            value: [
              {
                id: 'graph-alias-send',
                conversationId: 'graph-alias-thread',
                subject: 'Historical alias outreach',
                from: {
                  emailAddress: {
                    address: 'send-as-alias@example.test',
                    name: 'Founder Alias',
                  },
                },
                toRecipients: [
                  { emailAddress: { address: 'investor@example.test', name: 'Investor' } },
                ],
                sentDateTime: '2010-01-02T03:04:05.000Z',
                internetMessageHeaders: [
                  { name: 'x-outreachr-operation-key', value: 'send:historical-alias' },
                ],
              },
            ],
          });
        },
      ),
    );

    await expect(
      client().listMailboxMessages({
        mailbox: 'sent',
        since: '2010-01-01T00:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      messages: [
        {
          id: 'graph-alias-send',
          direction: 'outbound',
          from: { email: 'send-as-alias@example.test' },
          occurredAt: '2010-01-02T03:04:05.000Z',
          operationKey: 'send:historical-alias',
        },
      ],
    });
  });

  it('skips Graph relationship records that have no sender or usable timestamp', async () => {
    server.use(
      http.get('https://graph.microsoft.com/v1.0/me/messages', () =>
        HttpResponse.json({
          value: [
            {
              id: 'valid-message',
              from: { emailAddress: { address: 'founder@example.test' } },
              toRecipients: [{ emailAddress: { address: 'investor@example.test' } }],
              receivedDateTime: '2026-08-01T17:00:00.000Z',
            },
            {
              id: 'missing-sender',
              receivedDateTime: '2026-08-01T17:00:00.000Z',
            },
            {
              id: 'missing-timestamp',
              from: { emailAddress: { address: 'founder@example.test' } },
            },
          ],
        }),
      ),
    );

    const page = await client().listMailboxMessages({ mailbox: 'all' });
    expect(page.messages).toEqual([
      expect.objectContaining({
        id: 'valid-message',
        from: expect.objectContaining({ email: 'founder@example.test' }),
      }),
    ]);
    expect(JSON.stringify(page)).not.toContain('example.invalid');
    expect(JSON.stringify(page)).not.toContain('1970-01-01');
  });

  it('skips malformed Graph event records and attendee identities without fabricating data', async () => {
    server.use(
      http.get('https://graph.microsoft.com/v1.0/me/calendarView', () =>
        HttpResponse.json({
          value: [
            {
              id: 'valid-event',
              subject: 'Valid event',
              start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
              end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
              attendees: [
                { emailAddress: {}, type: 'required' },
                { emailAddress: { address: 'not-an-email' }, type: 'required' },
                {
                  emailAddress: { address: 'investor@example.test', name: 'Investor' },
                  type: 'required',
                },
              ],
            },
            {
              subject: 'Missing id',
              start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
              end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
            },
            {
              id: 'missing-start',
              subject: 'Missing start',
              end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
            },
            {
              id: 'missing-end',
              subject: 'Missing end',
              start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
            },
          ],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=next',
        }),
      ),
    );

    const page = await client().listEvents({
      timeMin: '2026-08-01T00:00:00Z',
      timeMax: '2026-08-02T00:00:00Z',
    });
    expect(page).toEqual({
      events: [
        expect.objectContaining({
          id: 'valid-event',
          attendees: [
            expect.objectContaining({ email: 'investor@example.test', name: 'Investor' }),
          ],
        }),
      ],
      nextPageToken: 'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=next',
    });
    expect(JSON.stringify(page)).not.toContain('example.invalid');
    expect(JSON.stringify(page)).not.toContain('1970-01-01');
  });

  it('reports successful Graph event creates with malformed identities as ambiguous', async () => {
    const eventInput = {
      title: 'Investor call',
      start: { dateTime: '2026-08-01T17:00:00Z' },
      end: { dateTime: '2026-08-01T17:30:00Z' },
      operationKey: 'malformed-graph-create',
    };
    const malformedResponses = [
      {
        start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
      },
      {
        id: 'missing-start',
        end: { dateTime: '2026-08-01T17:30:00Z', timeZone: 'UTC' },
      },
      {
        id: 'missing-end',
        start: { dateTime: '2026-08-01T17:00:00Z', timeZone: 'UTC' },
      },
    ];

    for (const malformedResponse of malformedResponses) {
      let calls = 0;
      server.use(
        http.post('https://graph.microsoft.com/v1.0/me/events', () => {
          calls += 1;
          return HttpResponse.json(malformedResponse, {
            headers: { 'request-id': 'ambiguous-graph-create-request' },
          });
        }),
      );
      await expect(client().createEvent(eventInput)).rejects.toMatchObject({
        code: 'AMBIGUOUS_CREATE',
        operation: 'graph.calendar.events.create',
        providerRequestId: 'ambiguous-graph-create-request',
        mayHaveSucceeded: true,
        retryable: false,
      });
      expect(calls).toBe(1);
    }
  });

  it('does not retry an ambiguous Graph event create response', async () => {
    let calls = 0;
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/events', () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'ServiceUnavailable', message: 'Response lost after commit' } },
          { status: 503 },
        );
      }),
    );
    await expect(
      client().createEvent({
        title: 'Investor call',
        start: { dateTime: '2026-08-01T17:00:00Z' },
        end: { dateTime: '2026-08-01T17:30:00Z' },
        operationKey: 'ambiguous-graph-transport',
      }),
    ).rejects.toMatchObject({
      code: 'AMBIGUOUS_CREATE',
      mayHaveSucceeded: true,
      retryable: false,
    });
    expect(calls).toBe(1);
  });

  it('maps Graph errors and rejects page-token origin changes', async () => {
    server.use(
      http.post('https://graph.microsoft.com/v1.0/me/messages', () =>
        HttpResponse.json(
          { error: { code: 'InvalidAuthenticationToken', message: 'Token expired' } },
          { status: 401, headers: { 'request-id': 'graph-auth-error' } },
        ),
      ),
    );
    await expect(client().createDraft({ message })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      providerCode: 'InvalidAuthenticationToken',
      providerRequestId: 'graph-auth-error',
    });

    await expect(
      client().listEvents({
        timeMin: '2026-08-01T00:00:00Z',
        timeMax: '2026-08-02T00:00:00Z',
        pageToken: 'https://attacker.example/steal-token',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});
