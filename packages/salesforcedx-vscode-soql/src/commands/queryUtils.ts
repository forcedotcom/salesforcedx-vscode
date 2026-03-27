/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';

const API_ITEMS = [
  { api: 'REST' as const, label: nls.localize('REST_API'), description: nls.localize('REST_API_description') },
  { api: 'TOOLING' as const, label: nls.localize('tooling_API'), description: nls.localize('tooling_API_description') }
];

const ensureTextAndNormalize = Effect.fn('ensureTextAndNormalize')(function* (text: string) {
  const servicesApi = yield* getServicesApi;
  const promptService = yield* servicesApi.services.PromptService;
  const normalized = text.replace('[', '').replace(']', '').replaceAll(/(\r\n|\n)/g, ' ').trim();
  return yield* promptService.considerUndefinedAsCancellation(normalized);
});

const getQueryText = Effect.fn('getQueryText')(function* (useSelection: boolean) {
  const servicesApi = yield* getServicesApi;
  const editorService = yield* servicesApi.services.EditorService;
  return yield* editorService.getActiveEditorText(useSelection).pipe(Effect.flatMap(ensureTextAndNormalize));
});

const pickApi = Effect.fn('pickApi')(function* () {
  const servicesApi = yield* getServicesApi;
  const promptService = yield* servicesApi.services.PromptService;
  return yield* Effect.promise(() => vscode.window.showQuickPick(API_ITEMS)).pipe(
    Effect.flatMap(s => promptService.considerUndefinedAsCancellation(s)),
    Effect.map(s => s.api)
  );
});

export const getQueryAndApiInputs = Effect.fn('getQueryAndApiInputs')(function* () {
  return { query: yield* getQueryText(true), api: yield* pickApi() };
});

export const getDocumentQueryAndApiInputs = Effect.fn('getDocumentQueryAndApiInputs')(function* () {
  return { query: yield* getQueryText(false), api: yield* pickApi() };
});

export const getQueryInputsForPlan = Effect.fn('getQueryInputsForPlan')(function* () {
  return yield* getQueryText(true);
});

export const getDocumentQueryInputsForPlan = Effect.fn('getDocumentQueryInputsForPlan')(function* () {
  return yield* getQueryText(false);
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
