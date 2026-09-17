/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { nls } from './messages';

const ApexLanguageClientSetupPhase = Schema.Literal(
  'requirements',
  'configuration',
  'options',
  'creation',
  'outputChannel',
  'start',
  'initialization'
);
export type ApexLanguageClientSetupPhase = Schema.Schema.Type<typeof ApexLanguageClientSetupPhase>;

export class ApexLanguageClientSetupError extends Schema.TaggedError<ApexLanguageClientSetupError>()(
  'ApexLanguageClientSetupError',
  {
    phase: ApexLanguageClientSetupPhase,
    message: Schema.String,
    cause: Schema.Unknown
  }
) {}

const languageClientSetupErrorMessage = (cause: unknown, unknownErrorMessage: string): string =>
  isString(cause) ? cause : isError(cause) ? cause.message : unknownErrorMessage;

export const languageClientSetupError = (
  phase: ApexLanguageClientSetupPhase,
  cause: unknown
): ApexLanguageClientSetupError =>
  new ApexLanguageClientSetupError({
    phase,
    message: languageClientSetupErrorMessage(cause, nls.localize('unknown_error')),
    cause
  });
