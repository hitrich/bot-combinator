import { createHash } from 'node:crypto';
import { mkdir, open, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { BotChainDocsBundle, BotChainDocument } from '../shared/contracts';

const MAX_MANIFEST_BYTES = 1 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
const MAX_EXPORT_NAME_ATTEMPTS = 1_000;

const DocumentSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    path: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+\.md$/u),
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().min(1).max(2_000),
    category: z.enum([
      'start_here',
      'application',
      'integration',
      'bdex',
      'bo_wallet',
      'liquidity',
      'security',
    ]),
    importance: z.enum(['required', 'recommended', 'reference']),
    status: z.enum(['preview', 'approved', 'stale', 'superseded']),
    version: z.string().trim().min(1).max(100),
    tags: z.array(z.string().trim().min(1).max(100)).max(30),
    sourceOwner: z.string().trim().min(1).max(300),
    sourceUrl: z.string().url().max(4_096).nullable(),
    approvedAt: z.string().datetime({ offset: true }).nullable(),
    lastCheckedAt: z.string().datetime({ offset: true }),
    rights: z.enum(['project_authored', 'redistributable', 'link_only', 'unknown']),
    visibility: z.enum(['applicant', 'klineo_internal', 'bot_chain_partner', 'public']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  })
  .strict();

const ManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().trim().min(1).max(160),
    title: z.string().trim().min(1).max(500),
    version: z.string().trim().min(1).max(100),
    status: z.enum(['preview', 'approved', 'stale']),
    owner: z.string().trim().min(1).max(300),
    publishedAt: z.string().datetime({ offset: true }),
    nextReviewAt: z.string().datetime({ offset: true }).nullable(),
    documents: z.array(DocumentSchema).min(1).max(200),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const document of manifest.documents) {
      if (ids.has(document.id)) {
        context.addIssue({ code: 'custom', message: `Duplicate document id: ${document.id}` });
      }
      if (paths.has(document.path)) {
        context.addIssue({ code: 'custom', message: `Duplicate document path: ${document.path}` });
      }
      ids.add(document.id);
      paths.add(document.path);
    }
  });

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readBounded(path: string, maximumBytes: number, label: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw new Error(`${label} must be a regular file.`);
    if (metadata.size <= 0) throw new Error(`${label} is empty.`);
    if (metadata.size > maximumBytes) throw new Error(`${label} exceeds its safety limit.`);
    const bytes = Buffer.alloc(metadata.size);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0) throw new Error(`${label} changed while being read.`);
      offset += result.bytesRead;
    }
    const sentinel = Buffer.alloc(1);
    const extra = await handle.read(sentinel, 0, 1, bytes.length);
    if (extra.bytesRead !== 0) throw new Error(`${label} changed while being read.`);
    return bytes;
  } finally {
    await handle.close();
  }
}

function containedPath(root: string, relativePath: string): string {
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`Unsafe BOT Chain document path: ${relativePath}`);
  }
  const target = resolve(root, ...segments);
  const prefix = `${resolve(root)}${sep}`;
  if (!target.startsWith(prefix)) throw new Error(`BOT Chain document escaped its bundle root.`);
  return target;
}

const CODEX_SNIPPET = `# BOT Chain project-instruction snippet

Merge the following section into the repository's existing root AGENTS.md. Do not overwrite existing project instructions.

## BOT Chain integration

For BOT Chain work, read \`./BotAgents.md\` first. Follow the current \`./manifest.json\` and its versioned documentation. Do not invent network, contract, wallet, BDEX, or liquidity values absent from the approved bundle.
`;

export class BotChainDocsService {
  readonly #root: string;
  #bundle: BotChainDocsBundle | null = null;

  constructor(resourceDirectory: string) {
    this.#root = resolve(resourceDirectory, 'bot-chain');
  }

  async initialize(): Promise<void> {
    const manifestBytes = await readBounded(
      join(this.#root, 'manifest.json'),
      MAX_MANIFEST_BYTES,
      'BOT Chain manifest',
    );
    let manifestJson: unknown;
    try {
      manifestJson = JSON.parse(manifestBytes.toString('utf8'));
    } catch {
      throw new Error('BOT Chain manifest is not valid JSON.');
    }
    const manifest = ManifestSchema.parse(manifestJson);
    let totalBytes = manifestBytes.byteLength;
    const documents: BotChainDocument[] = [];
    for (const metadata of manifest.documents) {
      const bytes = await readBounded(
        containedPath(this.#root, metadata.path),
        MAX_DOCUMENT_BYTES,
        `BOT Chain document ${metadata.id}`,
      );
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_BUNDLE_BYTES) throw new Error('BOT Chain bundle is too large.');
      if (bytes.byteLength !== metadata.sizeBytes) {
        throw new Error(`BOT Chain document size mismatch: ${metadata.id}`);
      }
      if (sha256(bytes) !== metadata.sha256) {
        throw new Error(`BOT Chain document hash mismatch: ${metadata.id}`);
      }
      documents.push({
        ...metadata,
        content: bytes.toString('utf8'),
      });
    }
    this.#bundle = {
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      status: manifest.status,
      owner: manifest.owner,
      publishedAt: manifest.publishedAt,
      nextReviewAt: manifest.nextReviewAt,
      manifestSha256: sha256(manifestBytes),
      documents,
    };
  }

