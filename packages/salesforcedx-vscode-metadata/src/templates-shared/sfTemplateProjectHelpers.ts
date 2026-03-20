/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';

const getApiVersionFromProject = Effect.fn('getApiVersion.fromProject')(function* (project: SfProject) {
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return String(projectJson.get<string>('sourceApiVersion'));
});

const getApiVersionFromConnection = Effect.fn('getApiVersion.fromConnection')(function* () {
  const connectionService = yield* (yield* (yield* ExtensionProviderService).getServicesApi).services.ConnectionService;
  const connection = yield* connectionService.getConnection();
  return connection.version;
});

/** Waterfall: sfdx-project.json → connection → fallback */
export const getApiVersion = Effect.fn('getApiVersion')(function* (project: SfProject) {
  return yield* getApiVersionFromProject(project).pipe(
    Effect.orElse(() => getApiVersionFromConnection()),
    Effect.catchAll(() => Effect.succeed('65.0'))
  );
});

export const promptForPackageMetadataSubdir = Effect.fn('promptForPackageMetadataSubdir')(function* (
  project: SfProject,
  segment: string,
  placeHolder: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();

  const items = project.getPackageDirectories().map(pkg => ({
    label: `${pkg.path}/main/default/${segment}`,
    description: pkg.default ? '(default)' : undefined,
    uri: Utils.joinPath(workspaceInfo.uri, pkg.path, 'main', 'default', segment)
  }));

  const selected = yield* Effect.promise(() =>
    vscode.window.showQuickPick(items, {
      placeHolder,
      matchOnDescription: true
    })
  );

  return selected?.uri;
});

type ApexTypeNameMessages = {
  empty: string;
  invalidFormat: string;
  maxLength: string;
  reservedDefault?: string;
};

const validateApexTypeName = (
  value: string,
  messages: ApexTypeNameMessages,
  options?: { forbidLowercaseDefault?: boolean; maxLength?: number }
): string | undefined => {
  const maxLen = options?.maxLength ?? APEX_CLASS_NAME_MAX_LENGTH;
  if (!value || value.trim().length === 0) return messages.empty;
  if (options?.forbidLowercaseDefault === true && value.toLowerCase() === 'default')
    return messages.reservedDefault ?? messages.empty;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return messages.invalidFormat;
  return value.length > maxLen ? messages.maxLength : undefined;
};

type PromptForApexTypeNameParams = {
  prompt: string;
  messages: ApexTypeNameMessages;
  forbidLowercaseDefault?: boolean;
};

export const promptForApexTypeName = Effect.fn('promptForApexTypeName')(function* (
  params: PromptForApexTypeNameParams
) {
  const raw = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: params.prompt,
      validateInput: (value: string) =>
        validateApexTypeName(value, params.messages, {
          forbidLowercaseDefault: params.forbidLowercaseDefault,
          maxLength: APEX_CLASS_NAME_MAX_LENGTH
        })
    })
  );
  return Option.fromNullable(raw?.trim());
});
