import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const portalDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDirectory = path.join(portalDirectory, 'supabase', 'templates');
const outputDirectory = path.join(portalDirectory, '.tmp', 'email-previews');

const values = {
  '.ConfirmationURL': 'https://bc.klineo.io/#preview-secure-link',
  '.SiteURL': 'https://bc.klineo.io',
  '.Email': 'amira@northstar.example',
  '.Data.full_name': 'Amira Okafor',
  '.Data.invited_by_name': 'Maya Chen',
  '.Data.role_label': 'Project lead',
  '.Data.scope_name': 'Northstar Protocol',
};

function renderTemplate(source) {
  let rendered = source;
  const conditionalWithFallback =
    /{{\s*if\s+(\.Data\.[a-z_]+)\s*}}([\s\S]*?){{\s*else\s*}}([\s\S]*?){{\s*end\s*}}/g;
  const conditional = /{{\s*if\s+(\.Data\.[a-z_]+)\s*}}([\s\S]*?){{\s*end\s*}}/g;
  rendered = rendered.replace(conditionalWithFallback, (_match, key, truthy, fallback) =>
    values[key] ? truthy : fallback,
  );
  rendered = rendered.replace(conditional, (_match, key, truthy) => (values[key] ? truthy : ''));
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replaceAll(`{{ ${key} }}`, value);
  }
  return rendered;
}

await mkdir(outputDirectory, { recursive: true });

for (const templateName of ['invite', 'magic_link']) {
  const sourcePath = path.join(templateDirectory, `${templateName}.html`);
  const outputPath = path.join(outputDirectory, `${templateName}.html`);
  const source = await readFile(sourcePath, 'utf8');
  await writeFile(outputPath, renderTemplate(source), 'utf8');
  console.log(outputPath);
}