  bundle(): BotChainDocsBundle {
    if (!this.#bundle) throw new Error('BOT Chain documentation is not initialized.');
    return {
      ...this.#bundle,
      documents: this.#bundle.documents.map((document) => ({
        ...document,
        tags: [...document.tags],
      })),
    };
  }

  selectedDocuments(documentIds: readonly string[]): BotChainDocument[] {
    const bundle = this.bundle();
    const ids = new Set(documentIds);
    if (ids.size !== documentIds.length) throw new Error('BOT Chain document IDs must be unique.');
    const selected = bundle.documents.filter((document) => ids.has(document.id));
    if (selected.length !== ids.size)
      throw new Error('One or more BOT Chain documents were not found.');
    return selected;
  }

  async export(input: {
    directory: string;
    mode: 'guide' | 'selected' | 'full';
    documentIds: readonly string[];
  }): Promise<{
    path: string;
    bundleVersion: string;
    manifestSha256: string;
    documentCount: number;
  }> {
    const bundle = this.bundle();
    const destinationRoot = resolve(input.directory);
    const destinationMetadata = await stat(destinationRoot);
    if (!destinationMetadata.isDirectory())
      throw new Error('Export destination must be a directory.');

    let selected: BotChainDocument[];
    if (input.mode === 'full') selected = bundle.documents;
    else if (input.mode === 'guide') selected = this.selectedDocuments(['bot-agents']);
    else selected = this.selectedDocuments(input.documentIds);
    if (!selected.length) throw new Error('Select at least one BOT Chain document to export.');

    const name = `BOT-Chain-Integration-Pack-${bundle.version.replace(/[^A-Za-z0-9._-]/gu, '-')}`;
    let output = '';
    for (let attempt = 1; attempt <= MAX_EXPORT_NAME_ATTEMPTS; attempt += 1) {
      const suffix = attempt === 1 ? '' : `-${attempt}`;
      const candidate = join(destinationRoot, `${name}${suffix}`);
      try {
        await mkdir(candidate, { mode: 0o700 });
        output = candidate;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    if (!output) throw new Error('Could not allocate a unique BOT Chain export folder.');

    const manifestDocuments = selected.map((document) => ({
      id: document.id,
      path: document.path,
      title: document.title,
      description: document.description,
      category: document.category,
      importance: document.importance,
      status: document.status,
      version: document.version,
      tags: document.tags,
      sourceOwner: document.sourceOwner,
      sourceUrl: document.sourceUrl,
      approvedAt: document.approvedAt,
      lastCheckedAt: document.lastCheckedAt,
      rights: document.rights,
      visibility: document.visibility,
      sha256: document.sha256,
      sizeBytes: document.sizeBytes,
    }));
    const exportManifest = {
      schemaVersion: 1,
      id: bundle.id,
      title: bundle.title,
      version: bundle.version,
      status: bundle.status,
      owner: bundle.owner,
      publishedAt: bundle.publishedAt,
      nextReviewAt: bundle.nextReviewAt,
      sourceManifestSha256: bundle.manifestSha256,
      exportMode: input.mode,
      documents: manifestDocuments,
    };
    await writeFile(join(output, 'manifest.json'), `${JSON.stringify(exportManifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(join(output, 'AGENTS.botchain-snippet.md'), CODEX_SNIPPET, {
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(
      join(output, 'README.md'),
      `# ${bundle.title}\n\nBundle ${bundle.version}. Verify document hashes in manifest.json before use.\n`,
      { flag: 'wx', mode: 0o600 },
    );
    for (const document of selected) {
      const target = containedPath(output, document.path);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, document.content, { flag: 'wx', mode: 0o600 });
    }

    return {
      path: output,
      bundleVersion: bundle.version,
      manifestSha256: bundle.manifestSha256,
      documentCount: selected.length,
    };
  }

  documentFilename(documentId: string): string {
    const document = this.selectedDocuments([documentId])[0]!;
    return basename(document.path);
  }
}
