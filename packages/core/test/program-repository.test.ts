import { createRequire } from 'node:module';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { BotCombinatorRepository, CoreVault } from '../src/index.js';

const CREATED_AT = '2026-08-17T09:00:00.000Z';
const UPDATED_AT = '2026-08-17T10:00:00.000Z';
const LAUNCHED_AT = '2026-08-17T11:00:00.000Z';
let SQL: SqlJsStatic;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const wasm = require.resolve('sql.js/dist/sql-wasm.wasm');
  SQL = await initSqlJs({ locateFile: () => wasm });
});

describe('ecosystem program repository', () => {
  it('tracks a project from program intake through gates, milestones, metrics, and launch', () => {
    const vault = new CoreVault(SQL, { appliedAt: CREATED_AT });
    const repository = new BotCombinatorRepository(vault);

    expect(repository.ecosystemProgram('program-missing')).toBeNull();

    repository.upsertEcosystemProgram({
      id: 'program-1',
      name: 'Bot Combinator 2026',
      partnerName: 'BOT Chain',
      status: 'active',
      grantPeriodStart: '2026-08-01',
      grantPeriodEnd: '2026-12-31',
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    repository.upsertEcosystemProgram(
      {
        id: 'program-1',
        name: 'Bot Combinator 2026',
        partnerName: 'BOT Chain',
        status: 'active',
        grantPeriodStart: '2026-08-01',
        grantPeriodEnd: '2026-12-31',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      'system',
    );
    expect(repository.ecosystemProgram('program-1')).toMatchObject({
      id: 'program-1',
      status: 'active',
      updatedAt: UPDATED_AT,
    });

    repository.createEcosystemProject(
      {
        id: 'project-1',
        programId: 'program-1',
        name: 'Atlas Pay',
        website: 'https://atlas.example',
        description: 'Policy-bound wallets and settlement infrastructure.',
        stage: 'sourced',
        source: 'application',
        ownerName: 'Lina Ortiz',
        ownerEmail: 'lina@atlas.example',
        targetLaunchAt: '2026-09-14T12:00:00.000Z',
        launchedAt: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
      'Imported program application',
    );
    expect(repository.listEcosystemProjects('program-1')).toEqual([
      expect.objectContaining({ id: 'project-1', stage: 'sourced' }),
    ]);
    expect(() =>
      repository.moveEcosystemProjectStage({
        projectId: 'project-missing',
        stage: 'cohort',
        reason: 'Missing project check',
        occurredAt: UPDATED_AT,
      }),
    ).toThrow('Ecosystem project not found');

    repository.moveEcosystemProjectStage({
      projectId: 'project-1',
      stage: 'cohort',
      reason: 'Accepted into the launch cohort',
      occurredAt: UPDATED_AT,
    });
    expect(() =>
      repository.moveEcosystemProjectStage({
        projectId: 'project-1',
        stage: 'cohort',
        reason: 'Duplicate transition',
        occurredAt: UPDATED_AT,
      }),
    ).toThrow('Project is already in that stage');
    repository.moveEcosystemProjectStage({
      projectId: 'project-1',
      stage: 'live_market',
      reason: 'Launch checks passed',
      occurredAt: LAUNCHED_AT,
      actorType: 'agent',
      actorId: 'launch-agent',
    });
    expect(repository.listEcosystemProjects('program-1')[0]).toMatchObject({
      stage: 'live_market',
      launchedAt: LAUNCHED_AT,
    });

    repository.upsertCohort({
      id: 'cohort-1',
      programId: 'program-1',
      name: 'Launch Cohort 01',
      thesis: 'Production-ready teams integrating with BOT Chain.',
      startsOn: '2026-08-01',
      endsOn: '2026-10-31',
      capacity: 12,
      status: 'active',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(repository.listCohorts('program-1')).toEqual([
      expect.objectContaining({ id: 'cohort-1', capacity: 12, status: 'active' }),
    ]);

    repository.upsertCohortMembership({
      cohortId: 'cohort-1',
      projectId: 'project-1',
      state: 'active',
      admittedAt: UPDATED_AT,
      completedAt: null,
      updatedAt: UPDATED_AT,
    });
    expect(repository.listCohortMemberships('program-1')).toEqual([
      expect.objectContaining({ cohortId: 'cohort-1', projectId: 'project-1', state: 'active' }),
    ]);

    const gates = repository.listQualityGateDefinitions();
    expect(gates).toHaveLength(11);
    expect(gates[0]).toMatchObject({ key: 'team_identity', version: 1, active: true });
    repository.upsertProjectGateReview({
      id: 'gate-review-1',
      projectId: 'project-1',
      gateKey: gates[0]!.key,
      gateVersion: gates[0]!.version,
      status: 'passed',
      rationale: 'Identity and authority evidence verified.',
      evidence: 'Klineo review packet 01',
      reviewedBy: 'Maya Chen',
      reviewedAt: UPDATED_AT,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(repository.listProjectGateReviews('program-1')).toEqual([
      expect.objectContaining({ id: 'gate-review-1', status: 'passed' }),
    ]);

    repository.upsertProgramMilestone({
      id: 'milestone-1',
      projectId: 'project-1',
      cohortId: 'cohort-1',
      title: 'Complete BOT Chain sandbox settlement',
      category: 'integration',
      owner: 'Lina Ortiz',
      dueAt: '2026-09-01T12:00:00.000Z',
      evidenceRequired: 'Successful settlement and reconciliation receipt.',
      evidence: 'Sandbox receipt #42',
      status: 'completed',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
    expect(repository.listProgramMilestones('program-1')).toEqual([
      expect.objectContaining({ id: 'milestone-1', status: 'completed' }),
    ]);

    repository.insertProgramMetricObservation({
      id: 'metric-1',
      programId: 'program-1',
      projectId: 'project-1',
      key: 'integration_readiness',
      value: 100,
      unit: 'percent',
      observedAt: LAUNCHED_AT,
      sourceLabel: 'Klineo gate review',
      quality: 'verified',
      createdAt: LAUNCHED_AT,
    });
    expect(repository.listProgramMetricObservations('program-1')).toEqual([
      expect.objectContaining({ id: 'metric-1', key: 'integration_readiness', value: 100 }),
    ]);
    expect(repository.getRoundSummary('round-missing')).toEqual({});

    expect(
      vault.all<{ action: string }>(
        "SELECT action FROM audit_log WHERE action LIKE 'ecosystem_%' OR action LIKE 'program_%' ORDER BY id",
      ).length,
    ).toBeGreaterThan(0);
    vault.close();
  });
});
