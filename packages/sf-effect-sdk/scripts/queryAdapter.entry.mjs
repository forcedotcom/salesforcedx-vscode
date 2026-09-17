import { createSalesforceClient, restRequest as sdkRestRequest } from '@sf-effect-source/promise';
import { runClientEffect } from '@sf-effect-source/promise-runtime';
import { query as sdkQuery } from '@sf-effect-source/query';
import * as Effect from '@sf-effect-source/effect';
import * as Schema from '@sf-effect-source/schema';
import * as Stream from '@sf-effect-source/stream';

const schemaForFieldPaths = fieldPaths => {
  const root = {};
  for (const path of fieldPaths) {
    let node = root;
    for (const part of path.split('.')) node = node[part] ??= {};
  }
  const toSchema = node =>
    Schema.Struct(
      Object.fromEntries(
        Object.entries(node).map(([name, child]) => [
          name,
          Schema.optional(Object.keys(child).length === 0 ? Schema.Unknown : toSchema(child))
        ])
      )
    );
  return toSchema(root);
};

export { createSalesforceClient };
export const query = ({ client, ...options }, recordFieldPaths) =>
  runClientEffect(client, session =>
    sdkQuery({ ...options, session }, schemaForFieldPaths(recordFieldPaths)).pipe(
      Effect.map(({ totalSize, records }) => ({ totalSize, records: Stream.toAsyncIterable(records) }))
    )
  );
export const restRequest = options => sdkRestRequest(options, Schema.Unknown);
