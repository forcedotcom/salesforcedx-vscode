/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, type DeployResult, RequestStatus } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../vscode/fsService';
import { UserCancellationError } from '../vscode/prompts/promptService';
import { WorkspaceService } from '../vscode/workspaceService';
import { withActiveMetadataOperationPipeline } from './activeMetadataOperationRef';
import { ConnectionService } from './connectionService';
import { dedupeMetadataChanges, MetadataChangeNotificationService } from './metadataChangeNotificationService';
import { MetadataDescribeService } from './metadataDescribeService';
import { ProjectService } from './projectService';
import { isSDRSuccess, toComponentStatusChangeType } from './sdrGuards';
import { unknownToErrorCause } from './shared';
import { SourceTrackingService } from './sourceTrackingService';

export class MetadataDeployError extends Schema.TaggedError<MetadataDeployError>()('FailedToDeployMetadataError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class MetadataDeployService extends Effect.Service<MetadataDeployService>()('MetadataDeployService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    FsService.Default,
    MetadataChangeNotificationService.Default,
    ProjectService.Default,
    WorkspaceService.Default,
    SourceTrackingService.Default,
    MetadataDescribeService.Default,
    OrgMetadataCatalogRecorder.Default
  ],
  effect: Effect.gen(function* () {
    const trackingService = yield* SourceTrackingService;
    const connectionService = yield* ConnectionService;
    const fsService = yield* FsService;
    const workspaceService = yield* WorkspaceService;
    const projectService = yield* ProjectService;
    const notificationService = yield* MetadataChangeNotificationService;
    const metadataDescribeService = yield* MetadataDescribeService;
    const catalogRecorder = yield* OrgMetadataCatalogRecorder;

    /** Get ComponentSet of local changes for deploy */
    const getComponentSetForDeploy = Effect.fn('MetadataDeployService.getComponentSetForDeploy')(function* () {
      const localComponentSets = yield* trackingService.getLocalChangesAsComponentSet();

      yield* Effect.annotateCurrentSpan({
        files: localComponentSets
          .flatMap(cs => Array.from(cs.getSourceComponents()))
          .flatMap(c => [c.xml, c.content])
          .filter(isString)
          .join(','),
        projectDirectory: localComponentSets[0]?.projectDirectory
      });
      return localComponentSets[0] ?? new ComponentSet();
    });

    const publishDeployNotifications = Effect.fn('MetadataDeployService.publishDeployNotifications')(function* (
      deployOutcome: DeployResult,
      orgId: string | undefined
    ) {
      const successfulResponses = deployOutcome.getFileResponses().filter(isSDRSuccess);
      const changes = dedupeMetadataChanges(
        yield* Effect.forEach(
          successfulResponses,
          response =>
            Effect.gen(function* () {
              return {
                metadataType: response.type,
                fullName: response.fullName,
                changeType: toComponentStatusChangeType(response.state),
                fileUri: Option.fromNullable(
                  isNotUndefined(response.filePath) ? yield* fsService.toUri(response.filePath) : undefined
                )
              };
            }),
          { concurrency: 'unbounded' }
        )
      );
      if (changes.length === 0) return;
      yield* Effect.annotateCurrentSpan({
        rawFileResponseCount: successfulResponses.length,
        uniqueComponentCount: changes.length,
        affectedMetadataTypeCount: new Set(changes.map(change => change.metadataType)).size
      });
      const event = {
        ...(orgId ? { orgId } : {}),
        operation: changes.every(change => change.changeType === 'deleted') ? 'delete' : 'deploy',
        completedAt: new Date().toISOString(),
        changes: [...changes]
      } as const;
      yield* notificationService.publishOperation(event);
      if (orgId) {
        yield* metadataDescribeService.invalidateForMetadataChanges(
          orgId,
          changes.map(change => ({ xmlName: change.metadataType, fullName: change.fullName }))
        );
      }
      yield* catalogRecorder.recordOperation(event);
    });

    /** Deploy metadata to the default org */
    const deploy = Effect.fn('MetadataDeployService.deploy')(function* (
      components: ComponentSet,
      options?: { progressLocation?: vscode.ProgressLocation }
    ) {
      yield* Effect.all(
        [
          workspaceService.getWorkspaceInfoOrThrow(),
          Effect.annotateCurrentSpan({ components: components.map(c => `${c.type.name}:${c.fullName}`) })
        ],
        { concurrency: 'unbounded' }
      );

      const connection = yield* connectionService.getConnection();
      components.projectDirectory = (yield* projectService.getSfProject()).getPath();

      const deployFiber = yield* Effect.fork(
        Effect.tryPromise({
          try: async () => {
            const deployOperation = await components.deploy({
              usernameOrConnection: connection
            });

            const progressLocation = options?.progressLocation ?? vscode.ProgressLocation.Notification;
            const deployResult = await vscode.window.withProgress(
              {
                location: progressLocation,
                title: getDeployMessage(components),
                cancellable: true
              },
              async (_, token) => {
                // Only send the cancel request to the server — do NOT interrupt the fiber.
                // pollStatus() will resolve with Canceled/Canceling if the server honored it,
                // or Succeeded if the deploy completed before the cancel arrived. Either way
                // we get the real outcome and can update source tracking correctly.
                token.onCancellationRequested(() => void deployOperation.cancel());
                return await deployOperation.pollStatus();
              }
            );
            return deployResult;
          },
          catch: e => {
            const { cause } = unknownToErrorCause(e);
            return new MetadataDeployError({
              message: `Failed to deploy metadata: ${cause.message}`,
              cause: cause.cause
            });
          }
        }).pipe(Effect.withSpan('deploy (API call)'))
      );

      const deployOutcome = yield* Effect.matchCauseEffect(Fiber.join(deployFiber), {
        onFailure: cause => Effect.failCause(cause),
        onSuccess: outcome => Effect.succeed(outcome)
      });

      yield* Effect.annotateCurrentSpan({ fileResponses: deployOutcome.getFileResponses().map(r => r.filePath) });

      // If the server honored the cancel, surface it as UserCancellationError so the
      // command pipeline silently swallows it (same UX as if cancel arrived in time).
      if (
        deployOutcome.response?.status === RequestStatus.Canceled ||
        deployOutcome.response?.status === RequestStatus.Canceling
      ) {
        return yield* new UserCancellationError();
      }

      if (
        deployOutcome.response?.status === RequestStatus.Succeeded ||
        deployOutcome.response?.status === RequestStatus.SucceededPartial
      ) {
        yield* Effect.all(
          [
            trackingService
              .maybeUpdateTrackingFromDeploy(deployOutcome)
              .pipe(Effect.withSpan('MetadataDeployService.maybeUpdateTrackingFromDeploy')),
            publishDeployNotifications(deployOutcome, connection.getAuthInfoFields().orgId)
          ],
          { concurrency: 'unbounded' }
        );
      }

      return deployOutcome;
    }, withActiveMetadataOperationPipeline);

    return { deploy, getComponentSetForDeploy };
  })
}) {}

const getDeployMessage = (components: ComponentSet): string => {
  const byType = Map.groupBy(components.getSourceComponents().toArray(), c =>
    !c.isMarkedForDelete() || isUndefined(c.getDestructiveChangesType()) ? 'deploy' : 'delete'
  );
  const deployMsg = Match.value(byType.get('deploy')?.length ?? 0).pipe(
    Match.when(0, () => undefined),
    Match.when(1, () => nls.localize('deploying_one_component')),
    Match.orElse(n => nls.localize('deploying_n_components', n))
  );
  const deleteMsg = Match.value(byType.get('delete')?.length ?? 0).pipe(
    Match.when(0, () => undefined),
    Match.when(1, () => nls.localize('deleting_one_component')),
    Match.orElse(n => nls.localize('deleting_n_components', n))
  );
  return [deployMsg, deleteMsg].filter(isString).join('; ');
};
