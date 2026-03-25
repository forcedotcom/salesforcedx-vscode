/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SfProject } from '@salesforce/core/project';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { APEX_CLASS_NAME_MAX_LENGTH } from '../constants';
import { nls } from '../messages';

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

type ApexTypeNameMessages = {
  empty: string;
  invalidFormat: string;
  maxLength: string;
  reservedDefault: string;
};

const getStandardApexTypeNameMessages = () => ({
  empty: nls.localize('apex_name_empty_error'),
  invalidFormat: nls.localize('apex_name_format_error'),
  maxLength: nls.localize('apex_class_name_max_length_error', APEX_CLASS_NAME_MAX_LENGTH),
  reservedDefault: nls.localize('apex_name_cannot_be_default')
});

const validateApexTypeName = (
  value: string,
  messages: ApexTypeNameMessages,
  options?: { maxLength?: number }
): string | undefined => {
  const maxLen = options?.maxLength ?? APEX_CLASS_NAME_MAX_LENGTH;
  if (!value || value.trim().length === 0) return messages.empty;
  if (value.toLowerCase() === 'default') return messages.reservedDefault;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return messages.invalidFormat;
  return value.length > maxLen ? messages.maxLength : undefined;
};

type PromptForApexTypeNameParams = {
  prompt: string;
  messages?: ApexTypeNameMessages;
};

export const promptForApexTypeName = Effect.fn('promptForApexTypeName')(function* (
  params: PromptForApexTypeNameParams
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const messages = params.messages ?? getStandardApexTypeNameMessages();
  return yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: params.prompt,
      validateInput: (value: string) =>
        validateApexTypeName(value, messages, {
          maxLength: APEX_CLASS_NAME_MAX_LENGTH
        })
    })
  ).pipe(
    Effect.map(raw => raw?.trim()),
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
});
