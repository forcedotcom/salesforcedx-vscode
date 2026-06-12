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

/** The Apex language server is still indexing and not yet ready to serve requests. Transient; retried. */
export class ApexLspNotReady extends Data.TaggedError('ApexLspNotReady')<{
  readonly message: string;
}> {}

export class LLMCallFailed extends Data.TaggedError('LLMCallFailed')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** The LLM call succeeded but returned no content. Transient; retried like a failed call. */
export class LLMEmptyResponse extends Data.TaggedError('LLMEmptyResponse')<{
  readonly message: string;
}> {}

/** The shared Core model rejected the call because its monthly quota is exhausted. Not transient within
 * the month, so it is not retried; surfaced to the user instead of being swallowed as empty content. */
export class LLMRateLimited extends Data.TaggedError('LLMRateLimited')<{
  readonly message: string;
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

export class SpectralRunFailed extends Data.TaggedError('SpectralRunFailed')<{
  readonly cause: unknown;
}> {}

export class MethodNotFoundInDocSymbols extends Data.TaggedError('MethodNotFoundInDocSymbols')<{
  readonly message: string;
}> {}

export class InvalidJsonDocument extends Data.TaggedError('InvalidJsonDocument')<{
  readonly message: string;
}> {}
