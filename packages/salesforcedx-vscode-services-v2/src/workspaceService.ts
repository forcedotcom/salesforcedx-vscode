/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { NoWorkspaceOpenError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';

export type WorkspaceInfo = {
  readonly uri: URI;
  /** Includes the file:// or virtual filesystem scheme. */
  readonly path: string;
  readonly fsPath: string;
  readonly isEmpty: boolean;
  readonly isVirtualFs: boolean;
  readonly cwd: string;
};
export type WorkspaceWithFolder = WorkspaceInfo & { readonly isEmpty: false };

export class WorkspaceService extends Context.Service<
  WorkspaceService,
  {
    readonly getWorkspaceInfo: () => Effect.Effect<WorkspaceInfo>;
    readonly getWorkspaceInfoOrThrow: () => Effect.Effect<WorkspaceWithFolder, NoWorkspaceOpenError>;
  }
>()('@salesforce/vscode-services-v2/WorkspaceService') {}
