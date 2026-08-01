import { createHash } from 'node:crypto';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { z } from 'zod';
import type { CoreVault } from './database.js';
import { appendAuditEntry } from './repository.js';

const SeedManifestSchema = z.object({
  package_id: z.string().min(1),
  package_version: z.string().min(1),
  package_kind: z.literal('seed'),
  seed_format_version: z.coerce.number().int().positive(),
  data_schema_version: z.coerce.number().int().positive(),
  logical_digest_sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  signature_status: z.string().min(1),
});

type SeedRow = Record<string, SqlValue>;

export interface SeedImportOptions {
  readonly importedAt: string;
  readonly expectedLogicalDigest?: string;
  readonly expectedFileSha256?: string;
  readonly allowUnsignedResearch?: boolean;
  readonly verifySignature?: (
    manifest: Readonly<z.infer<typeof SeedManifestSchema>>,
    seedBytes: Uint8Array,
  ) => boolean;
}

export interface SeedImportResult {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly logicalDigestSha256: string;
  readonly sourceFileSha256: string;
  readonly signatureStatus: 'verified' | 'unsigned_research';
  readonly firmCount: number;
  readonly personCount: number;
  readonly sourceCount: number;
  readonly alreadyImported: boolean;
}

function all<T = SeedRow>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const rows: T[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as T);
    return rows;
  } finally {
    statement.free();
  }
}

function requiredTables(db: Database): void {
  const expected = [
    'package_manifest',
    'package_license',
    'build_input',
    'entity',
    'firm_profile',
    'person_profile',
    'individual_profile',
    'source',
    'entity_source',
    'tag',
    'entity_tag',
    'identity',
    'portfolio_example',
    'firm_named_partner',
  ];
  const present = new Set(
    all<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table'").map(
      (row) => row.name,
    ),
  );
  const missing = expected.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`Seed is missing required tables: ${missing.join(', ')}`);
}

const DATA_TABLES_FOR_DIGEST = [
  'package_license',
  'build_input',
  'entity',
  'firm_profile',
  'person_profile',
  'individual_profile',
  'identity',
  'tag',
  'entity_tag',
  'source',
  'entity_source',
  'portfolio_example',
  'firm_named_partner',
] as const;

export function computeSeedLogicalDigest(db: Database): string {
  const root = createHash('sha256');
  for (const table of DATA_TABLES_FOR_DIGEST) {
    const columns = all<{ name: string }>(db, `PRAGMA table_info("${table}")`).map(
      (row) => row.name,
    );
    if (!columns.length) throw new Error(`Seed digest table ${table} is missing`);
    const order = columns.map((column) => `"${column.replaceAll('"', '""')}"`).join(',');
    const tableHash = createHash('sha256');
    for (const row of all(db, `SELECT * FROM "${table}" ORDER BY ${order}`)) {
      const canonical = Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
      const payload = JSON.stringify(canonical, Object.keys(canonical).sort());
      tableHash.update(payload, 'utf8');
      tableHash.update('\n', 'utf8');
    }
    root.update(table, 'utf8');
    root.update(Buffer.from([0]));
    root.update(tableHash.digest());
  }
  return root.digest('hex');
}

function mapSourceRedistribution(
  value: string,
): 'allowed' | 'attribution_required' | 'unknown' | 'prohibited' {
  const normalized = value.toLowerCase();
  if (normalized === 'allowed' || normalized === 'normalized_facts_only') return 'allowed';
  if (normalized.includes('attribution')) return 'attribution_required';
  if (normalized.includes('prohibit')) return 'prohibited';
  return 'unknown';
}

