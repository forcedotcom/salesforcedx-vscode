/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { GlobalCliEnvironment } from '@salesforce/salesforcedx-utils';
import {
  createDirectory,
  fileOrFolderExists,
  projectPaths,
  readFile,
  safeDelete,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import { isError, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as path from 'node:path';
import { URL } from 'node:url';
import sanitize = require('sanitize-filename'); // NOTE: Do not follow the instructions in the Quick Fix to use the default import because that causes an error popup when you use Launch Extensions
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../../messages';

type InstalledPackageInfo = {
  id: string;
  name: string;
  namespace: string;
  versionId: string;
  versionName: string;
  versionNumber: string;
};

const ISVDEBUGGER = 'isvdebuggermdapitmp';
const INSTALLED_PACKAGES = 'installed-packages';
const PACKAGE_XML = 'package.xml';

/** `sf project retrieve start` (org-wide ApexClass/ApexTrigger + per-package source) routinely runs several
 * minutes on real subscriber orgs; simpleExec's default 30s timeout would kill bootstrap mid-flow. Override it
 * for every bootstrap CLI call (parity with orgCreate's CREATE_TIMEOUT precedent). */
const CLI_TIMEOUT = Duration.minutes(15);

/** sfdx-project.json namespace write failed. Previously swallowed (logged + returned, truncating the rest of the flow). @ExportTaggedError */
export class IsvBootstrapProjectConfigError extends Schema.TaggedError<IsvBootstrapProjectConfigError>()(
  'IsvBootstrapProjectConfigError',
  { message: Schema.String }
) {}

/** package.xml creation failed. Previously swallowed. @ExportTaggedError */
export class IsvBootstrapPackageXmlError extends Schema.TaggedError<IsvBootstrapPackageXmlError>()(
  'IsvBootstrapPackageXmlError',
  { message: Schema.String }
) {}

/** installed-package.json write failed. Previously swallowed. @ExportTaggedError */
export class IsvBootstrapInstalledPackageWriteError extends Schema.TaggedError<IsvBootstrapInstalledPackageWriteError>()(
  'IsvBootstrapInstalledPackageWriteError',
  { message: Schema.String }
) {}

/** temp-file cleanup failed. Previously swallowed. @ExportTaggedError */
export class IsvBootstrapCleanupError extends Schema.TaggedError<IsvBootstrapCleanupError>()(
  'IsvBootstrapCleanupError',
  { message: Schema.String }
) {}

/** launch.json write failed. Previously swallowed. @ExportTaggedError */
export class IsvBootstrapLaunchJsonError extends Schema.TaggedError<IsvBootstrapLaunchJsonError>()(
  'IsvBootstrapLaunchJsonError',
  { message: Schema.String }
) {}

const relativeMetadataTempPath = () => path.join(projectPaths.relativeToolsFolder(), ISVDEBUGGER);
const relativeApexPackageXmlPath = () => path.join(relativeMetadataTempPath(), PACKAGE_XML);
const relativeInstalledPackagesPath = () => path.join(projectPaths.relativeToolsFolder(), INSTALLED_PACKAGES);

/** Parses `sf data query --json` stdout for `Organization.NamespacePrefix`; empty string when absent. */
export const parseOrgNamespaceQueryResultJson = (orgNamespaceQueryJson: string): string => {
  const orgNamespaceQueryResponse = JSON.parse(orgNamespaceQueryJson);
  if (
    orgNamespaceQueryResponse.result?.records?.[0] &&
    isString(orgNamespaceQueryResponse.result.records[0].NamespacePrefix)
  ) {
    return orgNamespaceQueryResponse.result.records[0].NamespacePrefix;
  }
  return '';
};

/** Parses `sf package installed list --json` stdout into the installed-package descriptors. */
export const parsePackageInstalledListJson = (packagesJson: string): InstalledPackageInfo[] => {
  const packagesData = JSON.parse(packagesJson);
  return packagesData.result.map(
    (entry: any) =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      ({
        id: entry.SubscriberPackageId,
        name: entry.SubscriberPackageName,
        namespace: entry.SubscriberPackageNamespace,
        versionId: entry.SubscriberPackageVersionId,
        versionName: entry.SubscriberPackageVersionName,
        versionNumber: entry.SubscriberPackageVersionNumber
      }) as InstalledPackageInfo
  );
};

/** The forceide:// URL's `url`/`sessionId` values are interpolated into shell command strings (config set /
 * --target-org). A pasted URL is attacker-shapeable, and double-quote wrapping does NOT neutralize `$`, backtick,
 * `\`, `"` under /bin/sh, so reject any shell metacharacter here (parity with validateAliasInput's shell-safe
 * gate). Legitimate Salesforce session ids / login URLs never contain these. */
const SHELL_UNSAFE = /[`$\\"'|&;<>()\s]/;

const uriValidator = (value: string): string | undefined => {
  try {
    const parameter = new URL(value).searchParams;
    const url = parameter.get('url');
    const sessionId = parameter.get('sessionId');
    if (!isString(url) || !isString(sessionId) || SHELL_UNSAFE.test(url) || SHELL_UNSAFE.test(sessionId)) {
      return nls.localize('parameter_gatherer_invalid_forceide_url');
    }
  } catch {
    return nls.localize('parameter_gatherer_invalid_forceide_url');
  }
  return undefined;
};

/** Prompts for the forceide:// URL and parses its login URL / session id / org name. Esc → UserCancellationError. */
const gatherForceIdeUri = Effect.fn('isvDebugBootstrap.gatherForceIdeUri')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const forceIdeUri = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_paste_forceide_url'),
      placeHolder: nls.localize('parameter_gatherer_paste_forceide_url_placeholder'),
      ignoreFocusOut: true,
      validateInput: uriValidator
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  const parameter = new URL(forceIdeUri).searchParams;
  const loginUrl = parameter.get('url');
  const sessionId = parameter.get('sessionId');
  if (loginUrl && sessionId) {
    const protocolPrefix = parameter.get('secure') === '0' ? 'http://' : 'https://';
    return {
      loginUrl: loginUrl.toLowerCase().startsWith('http') ? loginUrl : protocolPrefix + loginUrl,
      sessionId,
      orgName: new URL(forceIdeUri).hostname
    };
  }
  yield* Effect.sync(
    () => void vscode.window.showErrorMessage(nls.localize('parameter_gatherer_invalid_forceide_url'))
  );
  return yield* new api.services.UserCancellationError({});
});

/** Prompts for project name (prefilled from the sanitized org name) + parent folder; enforces the overwrite prompt. */
const gatherProjectNameAndFolder = Effect.fn('isvDebugBootstrap.gatherProjectNameAndFolder')(function* (
  orgName: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const projectName = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_enter_project_name'),
      value: orgName ? sanitize(orgName.replaceAll('+', '_')) : ''
    })
  ).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation),
    Effect.map(name => name.trim())
  );
  if (projectName.length === 0) {
    return yield* new api.services.UserCancellationError({});
  }

  const folderSelection = yield* Effect.promise(() =>
    vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('project_generate_open_dialog_create_label')
    })
  );
  if (folderSelection?.length !== 1) {
    return yield* new api.services.UserCancellationError({});
  }
  const projectUri = folderSelection[0].fsPath;

  const exists = yield* Effect.promise(() => fileOrFolderExists(path.join(projectUri, `${projectName}/`)));
  if (exists) {
    const overwrite = nls.localize('warning_prompt_overwrite');
    const choice = yield* Effect.promise(() =>
      Promise.resolve(
        vscode.window.showWarningMessage(
          nls.localize('warning_prompt_dir_overwrite'),
          overwrite,
          nls.localize('warning_prompt_overwrite_cancel')
        )
      )
    );
    if (choice !== overwrite) {
      return yield* new api.services.UserCancellationError({});
    }
  }

  return { projectName, projectUri };
});

/**
 * Effect command for `sf.debug.isv.bootstrap`: scaffold an ISV Debugger project for a subscriber org.
 *
 * Gathers the forceide:// URL + project name/folder, then drives the CLI (project generate, config set,
 * namespace query, org/package source retrieve, package list) via TerminalService at the project-scoped
 * `cwd`, threading `GlobalCliEnvironment` (NODE_EXTRA_CA_CERTS / SF_LOG_LEVEL / SF_DISABLE_TELEMETRY) into
 * each call. All fs steps fail with dedicated tagged errors (rendered by ErrorHandlerService) instead of
 * being swallowed.
 */
export const isvDebugBootstrap = Effect.fn('isvDebugBootstrap')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminalService = yield* api.services.TerminalService;
  const channel = yield* api.services.ChannelService;

  const { loginUrl, sessionId, orgName } = yield* gatherForceIdeUri();
  const { projectName, projectUri } = yield* gatherProjectNameAndFolder(orgName);

  // CLI auth is set via project-local config (org-isv-debugger-sid), so all steps run inside the project cwd.
  const projectParentPath = projectUri;
  const projectPath = path.join(projectParentPath, projectName);
  const projectMetadataTempPath = path.join(projectPath, relativeMetadataTempPath());
  const apexRetrievePackageXmlPath = path.join(projectPath, relativeApexPackageXmlPath());
  const projectInstalledPackagesPath = path.join(projectPath, relativeInstalledPackagesPath());
  const salesforceProjectJsonFile = path.join(projectPath, 'sfdx-project.json');

  // Thread the GlobalCliEnvironment map (NODE_EXTRA_CA_CERTS / SF_LOG_LEVEL / SF_DISABLE_TELEMETRY) into every
  // bootstrap sf call so corp-proxy CA certs and CLI env survive — bootstrap previously opted out of process.env
  // inheritance but still got this Map via patchEnv. simpleExec merges this over process.env; the auto-injected
  // SF_JSON_TO_STDOUT/FORCE_COLOR still apply.
  const env = Object.fromEntries(GlobalCliEnvironment.environmentVariables);

  const runSf = (command: string, cwd: string) =>
    terminalService.simpleExec({ command, parse: identity, env, cwd, timeout: CLI_TIMEOUT });

  const append = (message: string) => channel.appendToChannel(message);

  yield* channel.showChannel;

  // remove any previous project at this path location
  yield* Effect.tryPromise({
    try: () => safeDelete(projectPath, { recursive: true }),
    catch: e => new IsvBootstrapCleanupError({ message: isError(e) ? e.message : String(e) })
  });

  // 1: create project
  yield* append(nls.localize('isv_debug_bootstrap_create_project'));
  yield* runSf(
    `sf project generate --name "${projectName}" --output-dir "${projectUri}" --template standard`,
    projectParentPath
  );

  // 2: configure project (writes project-local .sf/config.json, keyed to cwd=projectPath)
  yield* append(nls.localize('isv_debug_bootstrap_configure_project'));
  yield* runSf(
    `sf config set org-isv-debugger-sid="${sessionId}" org-isv-debugger-url="${loginUrl}" org-instance-url="${loginUrl}"`,
    projectPath
  );

  // 2b: update sfdx-project.json with namespace
  yield* append(nls.localize('isv_debug_bootstrap_configure_project_retrieve_namespace'));
  const orgNamespaceInfoResponseJson = yield* runSf(
    `sf data query --query "SELECT NamespacePrefix FROM Organization LIMIT 1" --target-org "${sessionId}" --json`,
    projectPath
  );
  yield* Effect.tryPromise({
    try: async () => {
      const salesforceProjectConfig = JSON.parse(await readFile(salesforceProjectJsonFile));
      salesforceProjectConfig.namespace = parseOrgNamespaceQueryResultJson(orgNamespaceInfoResponseJson);
      await writeFile(salesforceProjectJsonFile, JSON.stringify(salesforceProjectConfig, null, 2));
    },
    catch: e => new IsvBootstrapProjectConfigError({ message: isError(e) ? e.message : String(e) })
  });

  // 3a: create package.xml for downloading org apex
  yield* Effect.tryPromise({
    try: async () => {
      await createDirectory(projectMetadataTempPath);
      await writeFile(
        apexRetrievePackageXmlPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
</Package>`
      );
    },
    catch: e => new IsvBootstrapPackageXmlError({ message: isError(e) ? e.message : String(e) })
  });

  // 3b: retrieve unmanaged org source (--manifest is relative → resolvable at cwd=projectPath)
  yield* append(nls.localize('isv_debug_bootstrap_retrieve_org_source'));
  yield* runSf(
    `sf project retrieve start --manifest "${relativeApexPackageXmlPath()}" --target-org "${sessionId}"`,
    projectPath
  );

  // 4: get list of installed packages
  yield* append(nls.localize('isv_debug_bootstrap_list_installed_packages'));
  const packagesJson = yield* runSf(`sf package installed list --target-org "${sessionId}" --json`, projectPath);
  const packageInfos = parsePackageInstalledListJson(packagesJson);

  // 5a: create directory where packages are to be retrieved (.sfdx/tools/installed-packages)
  yield* Effect.tryPromise({
    try: () => createDirectory(projectInstalledPackagesPath),
    catch: e => new IsvBootstrapInstalledPackageWriteError({ message: isError(e) ? e.message : String(e) })
  });

  // 5b: retrieve packages
  yield* Effect.forEach(
    packageInfos,
    packageInfo =>
      append(nls.localize('isv_debug_bootstrap_retrieve_package_source', packageInfo.name)).pipe(
        Effect.zipRight(
          runSf(
            // '.' in package name trims the folder name (salesforce.fth → salesforce), so replace it in zip-file-name
            `sf project retrieve start --package-name "${packageInfo.name}" --target-org "${sessionId}" --target-metadata-dir "${relativeInstalledPackagesPath()}" --unzip --zip-file-name "${packageInfo.name.replaceAll('.', '-')}"`,
            projectPath
          )
        )
      ),
    { discard: true }
  );

  // generate installed-package.json files
  yield* Effect.forEach(
    packageInfos,
    packageInfo =>
      append(nls.localize('isv_debug_bootstrap_processing_package', packageInfo.name)).pipe(
        Effect.zipRight(
          Effect.tryPromise({
            try: () =>
              writeFile(
                path.join(
                  projectInstalledPackagesPath,
                  packageInfo.name.replaceAll('.', '-'),
                  'installed-package.json'
                ),
                JSON.stringify(packageInfo, null, 2)
              ),
            catch: e => new IsvBootstrapInstalledPackageWriteError({ message: isError(e) ? e.message : String(e) })
          })
        )
      ),
    { discard: true }
  );

  // 5c: cleanup temp files
  yield* Effect.tryPromise({
    try: () => safeDelete(projectMetadataTempPath, { recursive: true }),
    catch: e => new IsvBootstrapCleanupError({ message: isError(e) ? e.message : String(e) })
  });

  // 6: generate launch configuration
  yield* append(nls.localize('isv_debug_bootstrap_generate_launchjson'));
  yield* Effect.tryPromise({
    try: async () => {
      const projectVsCodeFolder = path.join(projectPath, '.vscode');
      await createDirectory(projectVsCodeFolder);
      await writeFile(
        path.join(projectVsCodeFolder, 'launch.json'),
        // mostly duplicated from ApexDebuggerConfigurationProvider to avoid hard dependency from core to debugger module
        JSON.stringify(
          {
            version: '0.2.0',
            configurations: [
              {
                name: 'Launch Apex Debugger',
                type: 'apex',
                request: 'launch',
                userIdFilter: [],
                requestTypeFilter: [],
                entryPointFilter: '',
                salesforceProject: '${workspaceRoot}',
                connectType: 'ISV_DEBUGGER'
              }
            ]
          },
          null,
          2
        )
      );
    },
    catch: e => new IsvBootstrapLaunchJsonError({ message: isError(e) ? e.message : String(e) })
  });

  // last step: open the folder in VS Code
  yield* append(nls.localize('isv_debug_bootstrap_open_project'));
  yield* Effect.promise(() => vscode.commands.executeCommand('vscode.openFolder', URI.file(projectPath)));
});
