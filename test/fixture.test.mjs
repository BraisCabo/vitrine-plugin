// Fixture test: the built plugin is valid and loadable. Run after a build
// (`npm test` builds first). Uses only node:test, no extra dependencies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dist = process.env.PLUGIN_DIST
  ? resolve(process.env.PLUGIN_DIST)
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const manifest = JSON.parse(readFileSync(join(dist, 'vitrine-plugin.json'), 'utf8'));

test('manifest has the required fields', () => {
  assert.match(manifest.slug, /^[a-z][a-z0-9-]{0,62}$/);
  assert.equal(typeof manifest.name, 'string');
  assert.equal(typeof manifest.description, 'string');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.apiVersion, 1);
  assert.ok(Object.keys(manifest.entries).length > 0);
  if (manifest.entries.electron) assert.equal(manifest.scope, 'global');
});

test('every entry matches its integrity digest', () => {
  for (const file of Object.values(manifest.entries)) {
    const digest = `sha256-${createHash('sha256')
      .update(readFileSync(join(dist, file)))
      .digest('base64')}`;
    assert.equal(manifest.integrity[file], digest, file);
  }
});

test('every entry default-exports a v1 module with function hooks', async () => {
  for (const [layer, file] of Object.entries(manifest.entries)) {
    const mod = (await import(pathToFileURL(join(dist, file)).href)).default;
    assert.equal(typeof mod, 'object', `${layer}: default export`);
    assert.equal(mod.apiVersion, manifest.apiVersion, `${layer}: apiVersion`);
    for (const [key, value] of Object.entries(mod)) {
      if (['apiVersion', 'features', 'cardGlyph', 'background'].includes(key)) continue;
      assert.equal(typeof value, 'function', `${layer}.${key} must be a function`);
    }
  }
});

const BLOCK =
  'USER HARD RULES (override Vitrine templates, apply to every role): 1. Replies, stage reports, gate questions and PR text: 3 lines or fewer, answer first, no headers, tables or caveat lists. 2. Never commit or push unless I explicitly ask. 3. Create branches and worktrees from origin/<default-branch> after git fetch, never the local HEAD; verify base and name right after creation. 4. Branch name: brais.cabofelpete/<TICKET>-<desc>; put the Jira ticket ID in from the start, never rename. 5. Everything else: follow ~/.claude/CLAUDE.md.';

async function hookWithHome(setup) {
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const home = mkdtempSync(join(tmpdir(), 'brais-rules-'));
  mkdirSync(join(home, '.claude'));
  setup(home);
  const mod = (await import(pathToFileURL(join(dist, 'server.js')).href)).default;
  const prev = process.env.HOME;
  process.env.HOME = home;
  try {
    return ['worker', 'shepherd', 'reviewer'].map((role) => mod.systemPromptFragmentAfter({ role }));
  } finally {
    process.env.HOME = prev;
  }
}

test('no CLAUDE.md: every role gets exactly the block', async () => {
  for (const out of await hookWithHome(() => {})) assert.equal(out, BLOCK);
});

test('CLAUDE.md is appended after the block', async () => {
  const { writeFileSync } = await import('node:fs');
  const outs = await hookWithHome((h) => writeFileSync(join(h, '.claude', 'CLAUDE.md'), 'MY RULES\n'));
  for (const out of outs) {
    assert.ok(out.startsWith(`${BLOCK}\n`));
    assert.ok(out.endsWith('MY RULES\n'));
  }
});

test('read throws (CLAUDE.md is a directory): falls back to exactly the block', async () => {
  const { mkdirSync } = await import('node:fs');
  const outs = await hookWithHome((h) => mkdirSync(join(h, '.claude', 'CLAUDE.md')));
  for (const out of outs) assert.equal(out, BLOCK);
});
