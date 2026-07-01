/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports.
export type OwnedQueryResult<T = Record<string, unknown>> = {
  readonly done: boolean;
  readonly totalSize: number;
  readonly records: readonly T[];
};
export type OwnedSaveResult = {
  readonly id?: string;
  readonly success: boolean;
  readonly errors: readonly {
    readonly statusCode: string;
    readonly message: string;
    readonly fields?: readonly string[];
  }[];
};
export type OwnedHttpRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
};
export type OwnedIdentityInfo = {
  readonly userId: string;
  readonly organizationId: string;
  readonly username: string;
  readonly displayName?: string;
};
export type QueryOpts = { readonly tooling?: boolean; readonly autoFetch?: boolean; readonly maxFetch?: number };
export type ToolingOpt = { readonly tooling?: boolean };

export type ServicesOrg = {
  readonly apiVersion: string;
  readonly query: <T extends Record<string, unknown> = Record<string, unknown>>(
    soql: string,
    opts?: QueryOpts
  ) => Promise<OwnedQueryResult<T>>;
  readonly singleRecordQuery: <T extends Record<string, unknown> = Record<string, unknown>>(
    soql: string,
    opts?: ToolingOpt
  ) => Promise<T>;
  readonly create: (
    sobjectType: string,
    record: Readonly<Record<string, unknown>>,
    opts?: ToolingOpt
  ) => Promise<OwnedSaveResult>;
  readonly update: (
    sobjectType: string,
    record: Readonly<Record<string, unknown>>,
    opts?: ToolingOpt
  ) => Promise<OwnedSaveResult>;
  readonly delete: (sobjectType: string, id: string, opts?: ToolingOpt) => Promise<OwnedSaveResult>;
  readonly request: <R = unknown>(req: string | OwnedHttpRequest) => Promise<R>;
  readonly identity: () => Promise<OwnedIdentityInfo>;
};
