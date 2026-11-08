/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ComponentSet, RequestStatus, type DeployResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { deployAndUpdateTracking } from '../../../src/core/metadataDeployService';
import { SourceTrackingService } from '../../../src/core/sourceTrackingService';
import { UserCancellationError } from '../../../src/vscode/prompts/promptService';

describe('deployAndUpdateTracking cancellation', () => {
  let tokenSource: vscode.CancellationTokenSource;

  beforeEach(() => {
    tokenSource = new vscode.CancellationTokenSource();
  });

  afterEach(() => tokenSource.dispose());

  const cancelProgress = () => {
    // The shared VS Code mock fires listeners but does not set this flag.
    Object.defineProperty(tokenSource.token, 'isCancellationRequested', { value: true });
    tokenSource.cancel();
  };

  describe.each(['before polling', 'during polling'])('Cancel %s', timing => {
    describe.each([
      { request: 'succeeds', cancelRequest: async () => undefined },
      {
        request: 'rejects',
        cancelRequest: async () => {
          throw new Error('cancel failed');
        }
      },
      { request: 'stalls', cancelRequest: () => new Promise<void>(() => undefined) }
    ])('cancel request $request', ({ cancelRequest }) => {
      it.each([
        RequestStatus.Succeeded,
        RequestStatus.SucceededPartial,
        RequestStatus.Canceled,
        RequestStatus.Canceling,
        RequestStatus.Failed
      ])('uses server outcome %s to decide whether to update tracking', async status => {
        const { promise: deployRequest, resolve: finishStart } =
          Promise.withResolvers<Awaited<ReturnType<ComponentSet['deploy']>>>();
        const { promise: starting, resolve: startedDeploy } = Promise.withResolvers<void>();
        const { promise: serverResult, resolve: finishDeploy } = Promise.withResolvers<DeployResult>();
        const { promise: polling, resolve: startedPolling } = Promise.withResolvers<void>();
        const cancel = vi.fn(cancelRequest);
        const updateTracking = vi.fn(() => Effect.void);
        const result = deployAndUpdateTracking(() => {
          startedDeploy();
          return deployRequest;
        }, tokenSource.token).pipe(
          Effect.provideService(SourceTrackingService, { maybeUpdateTrackingFromDeploy: updateTracking } as never),
          Effect.runPromiseExit
        );
        await starting;
        if (timing === 'before polling') cancelProgress();
        finishStart({
          cancel,
          pollStatus: () => {
            startedPolling();
            return serverResult;
          }
        } as never);
        await polling;
        if (timing === 'during polling') cancelProgress();
        expect(cancel).toHaveBeenCalledOnce();
        expect(updateTracking).not.toHaveBeenCalled();
        const outcome = { response: { status }, getFileResponses: () => [] } as unknown as DeployResult;
        finishDeploy(outcome);
        const exit = await result;
        if (status === RequestStatus.Canceled || status === RequestStatus.Canceling) {
          expect(exit).toEqual(Exit.fail(new UserCancellationError()));
        } else {
          expect(exit).toEqual(Exit.succeed(outcome));
        }
        if (status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial) {
          expect(updateTracking).toHaveBeenCalledExactlyOnceWith(outcome);
        } else {
          expect(updateTracking).not.toHaveBeenCalled();
        }
      });
    });
  });
});
