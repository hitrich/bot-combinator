import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

function defaultKey(dictionaryName: string, legacyName: string): string {
  const dictionary = Deno.env.get(dictionaryName);
  if (dictionary) {
    try {
      const keys = JSON.parse(dictionary) as Record<string, unknown>;
      if (typeof keys.default === 'string' && keys.default) return keys.default;
      const available = Object.values(keys).find(
        (value): value is string => typeof value === 'string' && Boolean(value),
      );
      if (available) return available;
    } catch {
      console.error(`invite-member: ${dictionaryName} is not valid JSON`);
    }
  }
  return Deno.env.get(legacyName) ?? '';
}

const portalUrl = Deno.env.get('PORTAL_URL') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const publishableKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
const secretKey = defaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

const allowedRoles = new Set([
  'klineo_admin',
  'klineo_operator',
  'klineo_reviewer',
  'bot_chain_reviewer',
  'bot_chain_viewer',
  'project_lead',
  'project_member',
]);

const roleLabels: Record<string, string> = {
  klineo_admin: 'Klineo administrator',
  klineo_operator: 'Klineo program operator',
  klineo_reviewer: 'Klineo reviewer',
  bot_chain_reviewer: 'BOT Chain reviewer',
  bot_chain_viewer: 'BOT Chain viewer',
  project_lead: 'Project lead',
  project_member: 'Project member',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': portalUrl,
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response({ ok: true });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  if (!portalUrl || !supabaseUrl || !publishableKey || !secretKey) {
    return response({ error: 'Invite service is not configured' }, 503);
  }
  if (request.headers.get('origin') !== portalUrl) {
    return response({ error: 'Origin is not allowed' }, 403);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return response({ error: 'Authentication required' }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } = await userClient.auth.getUser();
  if (identityError || !identity.user) return response({ error: 'Authentication required' }, 401);

  const { data: actorRole, error: actorError } = await userClient.rpc('current_portal_role', {
    target_project_id: null,
  });
  if (actorError) {
    console.error('invite-member: actor role lookup failed', actorError);
    return response({ error: 'Could not verify invitation authority' }, 500);
  }
  const actorRoles = new Set(actorRole ? [actorRole] : []);
  if (!actorRoles.has('klineo_admin') && !actorRoles.has('klineo_operator')) {
    return response({ error: 'Klineo operator access is required' }, 403);
  }

  let body: {
    email?: string;
    fullName?: string;
    projectId?: string | null;
    role?: string;
  };
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Invalid JSON body' }, 400);
  }
  const email = body.email?.trim().toLowerCase() ?? '';
  const fullName = body.fullName?.trim() ?? '';
  const role = body.role ?? '';
  if (!/^\S+@\S+\.\S+$/.test(email) || !allowedRoles.has(role)) {
    return response({ error: 'A valid email and role are required' }, 400);
  }
  if (role === 'klineo_admin' && !actorRoles.has('klineo_admin')) {
    return response({ error: 'Only a Klineo admin can invite another admin' }, 403);
  }

  const projectRole = role === 'project_lead' || role === 'project_member';
  const projectId = projectRole ? body.projectId : null;
  if (projectRole && !projectId) return response({ error: 'Project membership is required' }, 400);

  let organizationId: string | null = null;
  let scopeName = 'Bot Combinator';
  if (projectRole) {
    const { data: project, error } = await adminClient
      .from('projects')
      .select('owner_organization_id, name')
      .eq('id', projectId)
      .single();
    if (error || !project) {
      console.error('invite-member: project lookup failed', { projectId, error });
      return response({ error: 'Project was not found' }, 404);
    }
    organizationId = project.owner_organization_id;
    scopeName = project.name;
  } else {
    const organizationType = role.startsWith('bot_chain_') ? 'bot_chain' : 'klineo';
    const { data: organization, error } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('type', organizationType)
      .limit(1)
      .single();
    if (error || !organization) {
      return response({ error: `${organizationType} organization is not configured` }, 409);
    }
    organizationId = organization.id;
    scopeName = organization.name;
  }

  let pendingQuery = adminClient
    .from('invitations')
    .select('id')
    .ilike('email', email)
    .eq('organization_id', organizationId)
    .is('accepted_at', null);
  pendingQuery = projectId
    ? pendingQuery.eq('project_id', projectId)
    : pendingQuery.is('project_id', null);
  const { data: pendingInvitation } = await pendingQuery.maybeSingle();
  const invitationValues = {
    email,
    full_name: fullName,
    organization_id: organizationId,
    project_id: projectId,
    role,
    invited_by: identity.user.id,
    accepted_at: null,
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  };
  const invitationResult = pendingInvitation
    ? await adminClient
        .from('invitations')
        .update(invitationValues)
        .eq('id', pendingInvitation.id)
        .select('id')
        .single()
    : await adminClient.from('invitations').insert(invitationValues).select('id').single();
  const { data: invitation, error: invitationError } = invitationResult;
  if (invitationError || !invitation) {
    return response({ error: invitationError?.message ?? 'Could not create invitation' }, 409);
  }

  const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) return response({ error: 'Could not inspect existing accounts' }, 500);
  const existing = usersPage.users.find((candidate) => candidate.email?.toLowerCase() === email);

  if (existing) {
    await adminClient
      .from('memberships')
      .upsert(
        { organization_id: organizationId, user_id: existing.id, role },
        { onConflict: 'organization_id,user_id' },
      );
    if (projectRole && projectId) {
      await adminClient
        .from('project_members')
        .upsert(
          { project_id: projectId, user_id: existing.id, role },
          { onConflict: 'project_id,user_id' },
        );
    }
    await adminClient
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    const mailClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInEmailError } = await mailClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: portalUrl,
      },
    });
    if (signInEmailError) {
      console.error('invite-member: existing member sign-in email failed', signInEmailError);
    }
  } else {
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        role,
        role_label: roleLabels[role],
        scope_name: scopeName,
        invited_by_name: identity.user.user_metadata?.full_name || identity.user.email || 'Klineo',
      },
      redirectTo: portalUrl,
    });
    if (inviteError) return response({ error: inviteError.message }, 502);
  }

  await adminClient.from('audit_events').insert({
    project_id: projectId,
    actor_id: identity.user.id,
    actor_name: identity.user.user_metadata?.full_name || identity.user.email || 'Klineo',
    action: existing ? 'invitation.membership_added' : 'invitation.sent',
    entity_type: 'invitation',
    entity_id: invitation.id,
    detail: `Invited ${email} as ${role}.`,
    metadata: { role, organizationId, existingUser: Boolean(existing) },
  });

  return response({
    ok: true,
    invitationId: invitation.id,
    status: existing ? 'membership_added' : 'email_sent',
  });
});
