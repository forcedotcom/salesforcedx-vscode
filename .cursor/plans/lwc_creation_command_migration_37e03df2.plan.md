---
name: LWC creation command migration
overview: Move the LWC creation command from salesforcedx-vscode-core (old SfCommandlet/gatherers/executors pattern) to salesforcedx-vscode-metadata (new Effect-based pattern using TemplateService from the services extension). Includes i18n migration, package.json wiring, e2e test, and cleanup of the old command. W-21481349.
todos:
  - id: create-lwc-command
    content: Create `createLwc.ts` in metadata extension's commands dir using Effect + TemplateService.create pattern
    status: completed
  - id: register-command
    content: Register `sf.metadata.lightning.generate.lwc` in metadata extension index.ts
    status: completed
  - id: package-json-metadata
    content: Add command, menus (explorer/context, commandPalette) to metadata package.json
    status: completed
  - id: i18n-metadata
    content: Add NLS keys to metadata package.nls.json and i18n.ts
    status: completed
  - id: cleanup-core-command
    content: Remove sf.lightning.generate.lwc from core package.json commands/menus and index.ts registration
    status: completed
  - id: cleanup-core-nls
    content: Remove/audit lightning_generate_lwc_text from core package.nls.json/ja.json (keep if internal command needs it)
    status: completed
  - id: e2e-test
    content: Create lwcGenerateComponent.headless.spec.ts in metadata playwright specs
    status: completed
  - id: verify
    content: 'Run verification: compile, lint, Effect LS diagnostics, test, bundle, knip, check:dupes. Review against effect-best-practices skill.'
    status: completed
isProject: false
---

# LWC Creation Command Migration to Metadata Extension

**W-21481349**

## Context

The existing LWC creation command (`sf.lightning.generate.lwc`) lives in [salesforcedx-vscode-core](packages/salesforcedx-vscode-core/src/commands/templates/lightningGenerateLwc.ts) using the old `SfCommandlet` + `CompositeParametersGatherer` + `LibraryBaseTemplateCommand` pattern. We're re-implementing it in the metadata extension using the Effect-based pattern, mirroring how `createApexClass` works in [salesforcedx-vscode-metadata/src/commands/createApexClass.ts](packages/salesforcedx-vscode-metadata/src/commands/createApexClass.ts) and how the Apex test class uses `TemplateService.create()` from the services extension in [apexGenerateUnitTestClass.ts](packages/salesforcedx-vscode-apex-testing/src/commands/apexGenerateUnitTestClass.ts).

## New command: `sf.metadata.lightning.generate.lwc`

### Inputs to collect

From the old command and `LightningComponentOptions`:

| Input                    | Method                                                                                                         | Values                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Component name           | `showInputBox`                                                                                                 | alphanumeric + underscore, starts with letter |
| TypeScript or JavaScript | `showQuickPick` (only if `salesforcedx-vscode-lwc.preview.typeScriptSupport` is true; otherwise default to JS) |                                               |
| Output directory         | `showQuickPick` from package dirs, each with `/main/default/lwc` appended                                      |                                               |

### TemplateService.create call

```typescript
api.services.TemplateService.create({
  cwd,
  templateType: api.services.TemplateType.LightningComponent,
  outputdir: outputDirUri,
  options: {
    componentname,
    template: isTypeScript ? 'typeScript' : 'default',
    type: 'lwc',
    internal: false
  }
});
```

No `internal` dev support in the new command (the `sf.internal.lightning.generate.lwc` variant is separate and stays in core for now).

### Post-create

- `ChannelService.appendToChannel` success message
- `FsService.showTextDocument` on the created `.js` or `.ts` file (at `outputDir/<componentname>/<componentname>.js|.ts`)

## Files to create/edit

### 1. New command implementation

Create [packages/salesforcedx-vscode-metadata/src/commands/createLwc.ts](packages/salesforcedx-vscode-metadata/src/commands/createLwc.ts) following the pattern in `createApexClass.ts` but using `TemplateService.create()` like the apex-testing command does. Key differences from Apex class:

- Uses `TemplateType.LightningComponent` instead of `TemplateType.ApexClass`
- Adds TypeScript/JavaScript prompt (conditional on `salesforcedx-vscode-lwc.preview.typeScriptSupport` setting)
- Output dir uses `lwc` subdirectory instead of `classes`
- Opens the `.js` or `.ts` file after creation (not `.cls`)
- Pre-creation check: if `outputDir/<componentname>/` directory already exists, prompt overwrite via `showWarningMessage` (distinct from Apex class file-level check — no dedup concern)

