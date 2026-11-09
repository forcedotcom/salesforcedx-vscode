/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Returns Error.message (including an empty message), otherwise String(error). */
export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
