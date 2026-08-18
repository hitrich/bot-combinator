import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();

if (!accessToken || !projectRef) {
  throw new Error(
    'Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF before verifying Auth email templates.',
  );
}

const portalDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDirectory = path.join(portalDirectory, 'supabase', 'templates');
const [inviteContent, magicLinkContent] = await Promise.all([
  readFile(path.join(templateDirectory, 'invite.html'), 'utf8'),
  readFile(path.join(templateDirectory, 'magic_link.html'), 'utf8'),
]);

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

if (!response.ok) {
  const detail = (await response.text()).slice(0, 500);
  throw new Error(`Supabase rejected the email template check (${response.status}): ${detail}`);
}

const config = await response.json();
const expected = {
  mailer_subjects_invite: "You're invited to Bot Combinator",
  mailer_templates_invite_content: inviteContent,
  mailer_subjects_magic_link: 'Your secure Bot Combinator sign-in link',
  mailer_templates_magic_link_content: magicLinkContent,
};
const mismatches = Object.entries(expected)
  .filter(([field, value]) => config[field] !== value)
  .map(([field]) => field);

if (mismatches.length > 0) {
  throw new Error(`Hosted Auth email fields do not match: ${mismatches.join(', ')}`);
}

console.log(`Hosted invitation and magic-link templates match local files for ${projectRef}.`);
