---
name: Move ISV Debug Bootstrap
overview: Analyze feasibility of moving ISV Debug Bootstrap command from salesforcedx-vscode-core to salesforcedx-vscode-apex-debugger extension, identifying all dependencies and determining what needs to move or be exposed.
todos: []
---

# Move ISV Debug Bootstrap Command to Apex Debugger Extension

## Analysis Summary

The [`bootstrapCmd.ts`](packages/salesforcedx-vscode-core/src/commands/isvdebugging/bootstrapCmd.ts) command can be moved to the apex-debugger extension, but several dependencies must be addressed.

## Current Dependencies

### 1. **Core Extension Services (Already Exposed via API)**

These are already available through the core extension's public API:

- `channelService` - for output logging
- `notificationService` - for user notifications
- `SfCommandlet` / `SfCommandletExecutor` - command infrastructure
- `ProgressNotification` - progress UI
- Various utilities from `@salesforce/salesforcedx-utils-vscode`

### 2. **Project Generation Utilities (Will Duplicate)**

Currently only used by `bootstrapCmd.ts` and `projectGenerate.ts`:

- `SelectProjectName` class - prompts user for project name (78 lines)
- `SelectProjectFolder` class - prompts user for folder location (11 lines)
- `PathExistsChecker` class - validates path doesn't already exist (20 lines)

These are defined in [`projectGenerate.ts`](packages/salesforcedx-vscode-core/src/commands/projectGenerate.ts) but only `bootstrapCmd.ts` imports them outside that file.

**Decision: Duplicate in Apex-Debugger**

These classes are simple and self-contained (~109 lines total). Duplicating them in apex-debugger avoids:

- Adding more exports to core's public API
- Creating coupling between extensions for simple UI utilities
- Complicating the dependency graph

**Implementation:**

Copy these three classes directly into the new `bootstrapCmd.ts` file in apex-debugger. They have no external dependencies beyond standard VS Code APIs and utilities already available in both extensions.

**Note:** The `parameter_gatherer_enter_project_name` NLS message used by `SelectProjectName` will also need to be duplicated in apex-debugger's messages (it's currently only in core).

### 3. **Core Services (Already Internal to Bootstrap)**

- `taskViewService` - already exposed in core API
- `CliCommandExecutor` - from utils-vscode package

### 4. **Localized Messages (Need to Move)**

The following NLS keys are ISV-debugger-specific and should move to apex-debugger extension.

**English messages** (from `i18n.ts`):

- `isv_debug_bootstrap_create_project` - 'SFDX: ISV Debugger Setup, Step 1 of 5: Creating project'
- `isv_debug_bootstrap_configure_project` - 'SFDX: ISV Debugger Setup, Step 2 of 5: Configuring project'
- `isv_debug_bootstrap_configure_project_retrieve_namespace` - 'SFDX: ISV Debugger Setup, Step 2b of 5: Querying org for namespace prefix'
- `isv_debug_bootstrap_retrieve_org_source` - 'SFDX: ISV Debugger Setup, Step 3 of 5: Retrieving unpackaged Apex code'
- `isv_debug_bootstrap_list_installed_packages` - 'SFDX: ISV Debugger Setup, Step 4 of 5: Querying for installed packages'
- `isv_debug_bootstrap_retrieve_package_source` - 'SFDX: ISV Debugger Setup, Step 5 of 5: Retrieving package: %s'
- `isv_debug_bootstrap_processing_package` - 'Processing package: %s'
- `isv_debug_bootstrap_generate_launchjson` - 'Creating launch configuration'
- `isv_debug_bootstrap_open_project` - 'Opening project in Visual Studio Code'
- `parameter_gatherer_invalid_forceide_url` - 'The forceide:// URL is not valid or is missing required parameters.'
- `parameter_gatherer_paste_forceide_url` - 'Paste forceide:// URL from Setup'
- `parameter_gatherer_paste_forceide_url_placeholder` - 'forceide:// URL from Setup'
- `error_creating_packagexml` - 'Error creating package.xml. %s'
- `error_updating_salesforce_project` - 'Error updating sfdx-project.json: %s'
- `error_writing_installed_package_info` - 'Error writing installed-package.json: %s'
- `error_cleanup_temp_files` - 'Error cleaning up temporary files: %s'
- `error_creating_launchjson` - 'Error creating launch.json: %s'

**Japanese messages** (from `i18n.ja.ts`):

