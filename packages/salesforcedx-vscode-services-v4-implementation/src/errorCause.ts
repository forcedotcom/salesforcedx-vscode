/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isError } from 'effect/Predicate';

/** Keep SDK/host causes and their messages consistent with the services error contract. */
export const unknownToErrorCause = (error: unknown): { cause: Error; message: string } => {
  const cause = isError(error) ? error : new Error(String(error));
  return { cause, message: cause.message };
};

/** Native Node/memfs and VS Code provider absence; permissions/unavailable errors are not absence. */
export const isFileNotFound = (cause: Error): boolean =>
  'code' in cause && (cause.code === 'ENOENT' || cause.code === 'FileNotFound');
