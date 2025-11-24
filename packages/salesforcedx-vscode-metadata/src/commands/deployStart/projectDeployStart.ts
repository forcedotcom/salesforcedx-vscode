/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { AllServicesLayer, ExtensionProviderService } from '../../services/extensionProvider';
import { COMPONENT_STATUS_FAILED } from './constants';
import { formatDeployOutput } from './formatDeployOutput';

/** Deploy local changes to the default org */
export const projectDeployStart = async (ignoreConflicts = false): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* Effect.annotateCurrentSpan({ ignoreConflicts });
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const channelService = yield* api.services.ChannelService;
      const deployService = yield* api.services.MetadataDeployService;

      // Get ComponentSet of local changes
      const componentSet = yield* deployService.getComponentSetForDeploy({ ignoreConflicts });

      if (componentSet.size === 0) {
        yield* Effect.all(
          [
            channelService.appendToChannel('No local changes to deploy'),
            Effect.promise(() => vscode.window.showInformationMessage('No local changes to deploy'))
          ],
          { concurrency: 'unbounded' }
        );
        return;
      }

      yield* channelService.appendToChannel(
        `Deploying ${componentSet.size} component${componentSet.size === 1 ? '' : 's'}...`
      );

      // Deploy the components
      const result = yield* deployService.deploy(componentSet);

      // Handle cancellation
      if (typeof result === 'string') {
        yield* channelService.appendToChannel('Deploy cancelled by user');
        return;
      }

      yield* channelService.appendToChannel(formatDeployOutput(result));

      if (result.getFileResponses().some(r => String(r.state) === COMPONENT_STATUS_FAILED)) {
        void vscode.window.showErrorMessage('Deploy completed with errors. Check output for details.');
      }
    }).pipe(Effect.withSpan('projectDeployStart'), Effect.provide(AllServicesLayer))
  );