- `isv_debug_bootstrap_create_project` - 'SFDX: ISV デバッガ 設定 ステップ 1/7: プロジェクトを作成しています'
- `isv_debug_bootstrap_configure_project` - 'SFDX: ISV デバッガ 設定 ステップ 2/7: プロジェクトを設定しています'
- `isv_debug_bootstrap_configure_project_retrieve_namespace` - 'SFDX: ISV デバッガ 設定 ステップ 2b/7: 組織の名前空間接頭辞を問い合わせています'
- `isv_debug_bootstrap_retrieve_org_source` - 'SFDX: ISV デバッガ 設定 ステップ 4/7: パッケージ化されていない Apex コードを取得しています'
- `isv_debug_bootstrap_list_installed_packages` - 'SFDX: ISV デバッガ 設定 ステップ 5/7: インストール済みパッケージを問い合わせています'
- `isv_debug_bootstrap_retrieve_package_source` - 'SFDX: ISV デバッガ 設定 ステップ 6/7: パッケージを取得しています'
- `isv_debug_bootstrap_processing_package` - 'パッケージを処理しています: %s'
- `isv_debug_bootstrap_generate_launchjson` - '起動構成ファイルを作成しています'
- `isv_debug_bootstrap_open_project` - 'プロジェクトを新しい Visual Studio Code のウィンドウで開いています'
- `parameter_gatherer_invalid_forceide_url` - 'forceide:// URL が無効か、必要なパラメータが不足しています。'
- `parameter_gatherer_paste_forceide_url` - '設定から forceide:// の URL をペースト'
- `parameter_gatherer_paste_forceide_url_placeholder` - '設定の forceide:// URL'
- `error_creating_packagexml` - 'package.xml の作成中にエラー: %s'
- `error_updating_salesforce_project` - 'sfdx-project.json の更新中にエラー: %s'
- `error_writing_installed_package_info` - 'installed-package.json の書き込み中にエラー: %s'
- `error_cleanup_temp_files` - '一時ファイルのクリーンアップ中にエラー: %s'
- `error_creating_launchjson` - Missing in Japanese file, needs translation

**Shared message that needs duplication:**

- `parameter_gatherer_enter_project_name` - 'Enter project name' (English) / 'プロジェクト名を入力' (Japanese) - Used by `SelectProjectName` class. Since we're duplicating the class, we need to duplicate this message too. Core will keep it for regular project generation.

### 5. **NPM Dependencies**

- `sanitize-filename` - only used by bootstrapCmd.ts in core, would move with it
- `vscode-uri` - already in apex-debugger as transitive dependency

## Recommended Approach

### Option A: Move Everything (Recommended)

**Pros:**

- Clean separation of concerns - ISV debugging is debugger-specific
- Removes debugger-specific code from core
- Project generation utilities are simple enough to duplicate or extract

**Cons:**

- Need to either duplicate or extract project generation utilities
- Slightly more complex initial migration

**Steps:**

1. **Create new file in apex-debugger** - Copy `bootstrapCmd.ts` to `packages/salesforcedx-vscode-apex-debugger/src/commands/isvdebugging/bootstrapCmd.ts`
2. **Copy utility classes** - Include `SelectProjectName`, `SelectProjectFolder`, `PathExistsChecker` directly in the new file (no imports from core)
3. **Update imports** - Change to use core extension API only for `channelService`, `notificationService`, `taskViewService`, etc. (services already in the API)
4. **Add NLS messages** - Add all ISV-specific messages PLUS `parameter_gatherer_enter_project_name` to apex-debugger's `i18n.ts` and `i18n.ja.ts`
5. **Add dependency** - Add `sanitize-filename` to apex-debugger's `package.json` dependencies
6. **Register command** - Add command registration in apex-debugger's `index.ts`
7. **Move test file** - Create `packages/salesforcedx-vscode-apex-debugger/test/jest/commands/isvdebugging/bootstrapCmd.test.ts`
8. **Update apex-debugger package.json** - Add command contributions and command palette entries
9. **Clean up core extension** - Remove all ISV bootstrap code, messages, and references (see cleanup section below)

### Option B: Expose via Core API

**Pros:**

- Minimal code movement
- Core retains ownership of project setup

**Cons:**

- ISV debugging remains coupled to core
- Doesn't improve separation of concerns
- Core still has debugger-specific logic

## Cleanup Tasks - Items to Remove from Core Extension

