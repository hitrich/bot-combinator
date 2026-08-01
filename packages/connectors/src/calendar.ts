import type {
  CalendarDateTime,
  CalendarEventInput,
  FreeBusyInput,
  ListCalendarEventsInput,
} from './types.js';

function assertIsoTimestamp(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value)))
    throw new TypeError(`${field} must be an ISO 8601 timestamp`);
}

export function validateCalendarDateTime(value: CalendarDateTime, field: string): void {
  if (Boolean(value.dateTime) === Boolean(value.date)) {
    throw new TypeError(`${field} requires exactly one of dateTime or date`);
  }
  if (value.dateTime) assertIsoTimestamp(value.dateTime, `${field}.dateTime`);
  if (value.date && !/^\d{4}-\d{2}-\d{2}$/u.test(value.date)) {
    throw new TypeError(`${field}.date must use YYYY-MM-DD`);
  }
}

export function validateEventInput(input: CalendarEventInput): void {
  if (!input.title.trim()) throw new TypeError('Calendar event title is required');
  validateCalendarDateTime(input.start, 'start');
  validateCalendarDateTime(input.end, 'end');
  const start = Date.parse(input.start.dateTime ?? `${input.start.date}T00:00:00Z`);
  const end = Date.parse(input.end.dateTime ?? `${input.end.date}T00:00:00Z`);
  if (end <= start) throw new TypeError('Calendar event end must be after start');
}

export function validateListInput(input: ListCalendarEventsInput): void {
  assertIsoTimestamp(input.timeMin, 'timeMin');
  assertIsoTimestamp(input.timeMax, 'timeMax');
  if (Date.parse(input.timeMax) <= Date.parse(input.timeMin)) {
    throw new TypeError('timeMax must be after timeMin');
  }
  if (input.pageSize !== undefined && (!Number.isInteger(input.pageSize) || input.pageSize < 1)) {
    throw new TypeError('pageSize must be a positive integer');
  }
}

export function validateFreeBusyInput(input: FreeBusyInput): void {
  if (input.calendarIds.length === 0) throw new TypeError('At least one calendar id is required');
  assertIsoTimestamp(input.timeMin, 'timeMin');
  assertIsoTimestamp(input.timeMax, 'timeMax');
  if (Date.parse(input.timeMax) <= Date.parse(input.timeMin)) {
    throw new TypeError('timeMax must be after timeMin');
  }
}
