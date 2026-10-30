/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataOperationOrgSnapshot } from './metadataOperationOrg.js';
import type { DeployResult, RetrieveResult } from '@salesforce/source-deploy-retrieve';
import {
  InactiveOrgOperationError,
  MetadataChangeNotificationService,
  dedupeMetadataChanges,
  isSDRSuccess,
  toComponentStatusChangeType,
  type MetadataOperationEvent
} from '@salesforce/vscode-services-v2';
import * as Context from 'effect/Context';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { ConnectionHost } from './connectionHost.js';
import { MetadataDescribeInvalidation } from './metadataDescribeService.js';
import { OrgCatalogState } from './orgCatalog/orgCatalogState.js';
import { OrgMetadataCatalogRecorder } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';
import { toUri } from './uriUtils.js';

const makeMetadataOperationNotifications = Effect.gen(function* () {
  const notifications = yield* MetadataChangeNotificationService;
  const descriptions = yield* MetadataDescribeInvalidation;
  const recorder = yield* OrgMetadataCatalogRecorder;
  const state = yield* OrgCatalogState;
  const orgChanges = yield* OrgChanges;
  const host = yield* ConnectionHost;
  const operations = yield* ServiceOperations;
  const publish = Effect.fn('MetadataOperationNotifications.publish')(function* (
    result: Pick<DeployResult | RetrieveResult, 'getFileResponses'>,
    org: MetadataOperationOrgSnapshot,
    operation: 'deploy' | 'retrieve'
  ) {
    const responses = result.getFileResponses().filter(isSDRSuccess);
    const changes = dedupeMetadataChanges(
      responses.map(response => ({
        metadataType: response.type,
        fullName: response.fullName,
        changeType: toComponentStatusChangeType(response.state),
        fileUri: response.filePath ? Option.some(toUri(response.filePath)) : Option.none()
      }))
    );
    if (changes.length === 0) return;
    yield* Effect.annotateCurrentSpan({
      rawFileResponseCount: responses.length,
      uniqueComponentCount: changes.length,
      affectedMetadataTypeCount: new Set(changes.map(change => change.metadataType)).size
    });
    const event: MetadataOperationEvent = {
      orgId: org.orgId,
      operation:
        operation === 'deploy' && changes.every(change => change.changeType === 'deleted') ? 'delete' : operation,
      completedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
      changes
    };
    const changedError = new InactiveOrgOperationError({
      expectedOrgId: org.orgId,
      message: host.messages.orgChanged(org.orgId)
    });
    if (operation === 'retrieve')
      yield* state.withOrgInvalidation(org.orgId, 'workspace', invalidate =>
        orgChanges.commitIfCurrent(org.orgGeneration, changedError, invalidate)
      );
    // These services own their permits/commits. Never put either call under an outer org commit.
    yield* descriptions.invalidateForTracking(
      org.orgId,
      org.orgGeneration,
      changes.map(change => ({
        xmlName: change.metadataType,
        fullName: change.fullName
      }))
    );
    yield* recorder.recordOperation(event, org.orgGeneration);
    yield* orgChanges.commitIfCurrent(org.orgGeneration, changedError, notifications.publishOperation(event));
  }, operations.run);
  yield* Effect.addFinalizer(() => operations.close);
  return { publish };
});

/** Publish only after the captured operation's tracking and both cache invalidations settle. */
export class MetadataOperationNotifications extends Context.Service<
  MetadataOperationNotifications,
  Effect.Success<typeof makeMetadataOperationNotifications>
>()('@salesforce/vscode-services-v4-implementation/MetadataOperationNotifications') {}
export const MetadataOperationNotificationsLayer = Layer.effect(
  MetadataOperationNotifications,
  makeMetadataOperationNotifications
).pipe(Layer.provideMerge(ServiceOperationsLayer));