After moving the ISV bootstrap command, the following must be cleaned up from core:

### Files to Delete

- [`packages/salesforcedx-vscode-core/src/commands/isvdebugging/bootstrapCmd.ts`](packages/salesforcedx-vscode-core/src/commands/isvdebugging/bootstrapCmd.ts)
- [`packages/salesforcedx-vscode-core/test/jest/commands/isvdebugging/bootstrapCmd.test.ts`](packages/salesforcedx-vscode-core/test/jest/commands/isvdebugging/bootstrapCmd.test.ts)
- `packages/salesforcedx-vscode-core/src/commands/isvdebugging/` directory (if now empty)
- `packages/salesforcedx-vscode-core/test/jest/commands/isvdebugging/` directory (if now empty)

### Code to Remove from [`packages/salesforcedx-vscode-core/src/index.ts`](packages/salesforcedx-vscode-core/src/index.ts)

- Line 74: `import { isvDebugBootstrap } from './commands/isvdebugging/bootstrapCmd';`
- Line 146: `vscode.commands.registerCommand('sf.debug.isv.bootstrap', isvDebugBootstrap),`

### Messages to Remove from [`packages/salesforcedx-vscode-core/src/messages/i18n.ts`](packages/salesforcedx-vscode-core/src/messages/i18n.ts)

Remove lines 185-202 (all ISV bootstrap messages):

- `isv_debug_bootstrap_create_project`
- `isv_debug_bootstrap_configure_project`
- `isv_debug_bootstrap_configure_project_retrieve_namespace`
- `isv_debug_bootstrap_retrieve_org_source`
- `isv_debug_bootstrap_list_installed_packages`
- `isv_debug_bootstrap_retrieve_package_source`
- `isv_debug_bootstrap_processing_package`
- `isv_debug_bootstrap_generate_launchjson`
- `isv_debug_bootstrap_open_project`
- `parameter_gatherer_invalid_forceide_url`
- `parameter_gatherer_paste_forceide_url`
- `parameter_gatherer_paste_forceide_url_placeholder`
- `error_creating_packagexml`
- `error_updating_salesforce_project`
- `error_writing_installed_package_info`
- `error_cleanup_temp_files`
- `error_creating_launchjson`

### Messages to Remove from [`packages/salesforcedx-vscode-core/src/messages/i18n.ja.ts`](packages/salesforcedx-vscode-core/src/messages/i18n.ja.ts)

Remove lines 126-144 (all ISV bootstrap Japanese messages)

### Package.json Changes in [`packages/salesforcedx-vscode-core/package.json`](packages/salesforcedx-vscode-core/package.json)

**Remove command contribution** (line 737-739):

```json
{
  "command": "sf.debug.isv.bootstrap",
  "title": "%isv_bootstrap_command_text%"
}
```

**Remove command palette entry** (line 490-492):

```json
{
  "command": "sf.debug.isv.bootstrap",
  "when": "!sf:internal_dev && (!isWeb || (isWeb && sf:code_builder_enabled))"
}
```

**Remove NLS key** from `package.nls.json`:

- `isv_bootstrap_command_text`

**Remove NLS key** from `package.nls.ja.json`:

- `isv_bootstrap_command_text`

### Dependencies to Remove from [`packages/salesforcedx-vscode-core/package.json`](packages/salesforcedx-vscode-core/package.json)

- `sanitize-filename` - only used by bootstrapCmd.ts (verify with grep before removing)

### Verify No Other References

Run these checks before completing cleanup:

```bash
# Check for any remaining references to isvDebugBootstrap
grep -r "isvDebugBootstrap" packages/salesforcedx-vscode-core/src/

# Check for any remaining references to isv_debug_bootstrap
grep -r "isv_debug_bootstrap" packages/salesforcedx-vscode-core/src/

# Check if sanitize-filename is used elsewhere
grep -r "sanitize-filename" packages/salesforcedx-vscode-core/src/
```

## Implementation Summary

**Approach:** Duplicate the simple utility classes in apex-debugger to avoid coupling. This is cleaner than expanding core's public API for these small, self-contained classes.

**Command ownership:** The command `sf.debug.isv.bootstrap` will move completely to apex-debugger (code, tests, NLS messages, package.json contributions). Core will have zero knowledge of it after cleanup.

**Dependencies:** Apex-debugger will continue to use core's existing public API for services like `channelService`, `notificationService`, `taskViewService`, but will have its own copies of the project utility classes.