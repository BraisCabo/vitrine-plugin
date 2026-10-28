# My Plugin (Vitrine external plugin)

A Vitrine plugin built against the public plugin API v1
(`vitrine-plugin-api.d.ts`). Vitrine loads the built files at launch; it never
compiles or installs anything itself.

## Layout

| Path | What it is |
|------|------------|
| `vitrine-plugin.json` | Manifest: slug, name, description, version, `apiVersion`, optional `engines.vitrine` range, `scope`, config controls, and `entries` |
| `vitrine-plugin-api.d.ts` | The plugin API types (do not edit; copy a newer one from Vitrine when targeting a newer API) |
| `src/server.ts` | Server layer (prompt fragments, task-agent tools, HTTP routes) |
| `src/frontend.ts` | UI layer (Dev Shortcuts, task actions and links, card controls) |
| `src/electron.ts` | Electron layer, global plugins only (background companion, actions, assets) |
| `scripts/build.mjs` | Bundles each declared layer into one file and writes `dist/vitrine-plugin.json` with integrity digests |
| `test/fixture.test.mjs` | Checks the built manifest, digests, and module shapes |
| `.github/workflows/release.yml` | Attaches `dist/*` to the release for a `v<version>` tag |

Delete the layers you don't need, and their `entries` keys. A `project`-scoped
plugin cannot ship an Electron entry.

## Develop

```sh
npm install
npm run typecheck
npm test            # builds into dist/ and runs the fixture test
```

In Vitrine: App Settings → Plugins → Add plugin → Local directory, pick this
folder, then relaunch Vitrine. After each change, `npm run build` and relaunch.

## Ship

- **GitHub release** (only for repositories on Vitrine's GitHub allowlist,
  which ships empty, so this needs the repository added in a Vitrine release):
  bump `version` in `vitrine-plugin.json`, push a `v<version>` tag; the release
  workflow attaches the built files. Users install with the repository URL.
- **Project repo**: commit the contents of `dist/` under
  `.vitrine/plugins/<slug>/` of the target repository. The plugin then
  activates for that project only (use `"scope": "project"`).
