import type { PortalRole, Visibility } from './types';

const visibilityRank: Record<Visibility, number> = {
  project_private: 0,
  project_and_klineo: 1,
  bot_chain: 2,
  public: 3,
};

export const visibilityLabels: Record<Visibility, string> = {
  project_private: 'Project only',
  project_and_klineo: 'Project + Klineo',
  bot_chain: 'BOT Chain approved',
  public: 'Public showcase',
};

export function canRoleSee(role: PortalRole, visibility: Visibility): boolean {
  if (visibility === 'public') return true;
  if (role === 'project_lead' || role === 'project_member') return true;
  if (role.startsWith('klineo_')) return visibility !== 'project_private';
  return visibility === 'bot_chain';
}

export function isVisibilityEscalation(from: Visibility, to: Visibility): boolean {
  return visibilityRank[to] > visibilityRank[from];
}

export function visibilityNeedsApproval(to: Visibility): boolean {
  return to === 'bot_chain' || to === 'public';
}

export function isProjectRole(role: PortalRole): boolean {
  return role === 'project_lead' || role === 'project_member';
}

export function isKlineoRole(role: PortalRole): boolean {
  return role.startsWith('klineo_');
}

export function isKlineoOperatorRole(role: PortalRole): boolean {
  return role === 'klineo_admin' || role === 'klineo_operator';
}

export function isBotChainRole(role: PortalRole): boolean {
  return role.startsWith('bot_chain_');
}
