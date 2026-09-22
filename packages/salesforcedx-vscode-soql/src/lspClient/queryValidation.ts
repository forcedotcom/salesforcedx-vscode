/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { QueryValidationFeature } from '@salesforce/soql-language-server';
import * as Effect from 'effect/Effect';
import { isRecord, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import type { BaseLanguageClient as LanguageClient } from 'vscode-languageclient';
import { SOQL_CONFIGURATION_NAME, SOQL_VALIDATION_CONFIG } from '../constants';
import { runQuery } from '../editor/queryRunner';
import { getSoqlRuntime } from '../services/extensionProvider';

export const init = (client: LanguageClient): LanguageClient => {
  const validationFeature = new QueryValidationFeature();
  // class exists in soql-language-server, but does not match vscode "Feature" interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  client.registerFeature(validationFeature as any);
  return client;
};

class SoqlQueryRequestError extends Schema.TaggedError<SoqlQueryRequestError>()('SoqlQueryRequestError', {
  message: Schema.String,
  errorName: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.Unknown)
}) {}

const soqlQueryRequestError = (cause: unknown) => {
  const record = isRecord(cause) ? cause : undefined;
  const errorName = isString(record?.name) ? record.name : undefined;
  const errorCode = record?.errorCode;
  return new SoqlQueryRequestError({
    message: isString(record?.message) ? record.message : String(cause),
    ...(isUndefined(errorName) ? {} : { errorName }),
    ...(isUndefined(errorCode) ? {} : { errorCode })
  });
};

const handleRunQuery = Effect.fn('queryValidation.handleRunQuery')(function* (queryText: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const enabled = yield* (yield* api.services.SettingsService).getValue<boolean>(
    SOQL_CONFIGURATION_NAME,
    SOQL_VALIDATION_CONFIG
  );

  return enabled
    ? yield* (yield* api.services.ConnectionService).getConnection().pipe(
        Effect.mapError(soqlQueryRequestError),
        Effect.flatMap(conn =>
          Effect.tryPromise({
            // Custom catch keeps jsforce `errorCode`; tryPromise's default wraps the rejection in UnknownException.
            try: () => runQuery(conn)(queryText, { showErrors: false }),
            catch: soqlQueryRequestError
          })
        ),
        Effect.match({
          // NOTE: The return value must be serializable, for JSON-RPC.
          // Thus we cannot include the exception object as-is
          onFailure: cause => ({
            error: { name: cause.errorName, errorCode: cause.errorCode, message: cause.message }
          }),
          onSuccess: result => ({ result })
        })
      )
    : { done: true as const, totalSize: 0, records: [] as const };
});

/** Registers the `runQuery` handler for the life of the extension scope. */
export const afterStart = Effect.fn('queryValidation.afterStart')(function* (client: LanguageClient) {
  // Effect.async resumes once (node_modules/effect/src/Effect.ts). onRequest fires per JSON-RPC call
  // and must return that call's Thenable, so the subscription is a scoped resource, not an async effect.
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      client.onRequest('runQuery', (queryText: string) => handleRunQuery(queryText).pipe(getSoqlRuntime().runPromise))
    ),
    disposable => Effect.sync(() => disposable.dispose())
  );
});
