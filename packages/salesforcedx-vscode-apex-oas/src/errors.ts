/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';

export class ApexExtensionUnavailable extends Data.TaggedError('ApexExtensionUnavailable')<{
  readonly message: string;
}> {}

export class ApexLspRequestFailed extends Data.TaggedError('ApexLspRequestFailed')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class LLMCallFailed extends Data.TaggedError('LLMCallFailed')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class LLMRetriesExhausted extends Data.TaggedError('LLMRetriesExhausted')<{
  readonly message: string;
}> {}

export class OasGenerationFailed extends Data.TaggedError('OasGenerationFailed')<{
  readonly message: string;
}> {}

export class OasValidationFailed extends Data.TaggedError('OasValidationFailed')<{
  readonly message: string;
}> {}

export class MethodNotFoundInDocSymbols extends Data.TaggedError('MethodNotFoundInDocSymbols')<{
  readonly message: string;
}> {}

export class InvalidJsonDocument extends Data.TaggedError('InvalidJsonDocument')<{
  readonly message: string;
}> {}
