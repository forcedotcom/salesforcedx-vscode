/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global } from '@salesforce/core/global';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Option from 'effect/Option';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as path from 'node:path';
import { URL } from 'node:url';
import sanitize = require('sanitize-filename'); // NOTE: Do not follow the instructions in the Quick Fix to use the default import because that causes an error popup when you use Launch Extensions
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../../messages';
import { type ProgressOnlyCommandKey } from '../../utils/notificationMode';

const COMMAND: ProgressOnlyCommandKey = 'SFDX: Create and Set Up Project for ISV Debugging';

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
const TOOLS = 'tools';

/** `.sfdx/tools`, relative to a project root. bootstrap is the only consumer of this shape (the retrieve CLI
 * flags below want it project-relative, not the absolute workspace-anchored ProjectService.getToolsFolder),
 * so it lives here. */
const relativeToolsFolder = () => path.join(Global.STATE_FOLDER, TOOLS);

/** `sf project retrieve start` (org-wide ApexClass/ApexTrigger + per-package source) routinely runs several
 * minutes on real subscriber orgs; simpleExec's default 30s timeout would kill bootstrap mid-flow. Override it
 * for every bootstrap CLI call (parity with orgCreate's CREATE_TIMEOUT precedent). */
const CLI_TIMEOUT = Duration.minutes(15);

/** sfdx-project.json is malformed JSON (or namespace serialization failed). The bootstrap-specific message
 * beats FsService's generic read/write error since the failure is in parsing, not IO. @ExportTaggedError */
export class IsvBootstrapProjectConfigError extends Schema.TaggedError<IsvBootstrapProjectConfigError>()(
  'IsvBootstrapProjectConfigError',
  { message: Schema.String }
) {}

/** package.xml manifest retrieving all org ApexClass + ApexTrigger source (unmanaged), written to the temp dir. */
const APEX_RETRIEVE_PACKAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
</Package>`;

const relativeMetadataTempPath = () => path.join(relativeToolsFolder(), ISVDEBUGGER);
const relativeApexPackageXmlPath = () => path.join(relativeMetadataTempPath(), PACKAGE_XML);
const relativeInstalledPackagesPath = () => path.join(relativeToolsFolder(), INSTALLED_PACKAGES);

const OrgNamespaceQueryResponse = Schema.Struct({
  result: Schema.Struct({ records: Schema.Array(Schema.Unknown) })
});
const OrgNamespaceRecord = Schema.Struct({ NamespacePrefix: Schema.String });

/** Parses `sf data query --json` stdout for `Organization.NamespacePrefix`; empty string when absent. */
export const parseOrgNamespaceQueryResultJson = (orgNamespaceQueryJson: string): string =>
  Schema.decodeUnknownOption(OrgNamespaceQueryResponse)(JSON.parse(orgNamespaceQueryJson)).pipe(
    Option.flatMap(({ result }) => Arr.head(result.records)),
    Option.flatMap(Schema.decodeUnknownOption(OrgNamespaceRecord)),
    Option.map(({ NamespacePrefix }) => NamespacePrefix),
    Option.getOrElse(() => '')
  );

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

/** The forceide:// URL's `url`/`sessionId` values flow into `sf` invocations (config set / --target-org). Those
 * calls are shell-free (argv vector via cross-spawn, W-24161260), so shell metacharacters can NOT inject commands —
 * that guarantee lives at the exec boundary, not here. This regex is defense-in-depth input hygiene: a pasted URL is
 * attacker-shapeable, and rejecting these characters up front turns a malformed/hostile paste into an immediate
 * "invalid forceide URL" instead of a puzzling downstream CLI failure. Legitimate Salesforce session ids / login
 * URLs never contain them (`\s` is stricter than exec needs, but no real value has whitespace). Do NOT treat this as
 * the shell-safety guard — never reintroduce a single command string upstream on the assumption this covers it. */
const SHELL_UNSAFE = /[`$\\"'|&;<>()\s]/;

