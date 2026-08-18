import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();

if (!accessToken || !projectRef) {
  throw new Error(
    'Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF before deploying Auth email templates.',
  );
}

const portalDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDirectory = path.join(portalDirectory, 'supabase', 'templates');
const [inviteContent, magicLinkContent] = await Promise.all([
  readFile(path.join(templateDirectory, 'invite.html'), 'utf8'),
  readFile(path.join(templateDirectory, 'magic_link.html'), 'utf8'),
]);

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mailer_subjects_invite: "You're invited to Bot Combinator",
    mailer_templates_invite_content: inviteContent,
    mailer_subjects_magic_link: 'Your secure Bot Combinator sign-in link',
    mailer_templates_magic_link_content: magicLinkContent,
  }),
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`Supabase rejected the email template update (${response.status}): ${detail}`);
}

console.log(`Updated invitation and magic-link templates for ${projectRef}.`);
