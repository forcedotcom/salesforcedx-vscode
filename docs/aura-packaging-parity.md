# Aura native Node packaging — W-24774422

## Implementation

- #8581 already converted `scripts/vsce-bundled-extension.ts` to `scripts/vsceBundledExtension.mts`: Node built-in imports, `readFileSync`/`JSON.parse` instead of `require`, erasable types. Both Aura packaging commands already invoke `node`.
- #8589 completed WI 1 (W-24774419). The root runner declarations were already removed.
- This change adds the native entry point and unbundled packaging assets to both Wireit input lists. `vscode:bundle` supplies `dist` and `tern`. Packaging remains uncached because stable and prerelease overwrite the same VSIX filename.
- Regenerate the lockfile without a runner-specific override. Repository Jest configs are JavaScript; Jest's optional runner peer remains uninstalled. The lock removes the runner and 12 otherwise-unused packages; no package versions change.
- No tracked executable/configuration references `ts-node` outside the lockfile. The lockfile retains only upstream optional-peer metadata, not an installed runner. Historical documentation is not an executable dependency.

## Controlled comparison

Run on macOS arm64, Node **24.20.0**, pnpm **12.14.0**, VSCE **3.5.0**. Source: `d27f29877260364122e84b7ec508dd4c96a87bc8`, plus this change's Aura Wireit inputs. Extension version: **68.13.0**.

The baseline is the **unmodified** legacy script from `8b70427360c24dc0d5f711411fd5d12ca3d746cb` (`4566c0da14^`), not an older extension bundle. Execute it with installed **ts-node 10.9.2**, `--project scripts/tsconfig.json`, and the current Aura package directory as cwd. Candidate: the native script through the root stable/prerelease Wireit commands.

Both runners use the same current manifest, compiled bundles, assets, Node executable, VSCE, and temporary build directory. Build the bundle once before the comparison. Baseline first, then candidate, separately for stable and prerelease. The legacy script's `npm install` reuses the same staging lock; assert that lock's SHA-256 does not change. No `node_modules` directories are copied or linked between checkouts.

Hashes before dependency cleanup:

| Input | SHA-256 |
| --- | --- |
| Root `pnpm-lock.yaml` | `864dd0a0d03adb55280a8aef89d819706bb19f208bc390b0dffa6693f25bd43f` |
| Historical script | `1088a46ff3b211b8628c4903a1f23bf4890d4302dd44359d92893586f2a6fae1` |
| Native script | `0ff0baa94ecb18e1ab54f429ce01b269d0048b37528b7d5ae6748f172e3dc91f` |
| Aura `package.json` | `3ce54ff4fe38fe6f0631796914bdd93cdd93c0fd223130c7c50e05b0a6aa81a5` |
| Staging `package-lock.json`, both channels | `24f71fc35bcda8fc4505170006f920bb135de3f2428c266b2e53b56e43cd3c43` |

## Parity results

| Comparison | Stable | Prerelease |
| --- | --- | --- |
| Archive entry set, no duplicate paths | 691 identical entries | 691 identical entries |
| Every extracted file's bytes | Identical | Identical |
| `extension/package.json`, VSIX manifest, content types | Byte-identical | Byte-identical |
| ZIP timestamps differing | 133 entries | 133 entries |
| ZIP entry order | Different | Different |
| Other compared ZIP entry attributes | Identical | Identical |

Metadata assertions: `main` is `dist/index.js`; no `packaging` property; empty `devDependencies`. `Microsoft.VisualStudio.Code.PreRelease` is absent for stable and `true` for prerelease.

Expected nondeterminism: copied assets get fresh filesystem timestamps; generated ZIP entries get build timestamps. VSCE does not sort entries or fix timestamps unless `SOURCE_DATE_EPOCH` is set. Entry order and timestamps therefore change archive hashes and offsets without changing installed files. No file-content differences were normalized or ignored.

Comparison extracts both ZIPs, checks identical unique entry sets, compares every file byte-for-byte, records per-file SHA-256, and compares ZIP compression method/size, CRC, sizes, permissions, flags, extra fields, comments, and format versions. Only timestamps and entry ordering are allowed to differ.