const uriValidator = (value: string): string | undefined => {
  try {
    const parameter = new URL(value).searchParams;
    const url = parameter.get('url');
    const sessionId = parameter.get('sessionId');
    // `''` passes SHELL_UNSAFE, so require non-empty here — keeps gatherForceIdeUri's parse total.
    if (!url || !sessionId || SHELL_UNSAFE.test(url) || SHELL_UNSAFE.test(sessionId)) {
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

  // uriValidator (validateInput) already rejected undefined/empty url+sessionId and any shell metacharacter, so
  // both are non-empty strings here.
  const parameter = new URL(forceIdeUri).searchParams;
  const loginUrl = parameter.get('url')!;
  const sessionId = parameter.get('sessionId')!;
  const protocolPrefix = parameter.get('secure') === '0' ? 'http://' : 'https://';
  return {
    loginUrl: loginUrl.toLowerCase().startsWith('http') ? loginUrl : protocolPrefix + loginUrl,
    sessionId,
    orgName: new URL(forceIdeUri).hostname
  };
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
      value: sanitize(orgName.replaceAll('+', '_'))
    })
  ).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation),
    Effect.map(name => name.trim())
  );

  // canSelectMany: false → showOpenDialog resolves to undefined (Esc) or a single-element URI array.
  const projectParentUri = yield* Effect.promise(() =>
    vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize('project_generate_open_dialog_create_label')
    })
  ).pipe(
    Effect.flatMap(folders =>
      Option.match(Arr.head(folders ?? []), {
        onNone: () => promptService.considerUndefinedAsCancellation<URI>(undefined),
        onSome: folder => promptService.considerUndefinedAsCancellation(folder)
      })
    )
  );

  const projectUri = Utils.joinPath(projectParentUri, projectName);
  yield* promptService.ensureMetadataOverwriteOrThrow({ uris: [projectUri] });

  return { projectName, projectParentUri, projectUri };
});

/**
 * Effect command for `sf.debug.isv.bootstrap`: scaffold an ISV Debugger project for a subscriber org.
 *
 * Gathers the forceide:// URL + project name/folder, then drives the CLI (project generate, config set,
 * namespace query, org/package source retrieve, package list) via TerminalService at the project-scoped
 * `cwd`; TerminalService supplies the CLI env (NODE_EXTRA_CA_CERTS / SF_LOG_LEVEL / SF_DISABLE_TELEMETRY) to
 * each call. The CLI/fs sequence runs under a cancellable progress notification (each step reports its label);
 * Cancel interrupts the fiber, which simpleExec propagates to kill the in-flight `sf` child. All fs steps go
 * through FsService (URI-native), whose FsServiceError surfaces to ErrorHandlerService instead of being
 * swallowed; only the sfdx-project.json parse keeps a bootstrap-specific tagged error.
 */