function cleanNullable(value: SqlValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function normalizedUrl(value: SqlValue | undefined): string | null {
  const text = cleanNullable(value);
  if (!text) return null;
  return text.toLocaleLowerCase('en-US').replace(/\/+$/u, '');
}

function individualInvestorType(value: SqlValue | undefined): string {
  const normalized = cleanNullable(value)?.toLocaleLowerCase('en-US');
  switch (normalized) {
    case 'angel':
    case 'individual angel':
      return 'angel';
    case 'solo gp':
      return 'solo_gp';
    case 'scout':
      return 'scout';
    case 'family office':
      return 'family_office';
    default:
      throw new Error(`Unsupported primary individual investor type: ${normalized ?? 'missing'}`);
  }
}

function organizationInvestorType(value: SqlValue | undefined): string {
  const primary = cleanNullable(value)?.split(';', 1)[0]?.trim().toLocaleLowerCase('en-US');
  switch (primary) {
    case 'institutional vc':
    case 'venture capital':
    case 'vc firm':
    case 'vc_firm':
      return 'venture_capital';
    case 'micro vc':
      return 'micro_vc';
    case 'corporate / strategic vc':
    case 'corporate vc':
      return 'corporate_vc';
    case 'token / crypto fund':
    case 'crypto fund':
      return 'crypto_fund';
    case 'accelerator / incubator':
    case 'accelerator':
      return 'accelerator';
    case 'venture studio':
      return 'venture_studio';
    case 'family office':
      return 'family_office';
    case 'syndicate':
      return 'syndicate';
    case 'angel network':
    case 'founder community':
      return 'angel_network';
    default:
      throw new Error(`Unsupported primary organization investor type: ${primary ?? 'missing'}`);
  }
}

function ensureIso(value: SqlValue | undefined, fallback: string): string {
  const text = cleanNullable(value);
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}

export function importInvestorSeed(
  sqlite: SqlJsStatic,
  vault: CoreVault,
  seedBytes: Uint8Array,
  options: SeedImportOptions,
): SeedImportResult {
  const seed = new sqlite.Database(seedBytes);
  try {
    seed.run('PRAGMA query_only = ON');
    requiredTables(seed);
    const manifestRow = all(seed, 'SELECT * FROM package_manifest ORDER BY package_id LIMIT 2');
    if (manifestRow.length !== 1) throw new Error('Seed must contain exactly one package manifest');
    const manifest = SeedManifestSchema.parse(manifestRow[0]);
    if (manifest.seed_format_version !== 2 || manifest.data_schema_version !== 2) {
      throw new Error(
        `Unsupported investor seed format ${manifest.seed_format_version}/${manifest.data_schema_version}; expected 2/2`,
      );
    }
    const digest = manifest.logical_digest_sha256.toLowerCase();
    const computedDigest = computeSeedLogicalDigest(seed);
    if (computedDigest !== digest) throw new Error('Seed contents do not match its logical digest');
    const sourceFileSha256 = createHash('sha256').update(seedBytes).digest('hex');
    if (options.expectedLogicalDigest && digest !== options.expectedLogicalDigest.toLowerCase()) {
      throw new Error('Seed logical digest does not match the pinned digest');
    }
    if (
      options.expectedFileSha256 &&
      sourceFileSha256 !== options.expectedFileSha256.toLowerCase()
    ) {
      throw new Error('Seed file SHA-256 does not match the pinned release artifact');
    }
    const status =
      options.verifySignature?.(manifest, seedBytes) === true ? 'verified' : 'unsigned_research';
    if (
      status === 'unsigned_research' &&
      !options.allowUnsignedResearch &&
      !options.expectedLogicalDigest &&
      !options.expectedFileSha256
    ) {
      throw new Error(
        'Unsigned research seed requires a pinned digest or allowUnsignedResearch=true',
      );
    }

    const prior = vault.one<{
      logical_digest_sha256: string;
      source_file_sha256: string;
      package_version: string;
      signature_status: string;
      firm_count: number;
      person_count: number;
      source_count: number;
    }>(
      'SELECT logical_digest_sha256,source_file_sha256,package_version,signature_status,firm_count,person_count,source_count FROM seed_imports WHERE package_id=?',
      [manifest.package_id],
    );
    if (prior) {
      if (prior.logical_digest_sha256 !== digest)
        throw new Error(
          `Seed package ${manifest.package_id} was already imported with a different digest`,
        );
      return {
        packageId: manifest.package_id,
        packageVersion: prior.package_version,
        logicalDigestSha256: digest,
        sourceFileSha256: prior.source_file_sha256,
        signatureStatus: prior.signature_status as 'verified' | 'unsigned_research',
        firmCount: Number(prior.firm_count),
        personCount: Number(prior.person_count),
        sourceCount: Number(prior.source_count),
        alreadyImported: true,
      };
    }

    const sources = all(seed, 'SELECT * FROM source ORDER BY source_id');
    const firms = all(
      seed,
      `SELECT e.*,f.* FROM entity e JOIN firm_profile f ON f.entity_id=e.entity_id WHERE e.entity_kind='firm' ORDER BY e.entity_id`,
    );
    const firmPeople = all(
      seed,
      `SELECT e.*,p.* FROM entity e JOIN person_profile p ON p.entity_id=e.entity_id WHERE e.entity_kind='person' ORDER BY e.entity_id`,
    );
    const individuals = all(
      seed,
      `SELECT e.*,p.* FROM entity e JOIN individual_profile p ON p.entity_id=e.entity_id WHERE e.entity_kind='individual_investor' ORDER BY e.entity_id`,
    );
    const identities = all(seed, 'SELECT * FROM identity ORDER BY identity_id');
    const tags = all(seed, 'SELECT * FROM tag ORDER BY tag_id');
    const entityTags = all(seed, 'SELECT * FROM entity_tag ORDER BY entity_id,tag_id,basis');
    const entitySources = all(
      seed,
      'SELECT * FROM entity_source ORDER BY entity_id,source_id,source_role',
    );
    const portfolioExamples = all(
      seed,
      'SELECT * FROM portfolio_example ORDER BY firm_id,normalized_company_name',
    );
    const namedPartners = all(
      seed,
      'SELECT * FROM firm_named_partner ORDER BY firm_id,normalized_person_name',
    );
    const targetableInvestorCount = firms.length + individuals.length;

    // A founder may already have captured the same URL or tag under a local ID.
    // Preserve that record and map incoming relationships to it instead of
    // weakening the canonical uniqueness constraints.
    const sourceIdMap = new Map<string, string>();
    for (const row of sources) {
      const seedId = String(row.source_id);
      const existing = vault.one<{ id: string }>('SELECT id FROM sources WHERE canonical_url=?', [
        String(row.canonical_url),
      ]);
      sourceIdMap.set(seedId, existing?.id ?? seedId);
    }
    const tagIdMap = new Map<string, string>();
    for (const row of tags) {
      const seedId = String(row.tag_id);
      const existing = vault.one<{ id: string }>(
        'SELECT id FROM tags WHERE kind=? AND normalized_value=?',
        [String(row.tag_kind), String(row.normalized_value)],
      );
      tagIdMap.set(seedId, existing?.id ?? seedId);
    }

    // Identity rows have a one-to-one, role-specific source relation in the
    // seed. Resolve only that exact URL. Research assertions and portfolio
    // rows are intentionally not assigned an arbitrary entity-level source.
    const sourceUrlById = new Map(
      sources.map((row) => [String(row.source_id), normalizedUrl(row.canonical_url)]),
    );
    const exactSourceByIdentity = new Map<string, string>();
    for (const row of entitySources) {
      const sourceId = String(row.source_id);
      const url = sourceUrlById.get(sourceId);
      if (!url) continue;
      exactSourceByIdentity.set(
        `${String(row.entity_id)}\u0000${String(row.source_role)}\u0000${url}`,
        sourceIdMap.get(sourceId) ?? sourceId,
      );
    }
    const identitySource = (
      entityId: string,
      sourceRole: string,
      value: SqlValue | undefined,
    ): string | null => {
      const url = normalizedUrl(value);
      return url
        ? (exactSourceByIdentity.get(`${entityId}\u0000${sourceRole}\u0000${url}`) ?? null)
        : null;
    };

    vault.transaction(() => {
      for (const row of sources) {
        const destinationId = sourceIdMap.get(String(row.source_id))!;
        if (destinationId !== String(row.source_id)) continue;
        const redistribution = mapSourceRedistribution(String(row.redistribution_status));
        vault.run(
          `INSERT INTO sources(id,canonical_url,title,publisher,source_type,retrieved_at,published_on,rights_class,redistribution_status,attribution,excerpt,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.source_id),
            String(row.canonical_url),
            null,
            String(row.host),
            String(row.source_type),
            ensureIso(row.retrieved_at, options.importedAt),
            null,
            String(row.rights_class),
            redistribution,
            null,
            cleanNullable(row.evidence_excerpt),
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      for (const row of firms) {
        vault.run(
          `INSERT INTO firms(id,name,normalized_name,website,investor_type,headquarters,description,is_public,contribution_eligible,origin,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,1,0,'seed',?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.entity_id),
            String(row.display_name),
            normalizedName(String(row.display_name)),
            cleanNullable(row.website),
            organizationInvestorType(row.investor_types_text),
            cleanNullable(row.hq_cities_text),
            cleanNullable(row.data_quality_notes),
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      // Independent angels, solo GPs, scouts, and family offices are both a
      // targetable investor and a linked human profile. Keeping both records
      // lets the firm-oriented pipeline target them without losing person-level
      // contact and communication safety.
      for (const row of individuals) {
        vault.run(
          `INSERT INTO firms(id,name,normalized_name,website,investor_type,headquarters,description,is_public,contribution_eligible,origin,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,1,0,'seed',?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.entity_id),
            String(row.display_name),
            normalizedName(String(row.display_name)),
            cleanNullable(row.website_or_bio_url),
            individualInvestorType(row.primary_investor_type),
            cleanNullable(row.city_geography),
            cleanNullable(row.data_quality_notes),
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      for (const row of [...firmPeople, ...individuals]) {
        const individual = String(row.entity_kind) === 'individual_investor';
        vault.run(
          `INSERT INTO people(id,firm_id,full_name,normalized_name,title,city,bio,is_investor,is_public,contribution_eligible,origin,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,1,1,0,'seed',?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.entity_id),
            individual ? String(row.entity_id) : String(row.firm_id),
            String(row.display_name),
            normalizedName(String(row.display_name)),
            cleanNullable(row.title) ??
              (individual ? cleanNullable(row.primary_investor_type) : null),
            cleanNullable(row.city) ?? (individual ? cleanNullable(row.city_geography) : null),
            cleanNullable(row.data_quality_notes),
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      const entityKinds = new Map<string, ReadonlySet<'firm' | 'person'>>();
      for (const row of firms) entityKinds.set(String(row.entity_id), new Set(['firm']));
      for (const row of firmPeople) entityKinds.set(String(row.entity_id), new Set(['person']));
      for (const row of individuals)
        entityKinds.set(String(row.entity_id), new Set(['firm', 'person']));

      for (const row of tags) {
        const destinationId = tagIdMap.get(String(row.tag_id))!;
        if (destinationId !== String(row.tag_id)) continue;
        vault.run(
          `INSERT INTO tags(id,kind,value,normalized_value,is_public,contribution_eligible,created_at,updated_at)
          VALUES (?,?,?,?,1,0,?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.tag_id),
            String(row.tag_kind),
            String(row.display_value),
            String(row.normalized_value),
            options.importedAt,
            options.importedAt,
          ],
        );
      }
      for (const row of entityTags) {
        const kinds = entityKinds.get(String(row.entity_id));
        if (!kinds) continue;
        const tagId = tagIdMap.get(String(row.tag_id));
        if (!tagId) continue;
        for (const kind of kinds) {
          vault.run(
            `INSERT INTO entity_tags(entity_type,entity_id,tag_id,source_id,is_public,contribution_eligible,created_at)
            VALUES (?,?,?,NULL,1,0,?) ON CONFLICT(entity_type,entity_id,tag_id) DO NOTHING`,
            [kind, String(row.entity_id), tagId, options.importedAt],
          );
        }
      }

      for (const row of entitySources) {
        const sourceId = sourceIdMap.get(String(row.source_id));
        const entityId = String(row.entity_id);
        const kinds = entityKinds.get(entityId);
        if (sourceId && kinds) {
          for (const kind of kinds) {
            vault.run(
              `INSERT OR IGNORE INTO entity_sources(entity_type,entity_id,source_id,source_role,evidence_granularity,is_public,contribution_eligible,created_at)
            VALUES (?,?,?,?,?,1,0,?)`,
              [
                kind,
                entityId,
                sourceId,
                String(row.source_role),
                String(row.evidence_granularity),
                options.importedAt,
              ],
            );
          }
        }
      }
      for (const row of identities) {
        const entityId = String(row.entity_id);
        if (!entityKinds.get(entityId)?.has('person')) continue;
        const scheme = String(row.scheme);
        const kind =
          scheme === 'linkedin_url'
            ? 'linkedin'
            : scheme === 'x_url'
              ? 'x'
              : scheme === 'website' || scheme === 'bio_url'
                ? 'website'
                : 'other';
        vault.run(
          `INSERT INTO contact_methods(id,person_id,kind,value,normalized_value,label,source_id,visibility,contribution_eligible,is_primary,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,'public',0,0,?,?) ON CONFLICT(id) DO NOTHING`,
          [
            String(row.identity_id),
            entityId,
            kind,
            String(row.display_value),
            String(row.normalized_value),
            scheme,
            identitySource(entityId, scheme, row.normalized_value),
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      const claimFields = [
        ['investor_types', 'investor_types_text'],
        ['stages', 'stages_text'],
        ['sectors', 'sectors_tags_text'],
        ['check_size', 'typical_initial_check_usd_text'],
        ['fund_signal', 'fund_or_aum_signal'],
        ['priority_geography', 'priority_geography_text'],
        ['notable_portfolio', 'notable_portfolio_examples_text'],
        ['key_partners', 'key_partners_text'],
        ['linkedin_url', 'linkedin_url'],
        ['x_url', 'x_url'],
        ['contact_url', 'contact_or_application_url'],
      ] as const;
      for (const row of firms) {
        const entityId = String(row.entity_id);
        for (const [field, column] of claimFields) {
          const value = cleanNullable(row[column]);
          if (!value) continue;
          const sourceRole =
            field === 'linkedin_url'
              ? 'linkedin_url'
              : field === 'x_url'
                ? 'x_url'
                : field === 'contact_url'
                  ? 'contact_url'
                  : null;
          const sourceId = sourceRole ? identitySource(entityId, sourceRole, value) : null;
          vault.run(
            `INSERT OR IGNORE INTO claims(id,entity_type,entity_id,field,value_json,source_id,confidence,observed_at,status,is_public,contribution_eligible,created_at,updated_at)
            VALUES (?,?,?,?,?,?,NULL,?,'asserted',1,0,?,?)`,
            [
              `seed-claim:${entityId}:${field}`,
              'firm',
              entityId,
              field,
              JSON.stringify(value),
              sourceId,
              ensureIso(row.verification_date, options.importedAt),
              options.importedAt,
              options.importedAt,
            ],
          );
        }
      }

      const individualClaimFields = [
        ['primary_investor_type', 'primary_investor_type', null],
        ['investor_types', 'investor_types_text', null],
        ['geography_basis', 'geography_basis', null],
        ['stages', 'stages_text', null],
        ['focus', 'focus_tags_text', null],
        ['check_size', 'check_size_evidence', null],
        ['affiliations', 'affiliations_text', null],
        ['contact_url', 'contact_or_application_url', 'contact_url'],
      ] as const;
      for (const row of individuals) {
        const entityId = String(row.entity_id);
        for (const [field, column, sourceRole] of individualClaimFields) {
          const value = cleanNullable(row[column]);
          if (!value) continue;
          const sourceId = sourceRole ? identitySource(entityId, sourceRole, value) : null;
          for (const entityType of ['firm', 'person'] as const) {
            vault.run(
              `INSERT OR IGNORE INTO claims(id,entity_type,entity_id,field,value_json,source_id,confidence,observed_at,status,is_public,contribution_eligible,created_at,updated_at)
              VALUES (?,?,?,?,?,?,NULL,?,'asserted',1,0,?,?)`,
              [
                entityType === 'person'
                  ? `seed-claim:${entityId}:${field}`
                  : `seed-claim:firm:${entityId}:${field}`,
                entityType,
                entityId,
                field,
                JSON.stringify(value),
                sourceId,
                ensureIso(row.verification_date, options.importedAt),
                options.importedAt,
                options.importedAt,
              ],
            );
          }
        }
      }
      for (const row of portfolioExamples) {
        const firmId = String(row.firm_id);
        vault.run(
          `INSERT OR IGNORE INTO claims(id,entity_type,entity_id,field,value_json,source_id,confidence,observed_at,status,is_public,contribution_eligible,created_at,updated_at)
          VALUES (?,?,?,?,?,?,NULL,?,'asserted',1,0,?,?)`,
          [
            `seed-portfolio:${firmId}:${String(row.normalized_company_name)}`,
            'firm',
            firmId,
            'portfolio_example',
            JSON.stringify({ companyName: String(row.company_name), caveat: String(row.caveat) }),
            null,
            options.importedAt,
            options.importedAt,
            options.importedAt,
          ],
        );
      }
      for (const row of namedPartners) {
        const firmId = String(row.firm_id);
        vault.run(
          `INSERT OR IGNORE INTO claims(id,entity_type,entity_id,field,value_json,source_id,confidence,observed_at,status,is_public,contribution_eligible,created_at,updated_at)
          VALUES (?,?,?,?,?,?,NULL,?,'asserted',1,0,?,?)`,
          [
            `seed-partner:${firmId}:${String(row.normalized_person_name)}`,
            'firm',
            firmId,
            'named_partner',
            JSON.stringify({ personName: String(row.person_name), caveat: String(row.caveat) }),
            null,
            options.importedAt,
            options.importedAt,
            options.importedAt,
          ],
        );
      }

      vault.run(
        'INSERT INTO seed_imports(package_id,package_version,logical_digest_sha256,source_file_sha256,signature_status,imported_at,firm_count,person_count,source_count) VALUES (?,?,?,?,?,?,?,?,?)',
        [
          manifest.package_id,
          manifest.package_version,
          digest,
          sourceFileSha256,
          status,
          options.importedAt,
          targetableInvestorCount,
          firmPeople.length + individuals.length,
          sources.length,
        ],
      );
      appendAuditEntry(vault, {
        occurredAt: options.importedAt,
        actorType: 'system',
        action: 'seed.imported',
        entityType: 'seed_package',
        entityId: manifest.package_id,
        detail: {
          digest,
          firms: targetableInvestorCount,
          people: firmPeople.length + individuals.length,
          sources: sources.length,
        },
      });
    });

    return {
      packageId: manifest.package_id,
      packageVersion: manifest.package_version,
      logicalDigestSha256: digest,
      sourceFileSha256,
      signatureStatus: status,
      firmCount: targetableInvestorCount,
      personCount: firmPeople.length + individuals.length,
      sourceCount: sources.length,
      alreadyImported: false,
    };
  } finally {
    seed.close();
  }
}
