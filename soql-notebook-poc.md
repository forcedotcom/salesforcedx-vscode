# SOQL notebook POC — remaining phases

AI-consumed brief. Phase 1 done. User paused; do not start Phase 2 until they say go. Then execute this file.

## Status

- Phase 1 Investigate: done
- Phase 2 Execute: not started
- Phase 3 Review: not started
- W-number: none — experiment
- Branch: none yet (feature-branch on start)

## Intent

New unpublished VS Code extension: many SOQL queries in one notebook.

Done when:

- `salesforcedx-vscode-soql-notebook` exists
- user creates/opens `*.soqlnb`
- add many SOQL + Markdown cells
- run each SOQL cell vs default org
- records/errors inline as native notebook output
- Jest + compile + lint pass
- F5 Launch Extensions loads it
- existing SOQL ext (`.soql` / builder) unchanged
- not in Extension Packs, `vscode:package:modern`, or nightly discovery

## Locked decisions (do not re-ask)

| Decision | Value |
|---|---|
| Scope | full run-cells POC |
| Placement | new package, not SOQL ext |
| File / type | `*.soqlnb` / `salesforce-soql-notebook` |
| Cell langs | `soql`, `markdown` |
| API | REST `connection.query` only |
| Outputs | transient; native JSON + error |
| Row limit | own setting `salesforcedx-vscode-soql-notebook.maxQueryLimit`, default 50000 |
| ALL ROWS | strip clause, `scanAll: true` |
| Result shape | `{ totalSize, done, records }`; recurse-strip `attributes`; no flatten copy |
| Serializer | versioned JSON; throw on malformed / unknown version |
| Controller | `NotebookCellExecution` start/replace/`end` every path; cancel = stop applying output |
| Target | desktop F5 only — no `browser` / web bundle |
| Publish | omit `categories`; no package/publish scripts |
| Tracking | no W-number |

## Out of scope

- change `packages/salesforcedx-vscode-soql/**`
- Tabulator / custom renderer / SOQL Builder form cells
- query plan, Tooling picker, persist outputs
- cell LSP / completions
- web/`browser` bundle
- Extension Packs, nightly, SHA256, E2E CI, Playwright
- `vscode:package` / `vscode:publish` / prerelease

## Skills to load on Phase 2 start

- `ralph` — prompt: `Continue the Closed Inner Loop: work one task at a time, keep tasks updated, finish verification, run Phase 3 review, and complete every task before stopping.`
- `feature-branch` — experiment name, no W-id
- `packageJson`
- `wireit`
- `services-extension-consumption`
- `i18n-messages`
- `typescript`
- `test-driven-development`
- `verification`
- `subagent-driven-development`
- later: `systematic-debugging` on break; Phase 3: `requesting-code-review`

## Conventions (retrieved)

- npm workspaces `packages/*`; root Wireit lists packages explicitly
- template shape: `salesforcedx-vscode-apex-log` (not SOQL)
- name `salesforcedx-vscode-*`; `private: true`; do **not** copy Apex Log `categories` / package / publish / Playwright / `browser`
- nightly publish iff `engines.vscode` + `publisher` + nonempty `categories` + `salesforcedx-vscode*` name (`scripts/list-vscode-extensions.js`)
- `extensionDependencies`: `salesforce.salesforcedx-vscode-services`
- workspace dep `@salesforce/effect-ext-utils`, `@salesforce/vscode-i18n`, `@salesforce/vscode-services`, `effect`; **devDep** `salesforcedx-vscode-services` — no runtime dep on that package
- `buildAllServicesLayer(context, nls.localize('channel_name'))` + `getRuntime().runPromise` — never `Effect.provide` at call sites
- `ConnectionService.getConnection()` (no username) = default org
- do **not** import SOQL `executeDataQuery` / `runSoqlQuery` (CSV + channel + notifications)
- contributes strings = `%key%` in `package.nls.json`
- runtime strings = `src/messages/i18n.ts`
- Jest: `test/jest/<name>.test.ts`, extend `config/jest.base.config.js`
- compile: `tsc --pretty`; tsconfig extends `../../tsconfig.common.json`
- modern esbuild node bundle only (`dist/index.js`); `main`: `./dist/index.js`
- `preinstall`: `node ../../scripts/require-root-install.js`
- no comments in source unless asked

## Files

### Create

