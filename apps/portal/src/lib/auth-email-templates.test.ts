import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

const inviteTemplateUrl = new URL('../../supabase/templates/invite.html', import.meta.url);
const magicLinkTemplateUrl = new URL('../../supabase/templates/magic_link.html', import.meta.url);

function relativeLuminance(hex: string): number {
  const channels = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe('Supabase Auth email templates', () => {
  let invite: string;
  let magicLink: string;

  beforeAll(async () => {
    [invite, magicLink] = await Promise.all([
      readFile(inviteTemplateUrl, 'utf8'),
      readFile(magicLinkTemplateUrl, 'utf8'),
    ]);
  });

  it('keeps the active templates branded and email-client safe', () => {
    for (const template of [invite, magicLink]) {
      expect(template).toContain('<table');
      expect(template).toContain('role="presentation"');
      expect(template).toContain('max-width: 600px');
      expect(template).toContain('{{ .SiteURL }}/apple-touch-icon.png');
      expect(template).toContain('alt="Bot Combinator"');
      expect(template).toContain('@media only screen and (max-width: 620px)');
      expect(template).toContain('@media (prefers-color-scheme: dark)');
      expect(template).toContain('{{ .ConfirmationURL }}');
      expect(template).not.toMatch(/javascript:/i);
      expect(template).not.toMatch(/[—–]/);
    }
  });

  it('uses a high-contrast single accent for the primary action', () => {
    expect(contrastRatio('#12130f', '#d8ff62')).toBeGreaterThan(7);
    expect(invite).toContain('background: #d8ff62');
    expect(magicLink).toContain('background: #d8ff62');
  });

  it('personalizes invitation context without exposing private data', () => {
    expect(invite).toContain('{{ .Data.full_name }}');
    expect(invite).toContain('{{ .Data.role_label }}');
    expect(invite).toContain('{{ .Data.scope_name }}');
    expect(invite).toContain('{{ .Data.invited_by_name }}');
    expect(invite).not.toMatch(/investor|fundraising|credential/i);
  });

  it('makes the passwordless security model explicit', () => {
    expect(magicLink).toContain('{{ .Email }}');
    expect(magicLink).toContain('one-time link');
    expect(magicLink).toContain('No password is stored');
    expect(magicLink).toContain('safely ignore this email');
  });
});
