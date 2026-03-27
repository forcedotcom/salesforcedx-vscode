/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../messages';

export type QueryAndApiInputs = {
  query: string;
  api: 'REST' | 'TOOLING';
};

const API_ITEMS = [
  { api: 'REST' as const, label: nls.localize('REST_API'), description: nls.localize('REST_API_description') },
  { api: 'TOOLING' as const, label: nls.localize('tooling_API'), description: nls.localize('tooling_API_description') }
];

const normalizeQuery = (q: string): string =>
  q
    .replace('[', '')
    .replace(']', '')
    .replaceAll(/(\r\n|\n)/g, ' ')
    .trim();

const ensureTextAndNormalize = Effect.fn('ensureTextAndNormalize')(function* (text: string) {
  const servicesApi = yield* getServicesApi;
  const promptService = yield* servicesApi.services.PromptService;
  return yield* Effect.succeed(text).pipe(Effect.map(normalizeQuery), Effect.flatMap(promptService.considerUndefinedAsCancellation));
});

export const getQueryAndApiInputs = Effect.fn('getQueryAndApiInputs')(function* () {
  const servicesApi = yield* getServicesApi;
  const promptService = yield* servicesApi.services.PromptService;
  const editorService = yield* servicesApi.services.EditorService;

  const query = yield* editorService.getActiveEditorText(true).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation),
    // if not text, we'll prompt the user for it
    Effect.catchAll(() => Effect.void),
    Effect.flatMap(q =>
      isString(q)
        ? Effect.succeed(q)
        : Effect.promise(() =>
          vscode.window.showInputBox({
            prompt: nls.localize('parameter_gatherer_enter_soql_query')
          })
        ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation))
    ),
    Effect.map(normalizeQuery)
  );

  const api = yield* Effect.promise(() => vscode.window.showQuickPick(API_ITEMS)).pipe(
    Effect.flatMap(s => promptService.considerUndefinedAsCancellation(s)),
    Effect.map(s => s.api)
  );

  return { query, api };
});

export const getDocumentQueryAndApiInputs = Effect.fn('getDocumentQueryAndApiInputs')(function* () {
  const servicesApi = yield* getServicesApi;
  const promptService = yield* servicesApi.services.PromptService;
  const editorService = yield* servicesApi.services.EditorService;

  const query = yield* editorService.getActiveEditorText(false).pipe(Effect.flatMap(ensureTextAndNormalize));

  const api = yield* Effect.promise(() => vscode.window.showQuickPick(API_ITEMS)).pipe(
    Effect.flatMap(s => promptService.considerUndefinedAsCancellation(s)),
    Effect.map(s => s.api)
  );

  return { query, api };
});

export const getQueryInputsForPlan = Effect.fn('getQueryInputsForPlan')(function* () {
  const servicesApi = yield* getServicesApi;
  const editorService = yield* servicesApi.services.EditorService;

  return yield* editorService.getActiveEditorContext(true).pipe(
    Effect.flatMap(ctx => Schema.decodeUnknown(Schema.String)(ctx.text)),
    Effect.flatMap(ensureTextAndNormalize)
  );
});

export const getDocumentQueryInputsForPlan = Effect.fn('getDocumentQueryInputsForPlan')(function* () {
  const servicesApi = yield* getServicesApi;
  const editorService = yield* servicesApi.services.EditorService;

  return yield* editorService.getActiveEditorText(false).pipe(Effect.flatMap(ensureTextAndNormalize));
});

const ERROR_PATTERNS = [
  { match: (s: string) => s.includes('HTTP response contains html content'), key: 'data_query_error_org_expired' },
  { match: (s: string) => s.includes('INVALID_SESSION_ID'), key: 'data_query_error_session_expired' },
  { match: (s: string) => s.includes('INVALID_LOGIN'), key: 'data_query_error_invalid_login' },
  { match: (s: string) => s.includes('INSUFFICIENT_ACCESS'), key: 'data_query_error_insufficient_access' },
  { match: (s: string) => s.includes('MALFORMED_QUERY'), key: 'data_query_error_malformed_query' },
  { match: (s: string) => s.includes('INVALID_FIELD'), key: 'data_query_error_invalid_field' },
  { match: (s: string) => s.includes('INVALID_TYPE'), key: 'data_query_error_invalid_type' },
  { match: (s: string) => s.includes('connection') || s.includes('network'), key: 'data_query_error_connection' },
  { match: (s: string) => s.includes('tooling') && s.includes('not found'), key: 'data_query_error_tooling_not_found' }
] as const;

/** Formats error messages for better user experience */
export const formatErrorMessage = (error: unknown): string => {
  const errorString =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
  const matched = ERROR_PATTERNS.find(({ match }) => match(errorString));
  return matched ? nls.localize(matched.key) : nls.localize('data_query_error_message', errorString);
};
