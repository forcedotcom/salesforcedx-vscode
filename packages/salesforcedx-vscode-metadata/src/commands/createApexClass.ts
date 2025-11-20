/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';

type CreateApexClassParams = {
  readonly name?: string;
  readonly outputDir?: vscode.Uri;
};
class UserCancelledOverwriteError extends Data.TaggedError('UserCancelledOverwriteError')<{}> {}

/** Get API version using waterfall: sfdx-project.json -> connection -> fallback */
const getApiVersion = (project: SfProject): Effect.Effect<string, never> => {
  const fromProject = Effect.gen(function* () {
    const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
    return String(projectJson.get<string>('sourceApiVersion'));
  });

  const fromConnection = Effect.gen(function* () {
    const connectionService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services
      .ConnectionService;
    const connection = yield* connectionService.getConnection;
    return connection.version;
  });

  return fromProject.pipe(
    Effect.orElse(() => fromConnection),
    Effect.provide(AllServicesLayer),
    Effect.catchAll(() => Effect.succeed('65.0'))
  );
};

/** Prompt user to select output directory from available package directories */
const promptForOutputDir = (project: SfProject): Effect.Effect<vscode.Uri | undefined, Error> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const workspaceInfo = yield* (yield* api.services.WorkspaceService).getWorkspaceInfo;

    const packageDirs = project.getPackageDirectories();
    if (packageDirs.length === 0) {
      return yield* Effect.fail(new Error('No package directories found in sfdx-project.json'));
    }

    const workspaceUri = URI.parse(workspaceInfo.path);

    // Build Quick Pick items for each package directory
    const items = packageDirs.map(pkg => ({
      label: `${pkg.path}/main/default/classes`,
      description: pkg.default ? '(default)' : undefined,
      uri: Utils.joinPath(workspaceUri, pkg.path, 'main', 'default', 'classes')
    }));

    // Show Quick Pick - VS Code will automatically highlight the first item by default
    const selected = yield* Effect.promise(() =>
      vscode.window.showQuickPick(items, {
        placeHolder: nls.localize('apex_class_output_dir_prompt') || 'Select output directory',
        matchOnDescription: true
      })
    );

    return selected?.uri;
  }).pipe(Effect.provide(AllServicesLayer));

/** Prompt user for class name */
const promptForClassName = async (): Promise<string | undefined> => {
  const name = await vscode.window.showInputBox({
    prompt: nls.localize('apex_class_name_prompt'),
    placeHolder: nls.localize('apex_class_name_placeholder'),
    validateInput: (value: string) => {
      if (!value || value.trim().length === 0) {
        return 'Class name cannot be empty';
      }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
        return 'Class name must start with a letter and contain only alphanumeric characters and underscores';
      }
      return undefined;
    }
  });
  return name?.trim();
};

/** Check if files exist and prompt for overwrite if needed */
const checkAndPromptOverwrite = (
  clsUri: vscode.Uri,
  metaUri: vscode.Uri
): Effect.Effect<boolean, Error | UserCancelledOverwriteError> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fsService = yield* api.services.FsService;

    const [clsExists, metaExists] = yield* Effect.all(
      [fsService.fileOrFolderExists(clsUri), fsService.fileOrFolderExists(metaUri)],
      { concurrency: 'unbounded' }
    );

    if (!clsExists && !metaExists) {
      return true; // No files exist, proceed
    }

    // Prompt user
    const choice = yield* Effect.promise(() =>
      vscode.window.showWarningMessage(
        nls.localize('apex_class_already_exists'),
        { modal: true },
        'Overwrite',
        'Cancel'
      )
    );

    return choice === 'Overwrite' ? true : yield* new UserCancelledOverwriteError();
  }).pipe(Effect.provide(AllServicesLayer));

// this really should use the template library, but I need an apex class create for testing purposes and don't have the real one yet
/** Create Apex class files */
const createFiles = (
  className: string,
  outputDir: vscode.Uri,
  apiVersion: string
): Effect.Effect<void, UserCancelledOverwriteError | Error, ExtensionProviderService> =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fsService = yield* api.services.FsService;
    const channelService = yield* api.services.ChannelService;

    const clsUri = Utils.joinPath(outputDir, `${className}.cls`);
    const metaUri = Utils.joinPath(outputDir, `${className}.cls-meta.xml`);

    yield* channelService.appendToChannel(`Creating Apex class: ${clsUri.toString()}`);

    // Check if files exist and prompt for overwrite
    yield* checkAndPromptOverwrite(clsUri, metaUri);

    // Create class file
    const clsContent = `public class ${className} {

}`;

    // Create meta file
    const metaContent = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${apiVersion}</apiVersion>
    <status>Active</status>
</ApexClass>`;

    // Write both files - pass URI objects directly
    yield* Effect.all([fsService.writeFile(clsUri, clsContent), fsService.writeFile(metaUri, metaContent)], {
      concurrency: 'unbounded'
    });

    yield* channelService.appendToChannel(nls.localize('apex_generate_class_success'));

    // Open the class file
    yield* Effect.promise(async () => {
      const doc = await vscode.workspace.openTextDocument(clsUri);
      await vscode.window.showTextDocument(doc);
    });
  }).pipe(Effect.provide(AllServicesLayer), Effect.withSpan('createFiles'));

/** Create Apex class command */
export const createApexClass = async (params?: CreateApexClassParams): Promise<void> =>
  Effect.runPromise(commandEffect(params).pipe(Effect.provide(AllServicesLayer)));

const commandEffect = (params?: CreateApexClassParams): Effect.Effect<void, never, ExtensionProviderService> =>
  Effect.gen(function* () {
    // Get class name
    const className = params?.name ?? (yield* Effect.promise(async () => await promptForClassName()));
    if (!className) {
      return yield* Effect.succeed(undefined);
    }

    const project = yield* (yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ProjectService)
      .getSfProject;

    const [outputDir, apiVersion] = yield* Effect.all([
      Effect.suspend(() => (params?.outputDir ? Effect.succeed(params.outputDir) : promptForOutputDir(project))),
      getApiVersion(project)
    ]);

    if (!outputDir) {
      return yield* Effect.succeed(undefined); // User cancelled
    }

    // Create files
    yield* createFiles(className, outputDir, apiVersion);
    void vscode.window.showInformationMessage(nls.localize('apex_generate_class_success'));
  }).pipe(
    Effect.withSpan('createApexClassCommand'),
    Effect.provide(AllServicesLayer),
    Effect.catchAll((error: Error) => {
      if (error instanceof UserCancelledOverwriteError) {
        return Effect.void; // not an error, they meant to cancel
      }
      void vscode.window.showErrorMessage(`Failed to create Apex class: ${error.message}`);
      return Effect.succeed(undefined);
    })
  );