```
packages/salesforcedx-vscode-soql-notebook/package.json
packages/salesforcedx-vscode-soql-notebook/package.nls.json
packages/salesforcedx-vscode-soql-notebook/.vscodeignore
packages/salesforcedx-vscode-soql-notebook/LICENSE.txt
packages/salesforcedx-vscode-soql-notebook/tsconfig.json
packages/salesforcedx-vscode-soql-notebook/test/tsconfig.json
packages/salesforcedx-vscode-soql-notebook/jest.config.js
packages/salesforcedx-vscode-soql-notebook/esbuild.config.mjs
packages/salesforcedx-vscode-soql-notebook/src/index.ts
packages/salesforcedx-vscode-soql-notebook/src/notebookSerializer.ts
packages/salesforcedx-vscode-soql-notebook/src/notebookController.ts
packages/salesforcedx-vscode-soql-notebook/src/queryResultOutput.ts
packages/salesforcedx-vscode-soql-notebook/src/queryRunner.ts
packages/salesforcedx-vscode-soql-notebook/src/commands/createSoqlNotebook.ts
packages/salesforcedx-vscode-soql-notebook/src/services/extensionProvider.ts
packages/salesforcedx-vscode-soql-notebook/src/services/runtime.ts
packages/salesforcedx-vscode-soql-notebook/src/messages/index.ts
packages/salesforcedx-vscode-soql-notebook/src/messages/i18n.ts
packages/salesforcedx-vscode-soql-notebook/test/jest/notebookSerializer.test.ts
packages/salesforcedx-vscode-soql-notebook/test/jest/queryResultOutput.test.ts
packages/salesforcedx-vscode-soql-notebook/test/jest/notebookController.test.ts
packages/salesforcedx-vscode-soql-notebook/test/jest/queryRunner.test.ts
```

README / CHANGELOG / icon: skip (not packaging).

### Change

- root `package.json` — add to `compile`, `lint`, `test`, `vscode:bundle` only
- `package-lock.json` — root `npm install`
- `.vscode/launch.json` — `--extensionDevelopmentPath` + `outFiles` on Launch Extensions (and matching all-extension configs)

### Do not change

- `packages/salesforcedx-vscode-soql/**`
- `packages/salesforcedx-vscode/package.json` (pack)
- `packages/salesforcedx-vscode-expanded/package.json`
- root `vscode:package:modern` / prerelease
- `.github/workflows/nightly.yml`
- SHA256 / e2e workflow lists

## Serializer contract

Disk JSON:

```json
{
  "version": 1,
  "cells": [
    { "kind": "markup", "language": "markdown", "value": "..." },
    { "kind": "code", "language": "soql", "value": "SELECT Id FROM Account LIMIT 10" }
  ]
}
```

- UTF-8
- kinds: `markup` | `code` only
- code cells persist `language: soql`; markup `markdown`
- do not persist outputs / execution order
- empty file / empty cells array → empty notebook (ok)
- invalid JSON / missing version / version !== 1 / unknown kind → throw
- `registerNotebookSerializer(type, serializer, { transientOutputs: true })`

## Controller contract

- `createNotebookController(id, 'salesforce-soql-notebook', label)`
- `supportedLanguages = ['soql']`
- per requested cell:
  1. `createNotebookCellExecution`
  2. `start`
  3. empty / whitespace SOQL → error output, `end(false)`
  4. markdown cells: skip
  5. `getConnection()` then REST query
  6. success → `NotebookCellOutputItem.json(payload)` + optional markdown status (`N records`)
  7. fail → `NotebookCellOutputItem.error`
  8. `end(success)` on every path (try/finally)
- cancel: do not `replaceOutput` after cancel; `end(false)`
- no org at create time — fail at run as cell error
- no CSV, no output-channel table, no `showInformationMessage` success toast

## Query contract

```
text = cell document
strip leading comments if cheap (match SOQL queryRunner header-comment strip if copy is small; else skip)
if ALL ROWS present: remove it, scanAll = true
connection.query(soql, { autoFetch: true, maxFetch, scanAll })
payload = { totalSize, done, records: stripAttributes(records) }
```

`stripAttributes`: recurse objects/arrays; omit key `attributes`. Keep nested relationship objects and subquery `{ totalSize, done, records }`.

`maxFetch` from own setting; default 50000.

## Create command

- id: `salesforcedx-vscode-soql-notebook.create`
- title: `%soql_notebook_create%`
- optional `file/newFile` menu
- untitled `NotebookData`:
  1. markup cell — i18n hint (run cells vs default org)
  2. empty `soql` code cell
- `workspace.openNotebookDocument(type, data)` + `window.showNotebookDocument`

## Phase 2 — execute

Load `ralph` with Closed Inner Loop prompt. Task-first. TDD. No user questions. No session comments unless blocked. No silent scope expansion.

Use `innerloop-implementer` per Implement task (filled template = brief).

### Feature branch (first)