export const isvDebugBootstrap = Effect.fn('isvDebugBootstrap')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminalService = yield* api.services.TerminalService;
  const promptService = yield* api.services.PromptService;
  const notificationMode = yield* api.services.NotificationModeService;
  const fs = api.services.FsService;

  const { loginUrl, sessionId, orgName } = yield* gatherForceIdeUri();
  const { projectName, projectParentUri, projectUri } = yield* gatherProjectNameAndFolder(orgName);

  // CLI auth is set via project-local config (org-isv-debugger-sid), so all steps run inside the project cwd.
  // Utils.joinPath keeps everything anchored to the picked folder URI; FsService takes URIs directly, so only
  // the CLI cwd / --output-dir boundaries need .fsPath.
  const projectParentPath = projectParentUri.fsPath;
  const projectPath = projectUri.fsPath;
  const projectMetadataTempUri = Utils.joinPath(projectUri, relativeMetadataTempPath());
  const apexRetrievePackageXmlUri = Utils.joinPath(projectUri, relativeApexPackageXmlPath());
  const projectInstalledPackagesUri = Utils.joinPath(projectUri, relativeInstalledPackagesPath());
  const salesforceProjectJsonUri = Utils.joinPath(projectUri, 'sfdx-project.json');

  // No env here: simpleExec gathers NODE_EXTRA_CA_CERTS / SF_LOG_LEVEL / SF_DISABLE_TELEMETRY (plus
  // SF_JSON_TO_STDOUT / FORCE_COLOR / SFDX_TOOL) for every `sf ` command at exec time, so corp-proxy CA certs
  // and CLI env reach these bootstrap children without being threaded through.
  // args passed as a discrete vector (no shell), so projectName/paths/sessionId/loginUrl/package names reach
  // sf verbatim — no quoting needed and no shell interpretation of embedded metacharacters possible (W-24161260).
  const runSf = (args: readonly string[], cwd: string) =>
    terminalService.simpleExec({ executable: 'sf', args, parse: identity, cwd, timeout: CLI_TIMEOUT });

  // Drive the whole bootstrap under a cancellable progress notification (each step reports its label). Cancel
  // interrupts the fiber, which simpleExec propagates to kill the in-flight `sf` child process.
  yield* promptService.withCancellableProgressReporting(
    nls.localize('isv_debug_bootstrap_progress_title'),
    yield* notificationMode.getProgressLocation(COMMAND)
  )(progress =>
    Effect.gen(function* () {
      const report = (message: string) => Effect.sync(() => progress.report({ message }));

      // remove any previous project at this path location (safeDelete swallows not-found)
      yield* fs.safeDelete(projectUri, { recursive: true });

      // 1: create project
      yield* report(nls.localize('isv_debug_bootstrap_create_project'));
      yield* runSf(
        ['project', 'generate', '--name', projectName, '--output-dir', projectParentPath, '--template', 'standard'],
        projectParentPath
      );

      // 2: configure project (writes project-local .sf/config.json, keyed to cwd=projectPath). `sf config set`
      // takes each key=value as one token; passed as discrete argv elements so the values are never re-parsed.
      yield* report(nls.localize('isv_debug_bootstrap_configure_project'));
      yield* runSf(
        [
          'config',
          'set',
          `org-isv-debugger-sid=${sessionId}`,
          `org-isv-debugger-url=${loginUrl}`,
          `org-instance-url=${loginUrl}`
        ],
        projectPath
      );

      // 2b: update sfdx-project.json with namespace
      yield* report(nls.localize('isv_debug_bootstrap_configure_project_retrieve_namespace'));
      const orgNamespaceInfoResponseJson = yield* runSf(
        [
          'data',
          'query',
          '--query',
          'SELECT NamespacePrefix FROM Organization LIMIT 1',
          '--target-org',
          sessionId,
          '--json'
        ],
        projectPath
      );
      const salesforceProjectJson = yield* fs.readFile(salesforceProjectJsonUri);
      const updatedProjectJson = yield* Effect.try({
        try: () => {
          const config = JSON.parse(salesforceProjectJson);
          config.namespace = parseOrgNamespaceQueryResultJson(orgNamespaceInfoResponseJson);
          return JSON.stringify(config, null, 2);
        },
        catch: e => new IsvBootstrapProjectConfigError({ message: isError(e) ? e.message : String(e) })
      });
      yield* fs.writeFile(salesforceProjectJsonUri, updatedProjectJson);

      // 3a: create package.xml for downloading org apex (safeWriteFile creates the .../isvdebuggermdapitmp parent)
      yield* fs.safeWriteFile(apexRetrievePackageXmlUri, APEX_RETRIEVE_PACKAGE_XML);

      // 3b: retrieve unmanaged org source (--manifest is relative → resolvable at cwd=projectPath)
      yield* report(nls.localize('isv_debug_bootstrap_retrieve_org_source'));
      yield* runSf(
        ['project', 'retrieve', 'start', '--manifest', relativeApexPackageXmlPath(), '--target-org', sessionId],
        projectPath
      );

      // 4: get list of installed packages
      yield* report(nls.localize('isv_debug_bootstrap_list_installed_packages'));
      const packageInfos = parsePackageInstalledListJson(
        yield* runSf(['package', 'installed', 'list', '--target-org', sessionId, '--json'], projectPath)
      );

      // 5a: create directory where packages are to be retrieved (.sfdx/tools/installed-packages)
      yield* fs.createDirectory(projectInstalledPackagesUri);

      // 5b: retrieve packages
      yield* Effect.forEach(
        packageInfos,
        packageInfo =>
          report(nls.localize('isv_debug_bootstrap_retrieve_package_source', packageInfo.name)).pipe(
            Effect.tap(() =>
              runSf(
                // '.' in package name trims the folder name (salesforce.fth → salesforce), so replace it in zip-file-name
                [
                  'project',
                  'retrieve',
                  'start',
                  '--package-name',
                  packageInfo.name,
                  '--target-org',
                  sessionId,
                  '--target-metadata-dir',
                  relativeInstalledPackagesPath(),
                  '--unzip',
                  '--zip-file-name',
                  packageInfo.name.replaceAll('.', '-')
                ],
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
          report(nls.localize('isv_debug_bootstrap_processing_package', packageInfo.name)).pipe(
            Effect.tap(() =>
              fs.safeWriteFile(
                Utils.joinPath(
                  projectInstalledPackagesUri,
                  packageInfo.name.replaceAll('.', '-'),
                  'installed-package.json'
                ),
                JSON.stringify(packageInfo, null, 2)
              )
            )
          ),
        { discard: true }
      );

      // 5c: cleanup temp files (safeDelete swallows not-found)
      yield* fs.safeDelete(projectMetadataTempUri, { recursive: true });

      // 6: generate launch configuration (safeWriteFile creates the .vscode parent)
      yield* report(nls.localize('isv_debug_bootstrap_generate_launchjson'));
      yield* fs.safeWriteFile(
        Utils.joinPath(projectUri, '.vscode', 'launch.json'),
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

      // last step: open the folder in VS Code
      yield* report(nls.localize('isv_debug_bootstrap_open_project'));
      yield* Effect.promise(() => vscode.commands.executeCommand('vscode.openFolder', URI.file(projectPath)));
    })
  );
});
