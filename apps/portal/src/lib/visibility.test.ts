import { describe, expect, it } from 'vitest';
import { canRoleSee, isVisibilityEscalation, visibilityNeedsApproval } from './visibility';

describe('portal visibility rules', () => {
  it('keeps project-private records away from program and partner roles', () => {
    expect(canRoleSee('project_lead', 'project_private')).toBe(true);
    expect(canRoleSee('klineo_admin', 'project_private')).toBe(false);
    expect(canRoleSee('bot_chain_viewer', 'project_private')).toBe(false);
  });

  it('shows partner records only after BOT Chain or public visibility', () => {
    expect(canRoleSee('bot_chain_reviewer', 'project_and_klineo')).toBe(false);
    expect(canRoleSee('bot_chain_reviewer', 'bot_chain')).toBe(true);
    expect(canRoleSee('bot_chain_viewer', 'public')).toBe(true);
  });

  it('requires an approval transition for partner and public disclosure', () => {
    expect(isVisibilityEscalation('project_and_klineo', 'bot_chain')).toBe(true);
    expect(isVisibilityEscalation('public', 'project_and_klineo')).toBe(false);
    expect(visibilityNeedsApproval('bot_chain')).toBe(true);
    expect(visibilityNeedsApproval('project_and_klineo')).toBe(false);
  });
});
