/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export class ApexExtensionUnavailable extends Schema.TaggedError<ApexExtensionUnavailable>()(
  'ApexExtensionUnavailable',
  {
    message: Schema.String
  }
) {}

export class ApexLspRequestFailed extends Schema.TaggedError<ApexLspRequestFailed>()('ApexLspRequestFailed', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class OasGenerationFailed extends Schema.TaggedError<OasGenerationFailed>()('OasGenerationFailed', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class OasValidationFailed extends Schema.TaggedError<OasValidationFailed>()('OasValidationFailed', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class SpectralRunFailed extends Schema.TaggedError<SpectralRunFailed>()('SpectralRunFailed', {
  cause: Schema.Unknown
}) {}

export class OasDocumentParseFailed extends Schema.TaggedError<OasDocumentParseFailed>()('OasDocumentParseFailed', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}

export class OasUiRequestFailed extends Schema.TaggedError<OasUiRequestFailed>()('OasUiRequestFailed', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class ClassNotEligible extends Schema.TaggedError<ClassNotEligible>()('ClassNotEligible', {
  message: Schema.String
}) {}

export class ContextGatheringFailed extends Schema.TaggedError<ContextGatheringFailed>()('ContextGatheringFailed', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class ResourceUriUnresolved extends Schema.TaggedError<ResourceUriUnresolved>()('ResourceUriUnresolved', {
  message: Schema.String
}) {}
