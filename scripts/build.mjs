// Build every layer the manifest declares into one self-contained ES module
// (no runtime dependencies, nothing compiled by Vitrine), then write
// dist/vitrine-plugin.json with a sha256 integrity digest per entry file.
//
//   node scripts/build.mjs [--out <dir>]
//
// Output: dist/vitrine-plugin.json + one .js file per declared entry. Ship
// exactly those files (as release assets, or under .vitrine/plugins/<slug>/).

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFlag = process.argv.indexOf('--out');
const outDir = outFlag > 0 ? resolve(process.argv[outFlag + 1]) : join(root, 'dist');

/** Source file, esbuild platform, and externals per layer. */
const LAYERS = {
  server: { src: 'src/server.ts', platform: 'node', target: 'node20', external: [] },
  frontend: { src: 'src/frontend.ts', platform: 'browser', target: 'es2022', external: [] },
  electron: { src: 'src/electron.ts', platform: 'node', target: 'node20', external: ['electron'] },
};

const manifest = JSON.parse(readFileSync(join(root, 'vitrine-plugin.json'), 'utf8'));
if (!manifest.entries || Object.keys(manifest.entries).length === 0) {
  throw new Error('vitrine-plugin.json must declare at least one entry');
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const integrity = {};
for (const [layer, file] of Object.entries(manifest.entries)) {
  const spec = LAYERS[layer];
  if (!spec) throw new Error(`Unknown entry layer "${layer}" (server, frontend, electron)`);
  const outfile = join(outDir, file);
  await build({
    entryPoints: [join(root, spec.src)],
    outfile,
    bundle: true,
    format: 'esm',
    platform: spec.platform,
    target: spec.target,
    external: spec.external,
    legalComments: 'none',
    logLevel: 'warning',
  });
  integrity[file] = `sha256-${createHash('sha256').update(readFileSync(outfile)).digest('base64')}`;
}

writeFileSync(
  join(outDir, 'vitrine-plugin.json'),
  `${JSON.stringify({ ...manifest, integrity }, null, 2)}\n`,
);
console.log(`Built ${manifest.slug}@${manifest.version} into ${outDir}`);
