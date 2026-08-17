import type { Session } from '@supabase/supabase-js';
import { sanitizeShowcaseImage } from './images';
import type { Database, Json } from './database.types';
import { requireSupabase } from './supabase';
import type {
  BlockerInput,
  CreateCohortInput,
  CreateProjectInput,
  DeliveryStatusInput,
  InviteInput,
  MilestoneInput,
  PortalWorkspace,
  ProgressUpdateInput,
  ProjectProfileInput,
  ProjectStageInput,
  PublicShowcaseData,
  ReviewRequestInput,
  ShowcaseAsset,
  ShowcaseInput,
  Visibility,
} from './types';

type CamelWorkspace = PortalWorkspace & { showcaseAssets?: ShowcaseAsset[] };
type CamelPublicShowcase = PublicShowcaseData & { showcaseAssets?: ShowcaseAsset[] };

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [camelKey(key), camelize(child)]),
    );
  }
  return value;
}

function mapWorkspace(value: unknown): PortalWorkspace {
  const normalized = camelize(value) as CamelWorkspace;
  if (!normalized?.user?.id || !Array.isArray(normalized.projects)) {
    throw new Error('The portal workspace response was incomplete.');
  }
  const assets = normalized.showcaseAssets ?? [];
  return {
    ...normalized,
    showcaseItems: normalized.showcaseItems.map((item) => ({
      ...item,
      assets: assets.filter((asset) => asset.showcaseItemId === item.id),
    })),
  };
}

function jsonInput(value: object): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function rpc(
  name: Exclude<keyof Database['public']['Functions'], 'portal_workspace' | 'public_showcase'>,
  input: object,
): Promise<string> {
  const client = requireSupabase();
  const result = await client.rpc(name, { input: jsonInput(input) });
  if (result.error) throw result.error;
  return result.data;
}

async function hydrateSignedUrls(workspace: PortalWorkspace): Promise<PortalWorkspace> {
  const paths = workspace.showcaseItems.flatMap((item) =>
    item.assets.filter((asset) => !asset.signedUrl).map((asset) => asset.storagePath),
  );
  if (!paths.length) return workspace;
  const { data, error } = await requireSupabase()
    .storage.from('showcase-assets')
    .createSignedUrls(paths, 60 * 30);
  if (error) throw error;
  const urls = new Map(data.map((item) => [item.path, item.signedUrl]));
  return {
    ...workspace,
    showcaseItems: workspace.showcaseItems.map((item) => ({
      ...item,
      assets: item.assets.map((asset) => ({
        ...asset,
        signedUrl: urls.get(asset.storagePath) ?? null,
      })),
    })),
  };
}

export async function loadPortalWorkspace(): Promise<PortalWorkspace> {
  const { data, error } = await requireSupabase().rpc('portal_workspace');
  if (error) throw error;
  return hydrateSignedUrls(mapWorkspace(data));
}

export async function loadPublicShowcase(): Promise<PublicShowcaseData> {
  const { data, error } = await requireSupabase().rpc('public_showcase');
  if (error) throw error;
  const normalized = camelize(data) as CamelPublicShowcase;
  const assets = normalized.showcaseAssets ?? [];
  const workspace: PortalWorkspace = {
    user: {
      id: 'public',
      email: '',
      fullName: 'Public visitor',
      role: 'bot_chain_viewer',
      organizationName: 'Public showcase',
    },
    projects: normalized.projects ?? [],
    progressUpdates: [],
    milestones: [],
    blockers: [],
    showcaseItems: (normalized.showcaseItems ?? []).map((item) => ({
      ...item,
      assets: assets.filter((asset) => asset.showcaseItemId === item.id),
    })),
    comments: [],
    reviewRequests: [],
    visibilityApprovals: [],
    cohorts: [],
    desktopSubmissionImports: [],
    auditEvents: [],
  };
  const hydrated = await hydrateSignedUrls(workspace);
  return { projects: hydrated.projects, showcaseItems: hydrated.showcaseItems };
}

