/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet, RequestStatus } from '@salesforce/source-deploy-retrieve';
import {
  ActiveMetadataOperationRef,
  MetadataDeployError,
  MetadataDeployService,
  ProjectService,
  SourceTrackingService,
  UserCancellationError,
  WorkspaceService
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { isUndefined } from 'effect/Predicate';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { unknownToErrorCause } from './errorCause.js';
import { MetadataOperationMessages } from './metadataOperationMessages.js';
import { MetadataOperationNotifications } from './metadataOperationNotifications.js';
import { MetadataOperationOrg, MetadataOperationOrgLayer } from './metadataOperationOrg.js';
import { performNativeMetadataOperation } from './nativeMetadataOperation.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { SourceTrackingResultUpdates } from './sourceTrackingService.js';

const deployFailure = (cause: unknown) => {
  const error = unknownToErrorCause(cause);
  return new MetadataDeployError({ message: `Failed to deploy metadata: ${error.message}`, cause });
};

export const MetadataDeployServiceLayer = Layer.effect(
  MetadataDeployService,
  Effect.gen(function* () {
    const orgs = yield* MetadataOperationOrg;
    const projects = yield* ProjectService;
    const workspace = yield* WorkspaceService;
    const tracking = yield* SourceTrackingService;
    const results = yield* SourceTrackingResultUpdates;
    const notifications = yield* MetadataOperationNotifications;
    const messages = yield* MetadataOperationMessages;
    const active = yield* ActiveMetadataOperationRef;
    const operations = yield* ServiceOperations;
    const getComponentSetForDeploy = Effect.fn('MetadataDeployService.getComponentSetForDeploy')(function* () {
      const local = yield* tracking.getLocalChangesAsComponentSet();
      yield* Effect.annotateCurrentSpan({
        componentCount: local.reduce((count, components) => count + components.size, 0),
        componentSetCount: local.length,
        projectDirectory: local[0]?.projectDirectory
      });
      return local[0] ?? new ComponentSet();
    }, operations.run);
    const deploy = Effect.fn('MetadataDeployService.deploy')(
      (components: ComponentSet, options?: { readonly progressLocation?: vscode.ProgressLocation }) =>
        Effect.acquireUseRelease(
          SubscriptionRef.update(active, count => count + 1),
          () =>
            Effect.gen(function* () {
              yield* workspace.getWorkspaceInfoOrThrow();
              const org = yield* orgs.capture();
              components.projectDirectory = (yield* projects.getSfProject()).getPath();
              yield* Effect.annotateCurrentSpan({ componentCount: components.size });
              const byType = Map.groupBy(components.getSourceComponents().toArray(), component =>
                !component.isMarkedForDelete() || isUndefined(component.getDestructiveChangesType())
                  ? 'deploy'
                  : 'delete'
              );
              const deployCount = byType.get('deploy')?.length ?? 0;
              const deleteCount = byType.get('delete')?.length ?? 0;
              const title = [
                ...(deployCount ? [messages.deploying(deployCount)] : []),
                ...(deleteCount ? [messages.deleting(deleteCount)] : [])
              ].join('; ');
              yield* orgs.validate(org);
              return yield* performNativeMetadataOperation(
                () => components.deploy({ usernameOrConnection: org.connection }),
                {
                  title,
                  location: options?.progressLocation ?? vscode.ProgressLocation.Notification,
                  cancellable: true
                },
                deployFailure,
                completed =>
                  Effect.gen(function* () {
                    const applied = yield* Effect.gen(function* () {
                      const outcome = yield* completed.result;
                      yield* Effect.annotateCurrentSpan({
                        deployStatus: outcome.response.status,
                        fileResponseCount: outcome.getFileResponses().length
                      });
                      if (
                        outcome.response.status === RequestStatus.Canceled ||
                        outcome.response.status === RequestStatus.Canceling
                      )
                        return yield* new UserCancellationError({ message: 'User cancelled deploy' });
                      if (
                        outcome.response.status === RequestStatus.Succeeded ||
                        outcome.response.status === RequestStatus.SucceededPartial
                      ) {
                        yield* orgs.validate(org);
                        yield* results.maybeUpdateTrackingFromDeploy(outcome, org);
                        yield* notifications.publish(outcome, org, 'deploy');
                      }
                      yield* orgs.validate(org);
                      return outcome;
                    }).pipe(Effect.exit);
                    // Successful/partial outcomes must reach tracking even when cancel() rejected. Report both failures afterward.
                    return yield* Exit.isFailure(completed.cancellation)
                      ? Effect.failCause(
                          Exit.isFailure(applied)
                            ? Cause.combine(applied.cause, completed.cancellation.cause)
                            : completed.cancellation.cause
                        )
                      : applied;
                  })
              );
            }),
          () => SubscriptionRef.update(active, count => count - 1)
        ),
      operations.run
    );
    yield* Effect.addFinalizer(() => operations.close);
    return MetadataDeployService.of({ deploy, getComponentSetForDeploy });
  })
).pipe(Layer.provideMerge(MetadataOperationOrgLayer), Layer.provideMerge(ServiceOperationsLayer));