- load `feature-branch` + `gus-cli` runner identity
- no W-number → `<ownerPrefix>/soql-notebook-poc` off `origin/develop --no-track`
- do not push unless asked

### [Phase 2 Implement] Scaffold package + repo wiring

- Files: package.json, nls, tsconfig, jest, esbuild, LICENSE, .vscodeignore, empty `src/index.ts` activate/deactivate stubs, messages, services stubs, root package.json, launch.json, lockfile
- Read first: `packages/salesforcedx-vscode-apex-log/{package.json,esbuild.config.mjs,tsconfig.json,jest.config.js,src/index.ts,src/services/*,src/messages/*}`
- Test first: `test/jest/notebookSerializer.test.ts` can wait for next task; this task: `npm run compile -w salesforcedx-vscode-soql-notebook` after stub
- Manifest must: no `categories`; no package/publish scripts; `activationEvents` via notebooks contribution (plus create command); `contributes.notebooks` type `salesforce-soql-notebook` selector `*.soqlnb`; setting `maxQueryLimit`
- Acceptance: package compile; listed in root compile/lint/test/vscode:bundle
- Out of scope: serializer/controller logic

### [Phase 2 Implement] Serializer + create command

- Test first: `test/jest/notebookSerializer.test.ts`
  - round-trip code+markup
  - empty notebook
  - unicode/newlines
  - outputs not in serialize
  - invalid JSON throws
  - unknown version throws
  - unknown kind throws
- Then create command (thin; test data construction if extractable)
- Acceptance: `npm test -w salesforcedx-vscode-soql-notebook` serializer file green
- Out of scope: execution

### [Phase 2 Implement] Query mapping + runner

- Test first:
  - `queryResultOutput.test.ts`: empty records, nested parent, subquery, strip `attributes` only, preserve other keys
  - `queryRunner.test.ts`: ALL ROWS → scanAll; maxFetch from setting; empty soql rejected; query error surfaced
- Mock `ConnectionService` / connection.query — do not hit an org
- Acceptance: those jest files green
- Out of scope: VS Code controller wiring

### [Phase 2 Implement] Notebook controller

- Test first: `notebookController.test.ts`
  - empty cell → error + end(false)
  - success → json output + end(true)
  - connection reject → error + end(false)
  - cancel before replace → no output apply + end(false)
  - `end` exactly once (success and fail)
- Acceptance: controller jest green
- Out of scope: custom renderer

### [Phase 2 Verify] compile lint test

```
npm run compile -w salesforcedx-vscode-soql-notebook
npm run lint -w salesforcedx-vscode-soql-notebook
npm test -w salesforcedx-vscode-soql-notebook
```

Expected: all pass. On fail → `[Phase 2 Fix]` + systematic-debugging. Do not mark verify complete on claims.

Attach real stdout.

Manual evidence (if desktop available): F5 → command Create SOQL Notebook → add 2 SOQL cells → run vs default org → save `.soqlnb` → reopen. If no org/F5, note gap; jest still required.

## Phase 3 — review

After Phase 2 verify green. Re-expand. Independent reviewers. One verdict.

Dispatch **in parallel**:

- `innerloop-code-reviewer` — bugs, over-engineering, apex-log idioms
- `innerloop-security-reviewer` — org data in cell output, no secret log, query text only from cell, nightly leak (`categories`)
- `innerloop-domain-reviewer` — ConnectionService usage, ALL ROWS/scanAll, governor/maxFetch, SOQL ext isolation

Then:

- aggregate one verdict: PASS | PASS WITH COMMENTS | CHANGES REQUIRED
- one comment pass: 1–3 items, max 5 (`:::comment`)
- re-run verify; attach output
- mark all tasks complete

Do not publish, PR, or commit unless user asks.

## Evidence target

- jest named cases (serializer + runner + controller)
- compile / lint / test stdout
- mermaid of actual delivered flow (Phase 3)
- optional F5 notes
- confirm `git diff --name-only` ⊆ planned files

## Uncertainty already recorded (do not re-litigate in Phase 2)

Session comments from Phase 1:

1. nightly isolation = omit `categories` (fragile)
2. `soql` highlighting needs existing SOQL ext (ok on F5 Launch Extensions)
3. no relationship flatten in v1

## Stop / escalate

Pause and tell user if:

- need to touch SOQL ext or packs
- compile requires `categories` / package scripts / web bundle
- ConnectionService cannot be used without copying SOQL commands
- nightly would pick up the package

Do not quietly change locked decisions.

## Phase 2 start checklist

1. User said start Phase 2
2. Load `ralph` with exact Closed Inner Loop prompt
3. Feature branch
4. Work tasks in order above
5. Phase 3 reviewers
6. Stop only when ledger complete
