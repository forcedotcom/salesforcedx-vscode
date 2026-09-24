/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileOrFolderExists } from '@salesforce/salesforcedx-utils-vscode';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import { isError, isRecord, isString } from 'effect/Predicate';
import * as path from 'node:path';
import * as vscode from 'vscode';

const SOBJECTS_DIR = 'sobjects';
const STANDARDOBJECTS_DIR = 'standardObjects';

const getSObjectsDirectory = (projectPath: string) => path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR);

const getStandardSObjectsDirectory = (projectPath: string) =>
  path.join(projectPath, '.sfdx', 'tools', SOBJECTS_DIR, STANDARDOBJECTS_DIR);

export const extractErrorMessage = (error: unknown): string => {
  if (isError(error)) return error.message;
  if (isRecord(error)) {
    if ('error' in error && isError(error.error)) return error.error.message;
    if ('message' in error && isString(error.message)) return error.message;
  }
  return String(error);
};

export const initSObjectDefinitions = Effect.fn('initSObjectDefinitions')(function* (
  projectPath: string,
  isSettingEnabled: boolean
) {
  if (!projectPath) return;

  const sobjectFolder = isSettingEnabled
    ? getSObjectsDirectory(projectPath)
    : getStandardSObjectsDirectory(projectPath);
  const refreshSource = isSettingEnabled ? 'startup' : 'startupmin';

  if (yield* Effect.promise(() => fileOrFolderExists(sobjectFolder))) return;

  yield* Effect.void.pipe(
    Effect.withSpan('sObjectRefreshNotification', { attributes: { type: refreshSource }, root: true })
  );
  yield* Effect.promise(() => vscode.commands.executeCommand('sf.internal.refreshsobjects', refreshSource)).pipe(
    Effect.tapDefect(cause => {
      const error = Cause.squash(cause);
      return Effect.fail(error).pipe(
        Effect.withSpan('initSObjectDefinitionsError', {
          attributes: {
            message: `Error: ${extractErrorMessage(error)} with sobjectRefreshStartup = ${isSettingEnabled}`
          },
          root: true
        }),
        Effect.ignore
      );
    })
  );
});
