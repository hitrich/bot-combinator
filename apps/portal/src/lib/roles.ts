import type { ManagedPortalRole, PortalRole } from './types';

export interface RoleDefinition {
  role: ManagedPortalRole;
  label: string;
  group: 'Project' | 'Klineo' | 'BOT Chain';
  useFor: string;
  limit: string;
  scope: string;
}

export const MANAGED_ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'project_lead',
    label: 'Project lead',
    group: 'Project',
    useFor: 'The accountable person for one project.',
    limit: 'Can request BOT Chain or public sharing, but cannot approve it.',
    scope: 'One project',
  },
  {
    role: 'project_member',
    label: 'Project member',
    group: 'Project',
    useFor: 'A teammate working on that project.',
    limit: 'Cannot request broader sharing.',
    scope: 'One project',
  },
  {
    role: 'klineo_operator',
    label: 'Klineo operator',
    group: 'Klineo',
    useFor: 'Klineo staff running the program.',
    limit: 'Has operational, cross-project control over projects, stages, cohorts, and invites.',
    scope: 'All projects',
  },
  {
    role: 'klineo_reviewer',
    label: 'Klineo reviewer',
    group: 'Klineo',
    useFor: 'Klineo staff evaluating evidence and reviews.',
    limit: 'Does not run the operational setup.',
    scope: 'Review workspace',
  },
  {
    role: 'bot_chain_reviewer',
    label: 'BOT Chain reviewer',
    group: 'BOT Chain',
    useFor: 'A BOT Chain partner who should give feedback.',
    limit: 'Can only see explicitly BOT Chain-approved material and comment or review it.',
    scope: 'Approved material',
  },
  {
    role: 'bot_chain_viewer',
    label: 'BOT Chain viewer',
    group: 'BOT Chain',
    useFor: 'A BOT Chain stakeholder who only needs visibility.',
    limit: 'Read-only; sees only BOT Chain-approved or public material.',
    scope: 'Approved material',
  },
];

export const MANAGED_ROLES = MANAGED_ROLE_DEFINITIONS.map((item) => item.role);

export function roleDefinition(role: ManagedPortalRole): RoleDefinition {
  return MANAGED_ROLE_DEFINITIONS.find((item) => item.role === role)!;
}

export function roleLabel(role: PortalRole): string {
  return role === 'klineo_admin' ? 'Workspace admin' : roleDefinition(role).label;
}

export function roleGroup(role: PortalRole): RoleDefinition['group'] | 'Administration' {
  return role === 'klineo_admin' ? 'Administration' : roleDefinition(role).group;
}

export function isProjectAccessRole(role: PortalRole): boolean {
  return role === 'project_lead' || role === 'project_member';
}
