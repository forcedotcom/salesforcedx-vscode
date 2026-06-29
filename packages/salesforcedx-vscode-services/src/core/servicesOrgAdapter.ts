/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  ServicesOrg,
  OwnedQueryResult,
  OwnedSaveResult,
  OwnedHttpRequest,
  OwnedIdentityInfo,
  QueryOpts,
  ToolingOpt
} from '../owned/servicesOrg';

import type { Record as JSForceRecord, SaveResult, HttpRequest, HttpMethods } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';

// Helper to remove readonly from a type (safe for serialization boundaries)
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Check if a string is a valid HTTP method for jsforce
const isHttpMethod = (method: string): method is HttpMethods =>
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(method);

/** Wraps a live Connection in the services-owned ServicesOrg facade. The Connection never escapes. */
export const makeServicesOrg = (conn: Connection): ServicesOrg => ({
  apiVersion: conn.getApiVersion(),
  query: async <T extends Record<string, unknown> = Record<string, unknown>>(
    soql: string,
    opts?: QueryOpts
  ): Promise<OwnedQueryResult<T>> => {
    const api = opts?.tooling ? conn.tooling : conn;
    // jsforce query is typed as returning JSForceRecord (which is any), so we constrain T to Record<string, unknown>
    // and pass it through. The caller asserts the shape matches their expected T.
    const r = await api.query<T>(soql, { autoFetch: opts?.autoFetch, maxFetch: opts?.maxFetch });
    return { done: r.done, totalSize: r.totalSize, records: r.records };
  },
  singleRecordQuery: async <T extends Record<string, unknown> = Record<string, unknown>>(
    soql: string,
    opts?: ToolingOpt
  ): Promise<T> =>
    // Pass the generic through to jsforce - the caller asserts the shape matches their expected T
    conn.singleRecordQuery<T>(soql, { tooling: opts?.tooling }),
  create: async (sobjectType, record, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    // jsforce serializes the record to JSON and does not mutate it, so dropping readonly is safe at the serialization boundary
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mutableRecord: Mutable<typeof record> = record as Mutable<typeof record>;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const r = await api.sobject(sobjectType).create(mutableRecord as JSForceRecord);
    return toSaveResult(r);
  },
  update: async (sobjectType, record, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    // jsforce serializes the record to JSON and does not mutate it, so dropping readonly is safe at the serialization boundary.
    // The owned update accepts a plain record; Id presence is validated server-side.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mutableRecord: Mutable<typeof record> = record as Mutable<typeof record>;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const r = await api.sobject(sobjectType).update(mutableRecord as JSForceRecord & { Id: string });
    return toSaveResult(r);
  },
  delete: async (sobjectType, id, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    const r = await api.sobject(sobjectType).destroy(id);
    return toSaveResult(r);
  },
  request: async <R = unknown>(req: string | OwnedHttpRequest): Promise<R> => {
    // Bridge OwnedHttpRequest to jsforce's HttpRequest type
    if (typeof req === 'string') {
      return conn.request<R>(req);
    }
    // Validate that the method is a standard HTTP method jsforce recognizes
    if (!isHttpMethod(req.method)) {
      // This is a Promise-based API (not Effect), so throwing is the correct error mechanism
      // eslint-disable-next-line functional/no-throw-statements
      throw new Error(
        `Invalid HTTP method: ${req.method}. Must be one of: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD`
      );
    }
    // Map owned request shape to jsforce shape
    const jsforceReq: HttpRequest = {
      method: req.method,
      url: req.url,
      headers: req.headers ? { ...req.headers } : undefined,
      body: req.body
    };
    return conn.request<R>(jsforceReq);
  },
  identity: async (): Promise<OwnedIdentityInfo> => {
    const i = await conn.identity();
    return {
      userId: i.user_id,
      organizationId: i.organization_id,
      username: i.username,
      displayName: i.display_name
    };
  }
});

const toSaveResult = (r: SaveResult | SaveResult[]): OwnedSaveResult => {
  const one = Array.isArray(r) ? r[0] : r;
  if (!one) {
    return { success: false, errors: [{ statusCode: 'UNKNOWN', message: 'No result returned' }] };
  }
  return {
    id: one.id,
    success: one.success,
    errors: (one.errors ?? []).map((e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const err = e as { statusCode?: string; errorCode?: string; message?: string; fields?: string[] };
      return {
        statusCode: err.statusCode ?? err.errorCode ?? 'UNKNOWN',
        message: err.message ?? String(e),
        fields: err.fields
      };
    })
  };
};
