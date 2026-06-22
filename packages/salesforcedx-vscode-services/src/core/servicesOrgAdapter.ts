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

import type { Record as JSForceRecord, SaveResult } from '@jsforce/jsforce-node';
import type { Connection } from '@salesforce/core';

/** Wraps a live Connection in the services-owned ServicesOrg facade. The Connection never escapes. */
export const makeServicesOrg = (conn: Connection): ServicesOrg => ({
  apiVersion: conn.getApiVersion(),
  query: async <T = Record<string, unknown>>(soql: string, opts?: QueryOpts): Promise<OwnedQueryResult<T>> => {
    const api = opts?.tooling ? conn.tooling : conn;
    const r = await api.query<JSForceRecord>(soql, { autoFetch: opts?.autoFetch, maxFetch: opts?.maxFetch });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { done: r.done, totalSize: r.totalSize, records: r.records as unknown as readonly T[] };
  },
  singleRecordQuery: async <T = Record<string, unknown>>(soql: string, opts?: ToolingOpt): Promise<T> => {
    const result = await conn.singleRecordQuery<JSForceRecord>(soql, { tooling: opts?.tooling });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return result as T;
  },
  create: async (sobjectType, record, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const r = await api.sobject(sobjectType).create(record as JSForceRecord);
    return toSaveResult(r);
  },
  update: async (sobjectType, record, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const r = await api.sobject(sobjectType).update(record as JSForceRecord & { Id: string });
    return toSaveResult(r);
  },
  delete: async (sobjectType, id, opts?: ToolingOpt): Promise<OwnedSaveResult> => {
    const api = opts?.tooling ? conn.tooling : conn;
    const r = await api.sobject(sobjectType).destroy(id);
    return toSaveResult(r);
  },
  request: async <R>(req: string | OwnedHttpRequest): Promise<R> =>
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    conn.request<R>(req as never),
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
      const err = e as { statusCode?: string; message?: string; fields?: string[] };
      return { statusCode: err.statusCode ?? 'UNKNOWN', message: err.message ?? String(e), fields: err.fields };
    })
  };
};
