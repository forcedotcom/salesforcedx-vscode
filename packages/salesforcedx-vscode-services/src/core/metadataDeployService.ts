/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, type DeployResult, RequestStatus } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../vscode/fsService';
import { PromptService, UserCancellationError } from '../vscode/prompts/promptService';
import { WorkspaceService } from '../vscode/workspaceService';
import { withActiveMetadataOperationPipeline } from './activeMetadataOperationRef';
import { ConnectionService } from './connectionService';
import { dedupeMetadataChanges, MetadataChangeNotificationService } from './metadataChangeNotificationService';
import { MetadataDescribeService } from './metadataDescribeService';
import { ProjectService } from './projectService';
import { orgIdFromConnection } from './schemas/authFields';
import { isSDRSuccess, toComponentStatusChangeType } from './sdrGuards';
import { unknownToErrorCause } from './shared';
import { SourceTrackingService } from './sourceTrackingService';

export class MetadataDeployError extends Schema.TaggedError<MetadataDeployError>()('FailedToDeployMetadataError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

/** Request cancellation without interrupting polling; return the server's final outcome. */
export const pollDeploy = Effect.fn('MetadataDeployService.pollDeploy')(function* (
  startDeploy: () => ReturnType<ComponentSet['deploy']>,
  token: vscode.CancellationToken
) {
  const deployOutcome = yield* Effect.tryPromise({
    try: async () => {
      const deployOperation = await startDeploy();
      // Only send the cancel request to the server — do NOT interrupt the fiber.
      // pollStatus() resolves with the real outcome so source tracking stays correct,
      // even if the cancellation request fails or never settles.
      const requestCancellation = () => {
        deployOperation.cancel().catch(() => undefined);
      };
      const cancellation = token.onCancellationRequested(requestCancellation);
      if (token.isCancellationRequested) requestCancellation();
      return await deployOperation.pollStatus().finally(() => cancellation.dispose());
    },
    catch: e => {
      const { cause } = unknownToErrorCause(e);
      return new MetadataDeployError({
        message: `Failed to deploy metadata: ${cause.message}`,
        cause: cause.cause
      });
    }
  }).pipe(Effect.withSpan('deploy (API call)'));

  yield* Effect.annotateCurrentSpan({
    deployStatus: deployOutcome.response.status,
    fileResponseCount: deployOutcome.getFileResponses().length
  });

  // If the server honored the cancel, surface it as UserCancellationError so the
  // command pipeline silently swallows it (same UX as if cancel arrived in time).
  if (
    deployOutcome.response?.status === RequestStatus.Canceled ||
    deployOutcome.response?.status === RequestStatus.Canceling
  ) {
    return yield* new UserCancellationError();
  }

  return deployOutcome;
});

export class MetadataDeployService extends Effect.Service<MetadataDeployService>()('MetadataDeployService', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    FsService.Default,
    MetadataChangeNotificationService.Default,
    ProjectService.Default,
    PromptService.Default,
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
    const promptService = yield* PromptService;
    const notificationService = yield* MetadataChangeNotificationService;
    const metadataDescribeService = yield* MetadataDescribeService;
    const catalogRecorder = yield* OrgMetadataCatalogRecorder;

    /** Get ComponentSet of local changes for deploy */
    const getComponentSetForDeploy = Effect.fn('MetadataDeployService.getComponentSetForDeploy')(function* () {
      const localComponentSets = yield* trackingService.getLocalChangesAsComponentSet();

      yield* Effect.annotateCurrentSpan({
        componentCount: localComponentSets.map(cs => cs.size).reduce((n, size) => n + size, 0),
        componentSetCount: localComponentSets.length,
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
        [workspaceService.getWorkspaceInfoOrThrow(), Effect.annotateCurrentSpan({ componentCount: components.size })],
        { concurrency: 'unbounded' }
      );

      const connection = yield* connectionService.getConnection();
      components.projectDirectory = (yield* projectService.getSfProject()).getPath();

      // Show progress before the initial deploy request: on a busy org that request can take many seconds,
      // and the user should see "Deploying" immediately.
      const deployOutcome = yield* promptService.withProgressReporting({
        title: getDeployMessage(components),
        location: options?.progressLocation,
        cancellable: true,
        interruptOnCancel: false
      })((_, token) => pollDeploy(() => components.deploy({ usernameOrConnection: connection }), token));

      if (
        deployOutcome.response?.status === RequestStatus.Succeeded ||
        deployOutcome.response?.status === RequestStatus.SucceededPartial
      ) {
        yield* Effect.all(
          [
            trackingService
              .maybeUpdateTrackingFromDeploy(deployOutcome)
              .pipe(Effect.withSpan('MetadataDeployService.maybeUpdateTrackingFromDeploy')),
            publishDeployNotifications(deployOutcome, Option.getOrUndefined(orgIdFromConnection(connection)))
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
