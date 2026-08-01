import type {
  AccessGrant,
  ActivityRecord,
  InvestorRecord,
  KnowledgeRecord,
  MeetingRecord,
  PersonRecord,
  PipelineItem,
  RoundRecord,
  TaskRecord,
} from './schemas.js';
import type { Page } from './types.js';

export interface Redacted<T> {
  value: T;
  redactedRecordCount: number;
}

function canReadRecord(
  grant: AccessGrant,
  ...recordIds: Array<string | null | undefined>
): boolean {
  const allowed = new Set(grant.recordIds);
  return recordIds.some((id) => id !== null && id !== undefined && allowed.has(id));
}

function hasField(grant: AccessGrant, field: AccessGrant['fields'][number]): boolean {
  return grant.fields.includes(field);
}

function copyPage<T>(page: Page<T>, items: T[]): Page<T> {
  return {
    items,
    nextCursor: page.nextCursor,
    ...(page.total === undefined ? {} : { total: page.total }),
  };
}

export function redactInvestor(record: InvestorRecord, grant: AccessGrant): InvestorRecord {
  const workflowAllowed = canReadRecord(grant, record.id) && hasField(grant, 'workflow');
  const notesAllowed = canReadRecord(grant, record.id) && hasField(grant, 'notes');
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    additionalKinds: record.additionalKinds,
    headquarters: record.headquarters,
    geographies: record.geographies,
    stages: record.stages,
    sectors: record.sectors,
    check: record.check,
    confidence: record.confidence,
    sourceIds: record.sourceIds,
    ...(record.website === undefined ? {} : { website: record.website }),
    ...(record.description === undefined ? {} : { description: record.description }),
    ...(record.thesis === undefined ? {} : { thesis: record.thesis }),
    ...(record.linkedinUrl === undefined ? {} : { linkedinUrl: record.linkedinUrl }),
    ...(record.xUrl === undefined ? {} : { xUrl: record.xUrl }),
    ...(workflowAllowed && record.fitScore !== undefined ? { fitScore: record.fitScore } : {}),
    ...(workflowAllowed && record.fitReasons !== undefined
      ? { fitReasons: record.fitReasons }
      : {}),
    ...(workflowAllowed && record.target !== undefined ? { target: record.target } : {}),
    ...(workflowAllowed && record.pipelineStage !== undefined
      ? { pipelineStage: record.pipelineStage }
      : {}),
    ...(workflowAllowed && record.nextAction !== undefined
      ? { nextAction: record.nextAction }
      : {}),
    ...(notesAllowed && record.privateNotes !== undefined
      ? { privateNotes: record.privateNotes }
      : {}),
  };
}

export function redactPerson(record: PersonRecord, grant: AccessGrant): PersonRecord {
  const recordAllowed = canReadRecord(grant, record.id, record.firmId);
  const workflowAllowed = recordAllowed && hasField(grant, 'workflow');
  return {
    id: record.id,
    name: record.name,
    firmId: record.firmId,
    firmName: record.firmName,
    title: record.title,
    investorKinds: record.investorKinds,
    sectors: record.sectors,
    sourceIds: record.sourceIds,
    ...(record.biography === undefined ? {} : { biography: record.biography }),
    ...(record.linkedinUrl === undefined ? {} : { linkedinUrl: record.linkedinUrl }),
    ...(record.xUrl === undefined ? {} : { xUrl: record.xUrl }),
    ...(recordAllowed && hasField(grant, 'contact') && record.workEmail !== undefined
      ? { workEmail: record.workEmail }
      : {}),
    ...(recordAllowed && hasField(grant, 'contact') && record.contactConfidence !== undefined
      ? { contactConfidence: record.contactConfidence }
      : {}),
    ...(workflowAllowed && record.target !== undefined ? { target: record.target } : {}),
    ...(workflowAllowed && record.contacted !== undefined ? { contacted: record.contacted } : {}),
    ...(workflowAllowed && record.replied !== undefined ? { replied: record.replied } : {}),
    ...(recordAllowed && hasField(grant, 'notes') && record.privateNotes !== undefined
      ? { privateNotes: record.privateNotes }
      : {}),
  };
}

export function redactInvestorPage(
  page: Page<InvestorRecord>,
  grant: AccessGrant,
): Redacted<Page<InvestorRecord>> {
  let redacted = 0;
  const items = page.items.map((item) => {
    const result = redactInvestor(item, grant);
    if (
      result.fitScore !== item.fitScore ||
      result.fitReasons !== item.fitReasons ||
      result.target !== item.target ||
      result.pipelineStage !== item.pipelineStage ||
      result.privateNotes !== item.privateNotes
    ) {
      redacted += 1;
    }
    return result;
  });
  return { value: copyPage(page, items), redactedRecordCount: redacted };
}

export function redactPersonPage(
  page: Page<PersonRecord>,
  grant: AccessGrant,
): Redacted<Page<PersonRecord>> {
  let redacted = 0;
  const items = page.items.map((item) => {
    const result = redactPerson(item, grant);
    if (
      result.workEmail !== item.workEmail ||
      result.target !== item.target ||
      result.privateNotes !== item.privateNotes
    ) {
      redacted += 1;
    }
    return result;
  });
  return { value: copyPage(page, items), redactedRecordCount: redacted };
}

