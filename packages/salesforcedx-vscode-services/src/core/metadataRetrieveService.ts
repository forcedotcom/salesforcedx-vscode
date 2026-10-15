/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import type { SfProject } from '@salesforce/core/project';
import {
  type MetadataMember,
  MetadataApiRetrieve,
  ComponentSet,
  type RegistryAccess,
  type RetrieveResult
} from '@salesforce/source-deploy-retrieve';

import * as Arr from 'effect/Array';
import * as Cause from 'effect/Cause';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Runtime from 'effect/Runtime';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { OrgMetadataCatalogRecorder } from '../orgCatalog/orgMetadataCatalogRecorder';
import { FsService } from '../vscode/fsService';
import { uriToPath } from '../vscode/paths';
import { UserCancellationError } from '../vscode/prompts/promptService';
import { WorkspaceService } from '../vscode/workspaceService';
import { withActiveMetadataOperationPipeline } from './activeMetadataOperationRef';
import {
  FailedToBuildComponentSetError,
  type NonEmptyComponentSet,
  setComponentSetProperties
} from './componentSetService';
import { ConfigService } from './configService';
import { ConnectionService } from './connectionService';
import { dedupeMetadataChanges, MetadataChangeNotificationService } from './metadataChangeNotificationService';
import { MetadataDescribeService } from './metadataDescribeService';
import { MetadataRegistryService } from './metadataRegistryService';
import { ProjectService } from './projectService';
import { orgIdFromConnection } from './schemas/authFields';
import { isSDRFailure, isSDRSuccess, toComponentStatusChangeType } from './sdrGuards';
import { unknownToErrorCause } from './shared';
import { SourceTrackingService, type SourceTrackingOptions } from './sourceTrackingService';

export class MetadataRetrieveError extends Data.TaggedError('MetadataRetrieveError')<{
  readonly cause: unknown;
}> {}

/** Scalars from a retrieve result for span attributes. Omits zipFile, ComponentSet, and file lists. */
const retrieveSpanAttributes = (retrieveOutcome: RetrieveResult) => {
  const fileResponses = retrieveOutcome.getFileResponses();
  return {
    retrieveId: retrieveOutcome.response.id,
    retrieveStatus: retrieveOutcome.response.status,
    retrieveSuccess: retrieveOutcome.response.success,
    retrieveDone: retrieveOutcome.response.done,
    componentCount: retrieveOutcome.components.size,
    fileResponseCount: fileResponses.length,
    failedFileResponseCount: fileResponses.filter(isSDRFailure).length,
    filePropertyCount: Arr.ensure(retrieveOutcome.response.fileProperties).filter(
      property => property?.type && property.fullName
    ).length,
    retrieveMessageCount: isUndefined(retrieveOutcome.response.messages)
      ? 0
      : Arr.ensure(retrieveOutcome.response.messages).length,
    zipFileLength: retrieveOutcome.response.zipFile.length
  };
};

type PerformRetrieveOperationInput = {
  componentSet: ComponentSet;
  connection: Connection;
  registryAccess: RegistryAccess;
  title: string;
  progressLocation?: vscode.ProgressLocation;
  expectedOrgId?: string;
} & (
  | {
      merge: true;
      project: SfProject;
    }
  | {
      merge: false;
      outputPath: URI;
    }
);

type MetadataRetrieveOptions = SourceTrackingOptions & { readonly expectedOrgId?: string };

const metadataXmlSuffix = '-meta.xml';

