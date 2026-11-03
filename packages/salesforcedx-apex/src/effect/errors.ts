/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError } from 'effect/Predicate';

/** Produces the serializable cause carried by public operation errors. */
export const causeMessage = (cause: unknown): string => (isError(cause) ? cause.message : String(cause));
