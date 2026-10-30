/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ArtifactNamespace } from './artifactIdentity.js';
import type { FailedToResolveSfProjectError, NotInPackageDirectoryError, NoWorkspaceOpenError } from './errors.js';
import type { FileChangeEvent } from './fileChangePubSub.js';
import type { SfProject } from '@salesforce/core';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Stream from 'effect/Stream';
import type { URI } from 'vscode-uri';

export type ProjectError = NoWorkspaceOpenError | FailedToResolveSfProjectError;
type Folder = () => Effect.Effect<URI, NoWorkspaceOpenError>;
export class ProjectService extends Context.Service<
  ProjectService,
  {
    readonly isSalesforceProject: () => Effect.Effect<boolean>;
    readonly getSfProject: () => Effect.Effect<SfProject, ProjectError>;
    readonly getProjectNamespace: () => Effect.Effect<ArtifactNamespace, ProjectError>;
    readonly isArtifactNamespaceWorkspaceEligible: (
      namespace: ArtifactNamespace
    ) => Effect.Effect<boolean, ProjectError>;
    readonly projectConfigChanges: Stream.Stream<FileChangeEvent>;
    readonly isInPackageDirectories: (uri: URI) => Effect.Effect<boolean, ProjectError>;
    readonly ensureInPackageDirectories: (
      uris: readonly URI[]
    ) => Effect.Effect<void, ProjectError | NotInPackageDirectoryError>;
    readonly getSoqlMetadataPath: Folder;
    readonly getSoqlStandardObjectsPath: Folder;
    readonly getSoqlCustomObjectsPath: Folder;
    readonly getFauxClassesPath: Folder;
    readonly getFauxStandardObjectsPath: Folder;
    readonly getFauxCustomObjectsPath: Folder;
    readonly getTypingsPath: Folder;
    readonly getStateFolder: Folder;
    readonly getDebugLogsFolder: Folder;
    readonly getApexTestResultsFolder: Folder;
  }
>()('@salesforce/vscode-services-v2/ProjectService') {}