/** Match file paths SDR treats as metadata when it discovers a workspace containing an orphaned sidecar. */
const isMetadataSourceFile = (
  uri: URI,
  registryAccess: RegistryAccess,
  specialMetadataDirectories: ReadonlySet<string>
): boolean => {
  const fileName = Utils.basename(uri);
  if (fileName.endsWith(metadataXmlSuffix)) return true;

  const pathSegments = new Set(uri.path.split('/'));
  const suffix = Utils.extname(uri).slice(1);
  const isStrictFolderType = registryAccess.getStrictFolderTypes().some(type => {
    if (!pathSegments.has(type.directoryName)) return false;
    const adapter = type.strategies?.adapter;
    if (adapter === 'mixedContent' || adapter === 'bundle' || adapter === 'uiBundles') return true;
    const childSuffixes = Object.values(type.children?.types ?? {}).flatMap(child => [
      child.suffix,
      child.legacySuffix
    ]);
    return [type.suffix, type.legacySuffix, ...childSuffixes].some(
      candidateSuffix =>
        candidateSuffix !== undefined &&
        (fileName.endsWith(candidateSuffix) || fileName.endsWith(`${candidateSuffix}${metadataXmlSuffix}`))
    );
  });
  if (isStrictFolderType) return true;

  const suffixType = registryAccess.getTypeBySuffix(suffix);
  if (suffixType && pathSegments.has(suffixType.directoryName)) return true;

  return [...specialMetadataDirectories].some(directoryName => pathSegments.has(directoryName));
};

