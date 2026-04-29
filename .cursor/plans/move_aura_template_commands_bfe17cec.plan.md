---
name: Move Aura Template Commands
overview: Rebuild the 4 Aura template commands (App, Component, Event, Interface) using the services-based Effect pattern in the Aura extension (salesforcedx-vscode-lightning), remove them from core, add Playwright desktop tests, and create a CI workflow.
todos:
  - id: services-boilerplate
    content: Add services boilerplate files (allServicesLayerRef, runtime, extensionProvider) + update index.ts with Effect activation alongside existing LSP code
    status: completed
  - id: aura-commands
    content: Create 4 Aura template command files (App, Component, Event, Interface) as Effect.fn, register public + internal commands in index.ts
    status: completed
  - id: aura-pkg-json
    content: Move command contributions from core package.json to Aura package.json (commands, menus, NLS), add dependencies (@salesforce/effect-ext-utils, playwright-vscode-ext)
    status: completed
  - id: remove-core
    content: Remove 4 command files, 8 registrations, contributes entries, and NLS keys from salesforcedx-vscode-core
    status: completed
  - id: messages
    content: Add messages/i18n module to Aura extension for runtime strings (prompts, success, errors)
    status: completed
  - id: playwright-infra
    content: 'Add Playwright test infrastructure: config, fixtures (noOrg desktop), 4 spec files, wireit scripts'
    status: completed
  - id: ci-workflow
    content: Create auraE2E.yml (desktop-only, no-org), register in playwrightE2EFullSuite.yml
    status: completed
  - id: verify
    content: Run compile, lint, test, bundle, knip, check:dupes, local Playwright desktop test
    status: completed
isProject: false
---

# Move Aura Template Commands to Services-Based Aura Extension

## Scope

- 4 commands: App, Component, Event, Interface (no LightningTest)
- Keep same command IDs (`sf.lightning.generate.*`, `sf.internal.lightning.generate.*`) -- remove from core simultaneously
- One PR for everything
- Additive to existing LSP activation code

## 1. Services boilerplate in Aura extension

The Aura extension ([package.json](packages/salesforcedx-vscode-lightning/package.json)) already declares `salesforce.salesforcedx-vscode-services` in `extensionDependencies` but doesn't use it. The current [index.ts](packages/salesforcedx-vscode-lightning/src/index.ts) is a legacy LSP-only activation.

Add three new files following the [apex-log pattern](packages/salesforcedx-vscode-apex-log/src/services/):

- `src/services/allServicesLayerRef.ts` -- module-level mutable `AllServicesLayer` + `setAllServicesLayer`
- `src/services/runtime.ts` -- lazy singleton `ManagedRuntime.make(AllServicesLayer)` + `getRuntime`
- `src/services/extensionProvider.ts` -- `buildAllServicesLayer(context)` with:
  - `ExtensionProviderServiceLive`
  - `Layer.succeedContext(api.services.prebuiltServicesDependencies)`
  - `ChannelServiceLayer(displayName)`, `ErrorHandlerService.Default`, `ExtensionContextServiceLayer(context)`, `SdkLayerFor(context)`

Add dependencies to `package.json`:

- `@salesforce/effect-ext-utils: "*"` (runtime dep)
- `vscode-uri` (already present via transitive, but add explicitly)

Update [index.ts](packages/salesforcedx-vscode-lightning/src/index.ts) `activate`:

- Call `setAllServicesLayer(buildAllServicesLayer(context))` and `getRuntime().runPromise(activateEffect(...))` **before** the existing LSP startup code
- Register the 4 public + 4 internal commands via `registerCommandWithRuntime(getRuntime())`
- Keep all existing LSP activation code after

## 2. Rebuild 4 Aura commands as Effect.fn

Create one file per command in `src/commands/`, following the [createLwc.ts](packages/salesforcedx-vscode-metadata/src/commands/createLwc.ts) and [createApexClass.ts](packages/salesforcedx-vscode-apex-log/src/commands/createApexClass.ts) patterns:

Each command (`createAuraApp.ts`, `createAuraComponent.ts`, `createAuraEvent.ts`, `createAuraInterface.ts`) will:

1. Get `api` from `ExtensionProviderService`
2. Prompt for name via `vscode.window.showInputBox` + `promptService.considerUndefinedAsCancellation`
3. Determine output dir: use `outputDirParam` (from explorer context) or `promptService.promptForOutputDir({ defaultUri: .../aura, folderName: 'aura' })`
4. Call `promptService.ensureMetadataOverwriteOrThrow` (overwrite check)
5. Call `api.services.TemplateService.create({ cwd, templateType: TemplateType.LightningApp/Component/Event/Interface, outputdir, options })` with the appropriate options type
6. Open the main file in editor via `fsService.showTextDocument`

