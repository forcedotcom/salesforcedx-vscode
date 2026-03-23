---
name: SOQL Create Query Save
overview: 'Update the "SFDX: Create Query in SOQL Builder" command to match the pattern of other SFDX Create commands: prompt for a file name, select an output directory from project package directories, write the file to disk, and open it in the SOQL Builder.'
todos:
  - id: update-soqlFileCreate
    content: 'Rewrite soqlFileCreate.ts: add promptForFileName, promptForOutputDir, update soqlOpenNew to write the file to disk and open it in the SOQL Builder'
    status: completed
  - id: add-messages
    content: Add i18n message keys to i18n.ts for the new prompts and validation
    status: completed
  - id: verify
    content: Run compile, lint, effect LS diagnostics, test, vscode:bundle, knip
    status: completed
isProject: false
---

# Update SOQL Create Query to Save File on Creation

## Current Behavior

`[soqlFileCreate.ts](packages/salesforcedx-vscode-soql/src/commands/soqlFileCreate.ts)` opens a hard-coded `untitled.soql` with the `untitled:` scheme — an unsaved buffer that the user must manually save.

## Target Behavior

Match the pattern of `[createApexClass.ts](packages/salesforcedx-vscode-metadata/src/commands/createApexClass.ts)`:

1. `showInputBox` → prompt for a file name (validated: non-empty, valid filename characters)
2. `showQuickPick` → prompt for output directory built from the project's package directories (path pattern: `<pkgDir>/main/default/queries/`)
3. `FsService.safeWriteFile` → create the `.soql` file on disk with empty content
4. `vscode.commands.executeCommand(OPEN_WITH_COMMAND, uri, BUILDER_VIEW_TYPE)` → open in SOQL Builder

## Files to Change

### 1. `[soqlFileCreate.ts](packages/salesforcedx-vscode-soql/src/commands/soqlFileCreate.ts)`

Replace the current implementation with:

- `promptForFileName` — `showInputBox` with validation (non-empty, no `.soql` extension required from user, valid filename chars)
- `promptForOutputDir` — `showQuickPick` over `project.getPackageDirectories()` at `<pkgDir>/main/default/queries`
- `soqlOpenNew` — orchestrates: get name → get project → get dir → `safeWriteFile` → open with SOQL Builder

Key imports to add: `Utils` from `vscode-uri`, `ProjectService` via `ExtensionProviderService`, `nls` from `../messages`

### 2. `[i18n.ts](packages/salesforcedx-vscode-soql/src/messages/i18n.ts)`

Add new message keys:

- `soql_file_name_prompt` — "Enter a name for the new SOQL file"
- `soql_file_name_placeholder` — "filename (without extension)"
- `soql_output_dir_prompt` — "Select the target directory"
- `soql_file_name_invalid` — validation error message

## Verification

- `npm run compile`
- `npm run lint`
- `npx effect-language-service diagnostics --file packages/salesforcedx-vscode-soql/src/commands/soqlFileCreate.ts`
- `npm run test`
- `npm run vscode:bundle`
- `npx knip`