### 2. Register command in metadata extension index.ts

Add to [packages/salesforcedx-vscode-metadata/src/index.ts](packages/salesforcedx-vscode-metadata/src/index.ts):

```typescript
registerCommand('sf.metadata.lightning.generate.lwc', (outputDir?: URI) => createLwcCommand(undefined, outputDir));
```

### 3. Package.json updates for metadata extension

In [packages/salesforcedx-vscode-metadata/package.json](packages/salesforcedx-vscode-metadata/package.json):

- Add command: `sf.metadata.lightning.generate.lwc` with title `%lightning_generate_lwc_text%`
- Add explorer/context menu: `when: explorerResourceIsFolder && resourceFilename == lwc && sf:project_opened`
- Add commandPalette entry: `when: sf:project_opened`

### 4. i18n/NLS messages

Add to [packages/salesforcedx-vscode-metadata/package.nls.json](packages/salesforcedx-vscode-metadata/package.nls.json):

```json
"lightning_generate_lwc_text": "SFDX: Create Lightning Web Component"
```

Add to [packages/salesforcedx-vscode-metadata/src/messages/i18n.ts](packages/salesforcedx-vscode-metadata/src/messages/i18n.ts):

- `lwc_component_name_prompt`
- `lwc_component_name_placeholder`
- `lwc_output_dir_prompt`
- `lwc_select_component_type` (TypeScript/JavaScript picker)
- `lwc_generate_success`
- `lwc_already_exists` (overwrite prompt)

### 5. Cleanup old command in core

In [packages/salesforcedx-vscode-core/package.json](packages/salesforcedx-vscode-core/package.json):

- Remove `sf.lightning.generate.lwc` from `contributes.commands`
- Remove its `explorer/context` and `commandPalette` menu entries
- Keep `sf.internal.lightning.generate.lwc` (internal dev variant stays)

In [packages/salesforcedx-vscode-core/src/index.ts](packages/salesforcedx-vscode-core/src/index.ts):

- Remove `vscode.commands.registerCommand('sf.lightning.generate.lwc', lightningGenerateLwc)` registration

Remove from [packages/salesforcedx-vscode-core/package.nls.json](packages/salesforcedx-vscode-core/package.nls.json) and [package.nls.ja.json](packages/salesforcedx-vscode-core/package.nls.ja.json):

- `lightning_generate_lwc_text` (only if no longer used by the internal command; check first -- if the internal command still uses it, keep it)

Message keys in core's `i18n.ts` like `parameter_gatherer_select_lwc_type` can be left since they're used by `SelectLwcComponentType` which the internal command still references.

### 6. E2E test

Create [packages/salesforcedx-vscode-metadata/test/playwright/specs/lwcGenerateComponent.headless.spec.ts](packages/salesforcedx-vscode-metadata/test/playwright/specs/lwcGenerateComponent.headless.spec.ts) following the pattern in [apexGenerateClass.headless.spec.ts](packages/salesforcedx-vscode-metadata/test/playwright/specs/apexGenerateClass.headless.spec.ts):

1. Setup minimal org
2. Execute `sf.metadata.lightning.generate.lwc` via command palette
3. Enter component name
4. Accept default output directory
5. Verify editor opens with `.js` file
6. Verify component folder in explorer

### 7. Verification

Follow the full verification checklist in order:

1. `npm run compile`
2. `npm run lint`
3. `npx effect-language-service diagnostics --file packages/salesforcedx-vscode-metadata/src/commands/createLwc.ts` — fix any reported issues
4. `npm run test`
5. `npm run vscode:bundle`
6. `npm run test:web -w salesforcedx-vscode-metadata -- --retries 0`
7. `npm run test:desktop -w salesforcedx-vscode-metadata -- --retries 0`
8. `npx knip` — remove any dead exports introduced by this change
9. `npm run check:dupes` — verify no duplication flagged in new code

Review new Effect code against the effect-best-practices skill:

- `Effect.fn` with span names for all functions
- No `catchAll` without good reason; use `catchTag`/`catchTags`
- Dependencies yielded from context, not passed as params
- No `console.log`; use `Effect.log`
- No `runSync`/`runPromise` inside service code