For the **internal** versions: same command, passing `{ internal: true }` in options, with `outputDirParam` as the URI arg (skipping output dir prompt). Pattern matches [sf.internal.lightning.generate.lwc](packages/salesforcedx-vscode-metadata/src/index.ts#L65-L67).

Template options per command:

- **App**: `LightningAppOptions` -- `{ appname, template: 'DefaultLightningApp', internal }`
- **Component**: `LightningComponentOptions` -- `{ componentname, template: 'default', type: 'aura', internal }`
- **Event**: `LightningEventOptions` -- `{ eventname, template: 'DefaultLightningEvt', internal }`
- **Interface**: `LightningInterfaceOptions` -- `{ interfacename, template: 'DefaultLightningIntf', internal }`

**Note on cross-framework duplicate check:** The old `lightningGenerateAuraComponent` had a `LwcAuraDuplicateComponentCheckerForCreate` that checked the sibling `lwc/` folder before creating an Aura component, enforcing the [platform restriction](https://developer.salesforce.com/docs/platform/lwc/guide/create-components-namespace.html) that LWC and Aura components in the same namespace can't share a name. The new implementation drops this check to match the LWC create command behavior (which also doesn't cross-check). Users will discover conflicts at deploy time.

File extensions to open after creation:

- App: `.app`, Component: `.cmp`, Event: `.evt`, Interface: `.intf`

## 3. package.json contributes (Aura extension)

Move command contributions from [core package.json](packages/salesforcedx-vscode-core/package.json) to [Aura package.json](packages/salesforcedx-vscode-lightning/package.json):

- 8 `contributes.commands` entries (4 public + 4 internal, with `%nls%` titles)
- `contributes.menus.commandPalette` entries (public: `"when": "sf:project_opened"`, internal: `"when": "false"`)
- `contributes.menus.explorer/context` entries (public: `"when": "explorerResourceIsFolder && resourceFilename == aura && sf:project_opened"`, internal: `"when": "explorerResourceIsFolder && sf:internal_dev"`)

Add NLS keys to Aura extension's [package.nls.json](packages/salesforcedx-vscode-lightning/package.nls.json):

- `lightning_generate_app_text`, `lightning_generate_aura_component_text`, `lightning_generate_event_text`, `lightning_generate_interface_text`

Add `src/messages/` with i18n for runtime messages (name prompt, output dir prompt, success).

## 4. Remove from core

In `salesforcedx-vscode-core`:

- Remove command registrations from [index.ts](packages/salesforcedx-vscode-core/src/index.ts) (both `lightningGenerate*` and `internalLightningGenerate*`)
- Remove the 4 command source files: `src/commands/templates/lightningGenerate*.ts`
- Remove `contributes.commands`, `contributes.menus.commandPalette`, `contributes.menus.explorer/context` entries for these 8 commands from `package.json`
- Remove corresponding NLS keys from `package.nls.json` if they become orphaned
- Clean up exports from `src/commands/templates/index.ts` and `src/commands/index.ts`

## 5. Playwright tests (desktop-only)

Existing tests already exist at [salesforcedx-vscode-core/test/playwright/specs/auraTemplates.headless.spec.ts](packages/salesforcedx-vscode-core/test/playwright/specs/auraTemplates.headless.spec.ts) covering all 4 commands. Currently run via coreE2E.yml. **Move** (not rewrite) this file to the Aura extension and adapt it:

Create `test/playwright/` in the Aura extension:

- `playwright.config.desktop.ts` -- use `createDesktopConfig({ testDir: './specs' })` from `@salesforce/playwright-vscode-ext`
- `fixtures/index.ts` + `fixtures/desktopFixtures.ts` -- `noOrgDesktopTest` via `createDesktopTest({ fixturesDir: __dirname })` (no `orgAlias` = no org)
- Move `auraTemplates.headless.spec.ts` from core, update:
  - Import `packageNls` from the Aura extension's `package.nls.json` instead of core's
  - Import `test` from the new local fixtures
  - Delete the original file from core

Add to `package.json` wireit scripts:

- `test:desktop` -- `playwright test --config=test/playwright/playwright.config.desktop.ts`
  - dependencies: `vscode:bundle`, `../salesforcedx-vscode-services:vscode:bundle`, `../salesforcedx-vscode-services:spans:server`, `../playwright-vscode-ext:compile`
  - files: `test/playwright/**/*.ts`, `package*.json`
- `test:desktop:debug`, `test:desktop:ui`

Add devDependencies:

- `@salesforce/playwright-vscode-ext: "*"`
- `salesforcedx-vscode-services: "*"`

## 6. CI workflow

Create `.github/workflows/auraE2E.yml` modeled after [snippetsE2E.yml](/.github/workflows/snippetsE2E.yml) (no-org pattern):

- Triggers: `workflow_dispatch`, `workflow_call`, `push` (branches-ignore `[main, develop]`, paths-ignore docs/claude/cursor)
- Concurrency: `ci-${{ github.ref }}-auraE2E`
- Desktop-only job on `[macos-latest, windows-latest, ubuntu-latest]` with `xvfb-run` prefix for ubuntu
- Steps: checkout, setup node, wireit caching, npm install, try-run (cache check), install Playwright, run desktop tests, retry sequential, copy spans, upload artifacts
- No scratch org setup needed

Add to [playwrightE2EFullSuite.yml](/.github/workflows/playwrightE2EFullSuite.yml):

```yaml
aura:
  uses: ./.github/workflows/auraE2E.yml
  secrets: inherit
  with:
    vscode_version: ${{ inputs.vscode_version }}
```

## 7. Verification

- compile, lint, test, vscode:bundle, knip (stop hook)
- `npm run check:dupes`
- Ask user to commit and push
- User pushes; then use playwright-e2e-monitor subagent to watch CI (auraE2E workflow) and confirm all jobs pass across macos/windows/ubuntu
