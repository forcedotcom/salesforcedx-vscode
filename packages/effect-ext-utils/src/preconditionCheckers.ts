/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { getServicesApi } from './extensionProvider';
import { nls } from './messages';

const showNoProjectFound = Effect.sync(() => {
  void vscode.window.showErrorMessage(nls.localize('predicates_no_salesforce_project_found_text'));
  return false;
});

const showNoFolderOpened = Effect.sync(() => {
  void vscode.window.showErrorMessage(nls.localize('predicates_no_folder_opened_text'));
  return false;
});

const checkProject = (api: SalesforceVSCodeServicesApi) =>
  api.services.ProjectService.isSalesforceProject().pipe(
    Effect.flatMap(isProject => (isProject ? Effect.succeed(true) : showNoProjectFound))
  );

const checkProjectEffect = getServicesApi.pipe(
  Effect.flatMap(checkProject),
  Effect.catchAllCause(() => showNoFolderOpened)
);

/**
 * Precondition checker that verifies a Salesforce project is open.
 * Shows an error message and returns false if no folder is open or no sfdx-project.json is found.
 * Compatible with SfCommandlet's PreconditionChecker interface.
 */
export const sfProjectPreconditionChecker = {
  /** Effect form for callers that already own a runtime containing ProjectService. */
  checkEffect: checkProjectEffect,

  /** Promise form for consumers that don't have a runtime available. */
  check: (): Promise<boolean> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* getServicesApi;
        const runtime = yield* Layer.toRuntime(api.services.prebuiltServicesLayer);
        return yield* checkProject(api).pipe(Effect.provide(runtime));
      }).pipe(
        Effect.scoped,
        Effect.catchAllCause(() => showNoFolderOpened)
      )
    )
};
