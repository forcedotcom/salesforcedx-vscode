/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
import type { OwnedMetadataMember } from './components';

export type SourceSpec =
  | { readonly kind: 'paths'; readonly uris: readonly string[] }
  | { readonly kind: 'manifest'; readonly manifestUri: string }
  | { readonly kind: 'projectDirectories'; readonly members?: readonly OwnedMetadataMember[] };

export type RetrieveOptions = { readonly ignoreConflicts?: boolean };

/** Options for deployFromSource. `ignoreConflicts` is reserved: conflict detection currently
 * runs in the consumer (metadata); this flag stabilizes the contract for a future migration. */
export type DeployFromSourceOptions = { readonly ignoreConflicts?: boolean };

export type FileResponseInfo = {
  readonly fullName: string;
  readonly type: string;
  /** SDR file state, e.g. 'Created' | 'Changed' | 'Unchanged' | 'Deleted' | 'Failed'. */
  readonly state: string;
  readonly filePath?: string;
  readonly error?: string;
  /** 1-based line of a failure, when the org reported one (drives Problems-panel range). */
  readonly lineNumber?: number;
  /** 1-based column of a failure, when the org reported one. */
  readonly columnNumber?: number;
  /** SDR problemType, e.g. 'Error' | 'Warning'. Absent for successes. */
  readonly problemType?: string;
};

/** One server-reported component failure not already present as a FileResponse failure. */
export type ComponentFailureInfo = {
  readonly fullName: string;
  readonly type: string;
  readonly problem: string;
  readonly problemType: string;
};

export type DeployOutcome = {
  readonly success: boolean;
  /** SDR RequestStatus as a string, e.g. 'Succeeded' | 'SucceededPartial' | 'Failed' | 'Canceled'. */
  readonly status: string;
  /** True when the org applied at least part of the deploy (status Succeeded or SucceededPartial). */
  readonly appliedToOrg: boolean;
  /** ISO-8601 server completedDate when present (used for result-storage timestamps). */
  readonly completedDate?: string;
  readonly fileResponses: readonly FileResponseInfo[];
  /** Server-level component failures from response.details.componentFailures, normalized. */
  readonly componentFailures: readonly ComponentFailureInfo[];
  /** Server-reported top-level error message when the deploy failed, when present. */
  readonly errorMessage?: string;
};
export type RetrievedComponentInfo = {
  readonly type: string;
  readonly fullName: string;
  readonly lastModifiedDate: string;
};

export type RetrieveOutcome = {
  readonly success: boolean;
  readonly status: string;
  readonly fileResponses: readonly FileResponseInfo[];
  /** Per-component server metadata (from fileProperties) for result-storage timestamps. */
  readonly components: readonly RetrievedComponentInfo[];
};
