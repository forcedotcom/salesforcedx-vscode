/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const languageClientSetupErrorFields = {
  message: Schema.String,
  cause: Schema.Unknown
};

export class ApexLanguageServerRequirementsError extends Schema.TaggedError<ApexLanguageServerRequirementsError>()(
  'ApexLanguageServerRequirementsError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageServerConfigurationError extends Schema.TaggedError<ApexLanguageServerConfigurationError>()(
  'ApexLanguageServerConfigurationError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageClientOptionsError extends Schema.TaggedError<ApexLanguageClientOptionsError>()(
  'ApexLanguageClientOptionsError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageClientCreationError extends Schema.TaggedError<ApexLanguageClientCreationError>()(
  'ApexLanguageClientCreationError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageClientOutputChannelError extends Schema.TaggedError<ApexLanguageClientOutputChannelError>()(
  'ApexLanguageClientOutputChannelError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageClientStartError extends Schema.TaggedError<ApexLanguageClientStartError>()(
  'ApexLanguageClientStartError',
  languageClientSetupErrorFields
) {}

export class ApexLanguageClientInitializationError extends Schema.TaggedError<ApexLanguageClientInitializationError>()(
  'ApexLanguageClientInitializationError',
  languageClientSetupErrorFields
) {}

export const languageClientSetupErrorMessage = (cause: unknown, unknownErrorMessage: string): string =>
  isString(cause) ? cause : isError(cause) ? cause.message : unknownErrorMessage;
