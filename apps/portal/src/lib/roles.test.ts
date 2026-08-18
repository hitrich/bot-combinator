import { describe, expect, it } from 'vitest';
import { MANAGED_ROLE_DEFINITIONS, MANAGED_ROLES, roleDefinition } from './roles';

describe('portal role catalog', () => {
  it('exposes exactly the six staff roles managed by the access dashboard', () => {
    expect(MANAGED_ROLES).toEqual([
      'project_lead',
      'project_member',
      'klineo_operator',
      'klineo_reviewer',
      'bot_chain_reviewer',
      'bot_chain_viewer',
    ]);
    expect(new Set(MANAGED_ROLES).size).toBe(MANAGED_ROLE_DEFINITIONS.length);
  });

  it('keeps project roles project-scoped and BOT Chain viewer access read-only', () => {
    expect(roleDefinition('project_lead').scope).toBe('One project');
    expect(roleDefinition('project_member').scope).toBe('One project');
    expect(roleDefinition('bot_chain_viewer').limit.toLowerCase()).toContain('read-only');
  });
});