export async function requestMagicLink(email: string): Promise<void> {
  const redirectTo = import.meta.env.VITE_PORTAL_URL?.trim() || window.location.origin;
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function submitProgressUpdate(input: ProgressUpdateInput): Promise<void> {
  await rpc('submit_progress_update', input);
}

export async function createProject(input: CreateProjectInput): Promise<string> {
  return rpc('create_portal_project', input);
}

export async function updateProjectProfile(input: ProjectProfileInput): Promise<void> {
  await rpc('update_project_profile', input);
}

export async function updateProjectStage(input: ProjectStageInput): Promise<void> {
  await rpc('update_project_stage', input);
}

export async function createMilestone(input: MilestoneInput): Promise<void> {
  await rpc('create_portal_milestone', input);
}

export async function createBlocker(input: BlockerInput): Promise<void> {
  await rpc('create_portal_blocker', input);
}

export async function updateDeliveryStatus(input: DeliveryStatusInput): Promise<void> {
  await rpc('update_delivery_status', input);
}

export async function createCohort(input: CreateCohortInput): Promise<void> {
  await rpc('create_portal_cohort', input);
}

export async function createShowcase(input: ShowcaseInput): Promise<string> {
  return rpc('create_showcase_item', input);
}

export async function uploadShowcaseScreenshot(
  input: Omit<ShowcaseInput, 'type' | 'url'>,
  sourceFile: File,
  userId: string,
): Promise<void> {
  const image = await sanitizeShowcaseImage(sourceFile);
  const showcaseItemId = await createShowcase({ ...input, type: 'screenshot', url: null });
  const path = `${input.projectId}/${userId}/${crypto.randomUUID()}.webp`;
  const bucket = requireSupabase().storage.from('showcase-assets');
  const signed = await bucket.createSignedUploadUrl(path);
  if (signed.error) throw signed.error;
  const uploaded = await bucket.uploadToSignedUrl(path, signed.data.token, image.file, {
    contentType: 'image/webp',
    cacheControl: '3600',
  });
  if (uploaded.error) throw uploaded.error;
  try {
    await rpc('register_showcase_asset', {
      showcaseItemId,
      storagePath: path,
      fileName: image.file.name,
      mimeType: image.file.type,
      sizeBytes: image.file.size,
      width: image.width,
      height: image.height,
    });
  } catch (error) {
    await bucket.remove([path]);
    throw error;
  }
}

export async function addComment(input: {
  projectId: string;
  subjectType: string;
  subjectId: string;
  body: string;
  visibility: Visibility | 'klineo_internal';
}): Promise<void> {
  await rpc('add_portal_comment', input);
}

export async function requestVisibility(input: {
  subjectType: string;
  subjectId: string;
  toVisibility: 'bot_chain' | 'public';
}): Promise<void> {
  await rpc('request_visibility_change', input);
}

export async function decideVisibility(input: {
  approvalId: string;
  decision: 'approved' | 'rejected';
  note: string;
}): Promise<void> {
  await rpc('decide_visibility_change', input);
}

export async function revokeVisibility(input: {
  subjectType: string;
  subjectId: string;
  toVisibility: 'project_private' | 'project_and_klineo';
}): Promise<void> {
  await rpc('revoke_shared_visibility', input);
}

export async function decideReview(input: {
  reviewId: string;
  status: 'in_review' | 'changes_requested' | 'approved' | 'closed';
}): Promise<void> {
  await rpc('decide_review_request', input);
}

export async function requestReview(input: ReviewRequestInput): Promise<void> {
  await rpc('create_review_request', input);
}

export async function importDesktopSubmission(
  projectId: string,
  bundle: Record<string, unknown>,
): Promise<void> {
  await rpc('import_desktop_submission', { projectId, bundle });
}

export async function inviteMember(input: InviteInput): Promise<void> {
  const result = await requireSupabase().functions.invoke('invite-member', { body: input });
  if (result.error) throw result.error;
}