export class MetadataRetrieveService extends Effect.Service<MetadataRetrieveService>()('MetadataRetrieveService', {
  accessors: true,
  dependencies: [
    WorkspaceService.Default,
    ConnectionService.Default,
    SourceTrackingService.Default,
    MetadataRegistryService.Default,
    ProjectService.Default,
    ConfigService.Default,
    MetadataChangeNotificationService.Default,
    MetadataDescribeService.Default,
    OrgMetadataCatalogRecorder.Default,
    FsService.Default
  ],
  effect: Effect.gen(function* () {
    const workspaceService = yield* WorkspaceService;
    const connectionService = yield* ConnectionService;
    const sourceTrackingService = yield* SourceTrackingService;
    const projectService = yield* ProjectService;
    const configService = yield* ConfigService;
    const metadataRegistryService = yield* MetadataRegistryService;
    const notificationService = yield* MetadataChangeNotificationService;
    const metadataDescribeService = yield* MetadataDescribeService;
    const catalogRecorder = yield* OrgMetadataCatalogRecorder;
    const fsService = yield* FsService;

    const sourcePathsWithoutOrphanedMetadataXml = Effect.fn(
      'MetadataRetrieveService.sourcePathsWithoutOrphanedMetadataXml'
    )(function* (sourcePaths: string[], registryAccess: RegistryAccess) {
      const rootUris = yield* Effect.forEach(sourcePaths, fsService.toUri, { concurrency: 'unbounded' });
      const rootDirectories = yield* Effect.forEach(rootUris, uri => fsService.isDirectory(uri), {
        concurrency: 'unbounded'
      });
      if (!rootDirectories.every(Boolean)) return sourcePaths;

      const initialTraversal: { readonly pending: readonly URI[]; readonly files: readonly URI[] } = {
        pending: rootUris,
        files: []
      };
      const traversal = yield* Effect.iterate(initialTraversal, {
        while: current => current.pending.length > 0,
        body: current =>
          fsService.readDirectoryWithTypes(current.pending[0]!).pipe(
            Effect.map(entries => ({
              pending: [
                ...current.pending.slice(1),
                ...entries
                  .filter(entry => (entry.type & vscode.FileType.Directory) !== 0)
                  .filter(entry => Utils.basename(entry.uri) !== 'node_modules')
                  .map(entry => entry.uri)
              ],
              files: [
                ...current.files,
                ...entries.filter(entry => (entry.type & vscode.FileType.File) !== 0).map(entry => entry.uri)
              ]
            }))
          )
      });
      const fileUris = new Set(traversal.files.map(uri => uri.toString()));
      const orphanedMetadataXml = new Set(
        traversal.files
          .filter(uri => Utils.basename(uri).endsWith(metadataXmlSuffix))
          .filter(uri => {
            const fileName = Utils.basename(uri);
            const sourceName = fileName.slice(0, -metadataXmlSuffix.length);
            const suffix = sourceName.split('.').at(-1) ?? '';
            return (
              registryAccess.getTypeBySuffix(suffix)?.strategies?.adapter === 'matchingContentFile' &&
              !fileUris.has(Utils.joinPath(Utils.dirname(uri), sourceName).toString())
            );
          })
          .map(uri => uri.toString())
      );
      if (orphanedMetadataXml.size === 0) return sourcePaths;

      const specialMetadataDirectories = new Set(
        [
          'DigitalExperience',
          'ExperiencePropertyTypeBundle',
          'LightningTypeBundle',
          'ContentTypeBundle',
          'UiWidgetBundle'
        ].map(typeName => registryAccess.getTypeByName(typeName).directoryName)
      );
      const metadataFiles = traversal.files.filter(
        uri =>
          !orphanedMetadataXml.has(uri.toString()) &&
          isMetadataSourceFile(uri, registryAccess, specialMetadataDirectories)
      );
      return yield* Effect.forEach(metadataFiles, uri => fsService.uriToPath(uri), { concurrency: 'unbounded' });
    });

    const publishRetrieveNotifications = Effect.fn('MetadataRetrieveService.publishRetrieveNotifications')(function* (
      retrieveOutcome: Awaited<ReturnType<MetadataApiRetrieve['pollStatus']>>,
      expectedOrgId?: string
    ) {
      const successfulResponses = retrieveOutcome.getFileResponses().filter(isSDRSuccess);
      const changes = dedupeMetadataChanges(
        yield* Effect.forEach(
          successfulResponses,
          response =>
            Effect.gen(function* () {
              return {
                metadataType: response.type,
                fullName: response.fullName,
                changeType: toComponentStatusChangeType(response.state),
                fileUri: Option.fromNullable(response.filePath ? yield* fsService.toUri(response.filePath) : undefined)
              };
            }),
          { concurrency: 'unbounded' }
        )
      );
      if (changes.length === 0) return;
      const orgId = expectedOrgId;
      yield* Effect.annotateCurrentSpan({
        rawFileResponseCount: successfulResponses.length,
        uniqueComponentCount: changes.length,
        affectedMetadataTypeCount: new Set(changes.map(change => change.metadataType)).size
      });
      const event = {
        ...(orgId ? { orgId } : {}),
        operation: 'retrieve',
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

    const buildComponentSet = Effect.fn('MetadataRetrieveService.buildComponentSet')(function* (
      members: MetadataMember[]
    ) {
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      return yield* Effect.try({
        try: () => new ComponentSet(members, registryAccess),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new FailedToBuildComponentSetError({
            message: `Failed to build ComponentSet: ${cause.message}`,
            cause
          });
        }
      });
    });

    /** Build a ComponentSet from source paths.
     *
     * If you pass a members array, that will be used to filter the components (componentSet will only include the members you pass in)
     *
     * pass an empty array to include all components from the source paths
     *
     */
    const buildComponentSetFromSource = Effect.fn('MetadataRetrieveService.buildComponentSetFromSource')(function* (
      sourcePaths: string[],
      filterMembers: MetadataMember[]
    ) {
      yield* Effect.annotateCurrentSpan({
        filterMemberCount: filterMembers.length,
        sourcePathCount: sourcePaths.length
      });
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      const include = filterMembers.length > 0 ? yield* buildComponentSet(filterMembers) : undefined;
      const resolvedSourcePaths = yield* sourcePathsWithoutOrphanedMetadataXml(sourcePaths, registryAccess);
      const cs = yield* Effect.try({
        try: () => ComponentSet.fromSource({ fsPaths: resolvedSourcePaths, include, registry: registryAccess }),
        catch: e => {
          const { cause } = unknownToErrorCause(e);
          return new FailedToBuildComponentSetError({
            message: `Failed to build ComponentSet from source: ${cause.message}`,
            cause
          });
        }
      });
      yield* Effect.annotateCurrentSpan({ size: cs.size });
      return cs;
    });

    /** Shared helper to perform the actual retrieve operation */
    const performRetrieveOperation = Effect.fn('MetadataRetrieveService.performRetrieveOperation')(function* (
      input: PerformRetrieveOperationInput
    ) {
      const output = input.merge ? input.project.getDefaultPackage().fullPath : uriToPath(input.outputPath);
      yield* Effect.annotateCurrentSpan({ output });
      const runtime = yield* Effect.runtime();
      const retrieveFiber = yield* Effect.tryPromise({
        try: async () => {
          const retrieveOperation = new MetadataApiRetrieve({
            usernameOrConnection: input.connection,
            components: input.componentSet,
            output,
            format: 'source',
            merge: input.merge,
            registry: input.registryAccess
          });

          const progressLocation = input.progressLocation ?? vscode.ProgressLocation.Notification;
          const retrieveResult = await vscode.window.withProgress(
            {
              location: progressLocation,
              title: input.title,
              cancellable: true
            },
            async (_, token) => {
              token.onCancellationRequested(async () => {
                await retrieveOperation.cancel();
                await Fiber.interrupt(retrieveFiber).pipe(Runtime.runPromise(runtime));
              });
              await retrieveOperation.start();
              return await retrieveOperation.pollStatus();
            }
          );
          return retrieveResult;
        },
        catch: e => new MetadataRetrieveError(unknownToErrorCause(e))
      }).pipe(
        Effect.tapError(e => e.pipe(Cause.fail, Effect.logError)),
        Effect.withSpan('retrieve (API call)'),
        Effect.fork
      );

      const retrieveOutcome = yield* Effect.matchCauseEffect(Fiber.join(retrieveFiber), {
        onFailure: cause =>
          Cause.isInterruptedOnly(cause)
            ? Effect.fail<UserCancellationError | MetadataRetrieveError>(new UserCancellationError())
            : Effect.failCause(cause),
        onSuccess: outcome => Effect.succeed(outcome)
      });

      yield* Effect.annotateCurrentSpan(retrieveSpanAttributes(retrieveOutcome));
      const orgId = input.expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(input.connection));
      // only do tracking in the case where we retrieve to project
      if (input.merge) {
        yield* Effect.all(
          [
            sourceTrackingService
              .maybeUpdateTrackingFromRetrieve(retrieveOutcome, input.expectedOrgId)
              .pipe(Effect.withSpan('MetadataRetrieveService.maybeUpdateTrackingFromRetrieve')),
            publishRetrieveNotifications(retrieveOutcome, input.expectedOrgId)
          ],
          { concurrency: 'unbounded', discard: true }
        );
      } else if (orgId) {
        const fileProperties = Array.isArray(retrieveOutcome.response.fileProperties)
          ? retrieveOutcome.response.fileProperties
          : [retrieveOutcome.response.fileProperties];
        const observationsByIdentity = fileProperties.reduce(
          (byIdentity, property) =>
            property?.type && property.fullName
              ? byIdentity.set(`${property.type}\0${property.fullName}`, {
                  type: property.type,
                  fullName: property.fullName,
                  ...(property.lastModifiedDate ? { lastModifiedDate: property.lastModifiedDate } : {})
                })
              : byIdentity,
          new Map<string, { readonly type: string; readonly fullName: string; readonly lastModifiedDate?: string }>()
        );
        retrieveOutcome
          .getFileResponses()
          .filter(isSDRSuccess)
          .forEach(response => {
            const identity = `${response.type}\0${response.fullName}`;
            if (!observationsByIdentity.has(identity)) {
              observationsByIdentity.set(identity, { type: response.type, fullName: response.fullName });
            }
          });
        const observations = [...observationsByIdentity.values()];
        yield* catalogRecorder.recordRemoteComponents(orgId, 'metadata-api', observations);
      }

      return retrieveOutcome;
    });

    /** Retrieve one or more metadata components from the default org. */
    const retrieve = Effect.fn('MetadataRetrieveService.retrieve')(function* (
      members: MetadataMember[],
      options?: MetadataRetrieveOptions & { progressLocation?: vscode.ProgressLocation }
    ) {
      const [connection, project, registryAccess, componentSet, hasTracking] = yield* Effect.all(
        [
          options?.expectedOrgId
            ? connectionService.getConnectionForOrg(options.expectedOrgId)
            : connectionService.getConnection(),
          projectService.getSfProject(),
          metadataRegistryService.getRegistryAccess(),
          buildComponentSet(members),
          sourceTrackingService.hasTracking(options?.expectedOrgId),
          workspaceService.getWorkspaceInfoOrThrow()
        ],
        { concurrency: 'unbounded' }
      );

      if (hasTracking && !options?.ignoreConflicts) {
        yield* sourceTrackingService.checkConflicts(options?.expectedOrgId);
      }

      const title = `Retrieving ${members.map(m => `${m.type}: ${m.fullName === '*' ? 'all' : m.fullName}`).join(', ')}`;
      return yield* performRetrieveOperation({
        componentSet,
        connection,
        registryAccess,
        title,
        progressLocation: options?.progressLocation,
        merge: true,
        project,
        expectedOrgId: options?.expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection))
      });
    }, withActiveMetadataOperationPipeline);

    /** Retrieve metadata using a ComponentSet directly.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSet = Effect.fn('MetadataRetrieveService.retrieveComponentSet')(function* (
      components: ComponentSet,
      options?: MetadataRetrieveOptions & { progressLocation?: vscode.ProgressLocation }
    ) {
      yield* Effect.annotateCurrentSpan({ components: components.size });
      const registryAccess = yield* metadataRegistryService.getRegistryAccess();
      const [connection, project, configAggregator, , hasTracking] = yield* Effect.all(
        [
          options?.expectedOrgId
            ? connectionService.getConnectionForOrg(options.expectedOrgId)
            : connectionService.getConnection(),
          projectService.getSfProject(),
          configService.getConfigAggregator(),
          workspaceService.getWorkspaceInfoOrThrow(),
          sourceTrackingService.hasTracking(options?.expectedOrgId)
        ],
        { concurrency: 'unbounded' }
      );

      yield* setComponentSetProperties({ componentSet: components, project, configAggregator });
      if (hasTracking && !options?.ignoreConflicts) {
        yield* sourceTrackingService.checkConflicts(options?.expectedOrgId);
      }

      const title = `Retrieving ${components.size} component${components.size === 1 ? '' : 's'}`;
      return yield* performRetrieveOperation({
        componentSet: components,
        connection,
        registryAccess,
        title,
        progressLocation: options?.progressLocation,
        merge: true,
        project,
        expectedOrgId: options?.expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection))
      });
    }, withActiveMetadataOperationPipeline);

    /** Retrieve metadata using a ComponentSet directly to a custom output directory.
     * Sets project directory and API versions on the ComponentSet before retrieving.
     */
    const retrieveComponentSetToDirectory = Effect.fn('MetadataRetrieveService.retrieveComponentSetToDirectory')(
      function* (
        components: NonEmptyComponentSet,
        outputPath: URI,
        options?: { progressLocation?: vscode.ProgressLocation; expectedOrgId?: string }
      ) {
        const expectedOrgId = options?.expectedOrgId;
        const registryAccess = yield* metadataRegistryService.getRegistryAccess();
        const [connection, project, configAggregator] = yield* Effect.all(
          [
            expectedOrgId ? connectionService.getConnectionForOrg(expectedOrgId) : connectionService.getConnection(),
            projectService.getSfProject(),
            configService.getConfigAggregator(),
            workspaceService.getWorkspaceInfoOrThrow()
          ],
          { concurrency: 'unbounded' }
        );
        // Set API versions and use output directory as projectDirectory when merge is false
        // This ensures components resolved from the output directory have correct paths
        yield* setComponentSetProperties({
          componentSet: components,
          configAggregator,
          project,
          directory: outputPath
        });
        return yield* performRetrieveOperation({
          componentSet: components,
          connection,
          registryAccess,
          title: `Retrieving ${components.size} component${components.size === 1 ? '' : 's'} for diff`,
          progressLocation: options?.progressLocation,
          merge: false,
          outputPath,
          expectedOrgId: expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection))
        });
      }
    );

    return {
      retrieve,
      retrieveComponentSet,
      retrieveComponentSetToDirectory,
      buildComponentSet,
      buildComponentSetFromSource
    };
  })
}) {}
