/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
export type SourceSpec =
  | { readonly kind: 'paths'; readonly uris: readonly string[] }
  | { readonly kind: 'manifest'; readonly manifestUri: string }
  | { readonly kind: 'projectDirectories' };

export type DeployOptions = { readonly ignoreConflicts?: boolean; readonly checkOnly?: boolean };
export type RetrieveOptions = { readonly ignoreConflicts?: boolean; readonly outputDir?: string };

export type FileResponseInfo = {
  readonly fullName: string;
  readonly type: string;
  readonly state: string;
  readonly filePath?: string;
  readonly error?: string;
};
export type DeployOutcome = {
  readonly success: boolean;
  readonly status: string;
  readonly fileResponses: readonly FileResponseInfo[];
};
export type RetrieveOutcome = {
  readonly success: boolean;
  readonly status: string;
  readonly fileResponses: readonly FileResponseInfo[];
};