export function redactPipeline(
  page: Page<PipelineItem>,
  grant: AccessGrant,
): Redacted<Page<PipelineItem>> {
  let redacted = 0;
  const included: PipelineItem[] = [];
  for (const item of page.items) {
    if (!canReadRecord(grant, item.id, item.investorId)) {
      redacted += 1;
      continue;
    }
    const { privateNotes, ...visible } = item;
    if (privateNotes !== undefined && !hasField(grant, 'notes')) redacted += 1;
    included.push({
      ...visible,
      ...(hasField(grant, 'notes') && privateNotes !== undefined ? { privateNotes } : {}),
    });
  }
  return {
    value: copyPage(page, included),
    redactedRecordCount: redacted,
  };
}

export function redactRound(
  record: RoundRecord | null,
  grant: AccessGrant,
): Redacted<RoundRecord | null> {
  if (record === null) return { value: null, redactedRecordCount: 0 };
  if (!canReadRecord(grant, record.id)) return { value: null, redactedRecordCount: 1 };
  const {
    targetAmount,
    committedAmount,
    softCircleAmount,
    targetCheck,
    narrative,
    ...publicFields
  } = record;
  const withheldFinancials =
    !hasField(grant, 'round_financials') &&
    [targetAmount, committedAmount, softCircleAmount, targetCheck].some(
      (value) => value !== undefined,
    );
  const withheldNarrative = !hasField(grant, 'notes') && narrative !== undefined;
  return {
    value: {
      ...publicFields,
      ...(hasField(grant, 'round_financials') && targetAmount !== undefined
        ? { targetAmount }
        : {}),
      ...(hasField(grant, 'round_financials') && committedAmount !== undefined
        ? { committedAmount }
        : {}),
      ...(hasField(grant, 'round_financials') && softCircleAmount !== undefined
        ? { softCircleAmount }
        : {}),
      ...(hasField(grant, 'round_financials') && targetCheck !== undefined ? { targetCheck } : {}),
      ...(hasField(grant, 'notes') && narrative !== undefined ? { narrative } : {}),
    },
    redactedRecordCount: withheldFinancials || withheldNarrative ? 1 : 0,
  };
}

export function redactTasks(
  page: Page<TaskRecord>,
  grant: AccessGrant,
): Redacted<Page<TaskRecord>> {
  let redacted = 0;
  const included: TaskRecord[] = [];
  for (const item of page.items) {
    if (!canReadRecord(grant, item.id, item.investorId, item.personId)) {
      redacted += 1;
      continue;
    }
    const { notes, ...visible } = item;
    if (notes !== undefined && !hasField(grant, 'notes')) redacted += 1;
    included.push({
      ...visible,
      ...(hasField(grant, 'notes') && notes !== undefined ? { notes } : {}),
    });
  }
  return {
    value: copyPage(page, included),
    redactedRecordCount: redacted,
  };
}

export function redactMeetings(
  page: Page<MeetingRecord>,
  grant: AccessGrant,
): Redacted<Page<MeetingRecord>> {
  let redacted = 0;
  const included: MeetingRecord[] = [];
  for (const item of page.items) {
    if (!canReadRecord(grant, item.id, item.investorId, ...(item.attendeePersonIds ?? []))) {
      redacted += 1;
      continue;
    }
    const { attendeePersonIds, agenda, notes, ...visible } = item;
    if (
      (attendeePersonIds !== undefined && !hasField(grant, 'meeting_attendees')) ||
      ((agenda !== undefined || notes !== undefined) && !hasField(grant, 'notes'))
    ) {
      redacted += 1;
    }
    included.push({
      ...visible,
      ...(hasField(grant, 'meeting_attendees') && attendeePersonIds !== undefined
        ? { attendeePersonIds }
        : {}),
      ...(hasField(grant, 'notes') && agenda !== undefined ? { agenda } : {}),
      ...(hasField(grant, 'notes') && notes !== undefined ? { notes } : {}),
    });
  }
  return {
    value: copyPage(page, included),
    redactedRecordCount: redacted,
  };
}

export function redactKnowledge(
  page: Page<KnowledgeRecord>,
  grant: AccessGrant,
): Redacted<Page<KnowledgeRecord>> {
  let redacted = 0;
  const included: KnowledgeRecord[] = [];
  for (const item of page.items) {
    if (!canReadRecord(grant, item.id)) {
      redacted += 1;
      continue;
    }
    const { content, ...visible } = item;
    if (content !== undefined && !hasField(grant, 'knowledge_content')) redacted += 1;
    included.push({
      ...visible,
      ...(hasField(grant, 'knowledge_content') && content !== undefined ? { content } : {}),
    });
  }
  return {
    value: copyPage(page, included),
    redactedRecordCount: redacted,
  };
}

export function redactActivity(
  page: Page<ActivityRecord>,
  grant: AccessGrant,
): Redacted<Page<ActivityRecord>> {
  let redacted = 0;
  const included: ActivityRecord[] = [];
  for (const item of page.items) {
    if (!canReadRecord(grant, item.id, item.investorId, item.personId)) {
      redacted += 1;
      continue;
    }
    const { detail, ...visible } = item;
    if (detail !== undefined && !hasField(grant, 'activity_detail')) redacted += 1;
    included.push({
      ...visible,
      ...(hasField(grant, 'activity_detail') && detail !== undefined ? { detail } : {}),
    });
  }
  return {
    value: copyPage(page, included),
    redactedRecordCount: redacted,
  };
}

export function accessGrantHasAnyPrivateAccess(grant: AccessGrant): boolean {
  return grant.recordIds.length > 0 && grant.fields.length > 0;
}
