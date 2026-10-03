/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getServicesApi } from './extensionProvider';
import { nls } from './messages';

/**
 * Precondition checker that verifies a Salesforce project is open.
 * Shows an error message and returns false if no folder is open or no sfdx-project.json is found.
 * Compatible with SfCommandlet's PreconditionChecker interface.
 */
export const sfProjectPreconditionChecker = {
  check: (): Promise<boolean> =>
    getServicesApi.pipe(
      Effect.flatMap(api =>
        api.services.ProjectService.isSalesforceProject().pipe(Effect.provide(api.services.prebuiltServicesLayer))
      ),
      Effect.flatMap(isProject =>
        isProject
          ? Effect.succeed(true)
          : Effect.sync(() => {
              void vscode.window.showErrorMessage(nls.localize('predicates_no_salesforce_project_found_text'));
              return false;
            })
      ),
      Effect.catchAllCause(() =>
        Effect.sync(() => {
          void vscode.window.showErrorMessage(nls.localize('predicates_no_folder_opened_text'));
          return false;
        })
      ),
      Effect.runPromise
    )
};