Local evidence: `.e2e-artifacts/W-24774422/` (gitignored): `buildParity.mjs`, historical script, four VSIXs, staging locks, extracted trees, `builds.json`, `compareVsix.py`, `parity.json`, and `packaging.log`. Run the comparison with:

```sh
python3 .e2e-artifacts/W-24774422/compareVsix.py
```

## Verification

- `pnpm install --frozen-lockfile`: passed after cleanup.
- `pnpm why --recursive ts-node`: no dependencies.
- `git grep -n ts-node -- ':!pnpm-lock.yaml' ':!*.md'`: no executable/configuration references, including workspace configuration.
- `node --check scripts/vsceBundledExtension.mts`: passed.
- `pnpm check:scripts`: passed.
- `pnpm test:scripts`: 74 tests passed across 7 files.
- ESLint on root and Aura package manifests; Prettier on changed manifests/documentation: passed.
- `pnpm lint`: passed repository-wide (98 Wireit tasks).
- `pnpm check:dupes`: fails the repository's zero-duplication threshold (147 clones, 1.59%). All 126 reported source files match `HEAD` byte-for-byte; none are changed here.

- `pnpm --filter salesforcedx-vscode-lightning test`: 5 tests passed.

## Installation and smoke tests

After dependency cleanup, rebuilt both channels and compared them again to their original baselines: **691 entries, zero file-content differences** in each. Root lock SHA-256 for those runs, before removing the exclusion override: `610ea548d660c40d1b85c84c2fcc21f730501932dbc91693e75eb5b1b080a568`.

Installed each candidate through the desktop fixture's real VS Code CLI VSIX installer, alongside local Services/Core VSIXs, into separate hash-keyed extension directories. Installation provenance matches these candidate archive hashes:

| Archive | SHA-256 |
| --- | --- |
| Stable baseline | `da75c9a3370311f5640ea93275a7825ba5063a1f76e3c688d3316fc474b27e4d` |
| Stable installed candidate | `bf77a142abbc3c44429ed722d6d757fb4fab1a92ec664c4ee916f92ff7e1305d` |
| Prerelease baseline | `508e54686212726a98d113d4f52caf3b2254b07685b38ef1c1e0140afe67a3f4` |
| Prerelease installed candidate | `331ba8faffe85db2cf472c68b06b93e37d33945a80a1e4720712252b79b357d4` |

VS Code **1.146.0**, macOS arm64, no authenticated org, one worker, zero retries:

| Existing desktop smoke test | Stable | Prerelease |
| --- | --- | --- |
| `auraLspAutocompletion.desktop.spec.ts` | Passed | Passed |
| `auraLspGoToDefinition.desktop.spec.ts` | Passed | Passed |

These exercise extension activation, bundled language-server startup/indexing, completion insertion, and attribute-definition navigation from the installed VSIX, not development sources.

Packaging commands exercised: `pnpm vscode:package:legacy` and `pnpm vscode:package:legacy:prerelease`. Smoke invocation (repeat with `VSCE_PRE_RELEASE=true` for prerelease):

```sh
E2E_FROM_VSIX=1 VSCE_PRE_RELEASE=false PLAYWRIGHT_WORKERS=1 \
  VSCODE_EXTENSION_BUILD_LOCATION="$PWD/.e2e-artifacts/W-24774422/build" \
  pnpm --filter salesforcedx-vscode-lightning test:desktop -- --retries 0 --workers 1 \
  test/playwright/specs/auraLspAutocompletion.desktop.spec.ts \
  test/playwright/specs/auraLspGoToDefinition.desktop.spec.ts
```

Additional local evidence: `candidate-after-cleanup-{stable,prerelease}.vsix`, `installed-candidates.json`, `smoke-{stable,prerelease}.log`, installation provenance JSONs, and copied Playwright reports/results/screenshots/videos under `.e2e-artifacts/W-24774422/`.
