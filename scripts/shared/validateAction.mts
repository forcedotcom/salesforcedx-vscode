/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { validateAction as validateActionSchema } from '@action-validator/core';
import { isRecord } from 'effect/Predicate';
import { parseDocument, stringify } from 'yaml';

// @action-validator/core@0.6.0 predates node24 in GitHub's JavaScript action schema:
// https://json.schemastore.org/github-action.json#/definitions/runs-javascript/properties/using
// Normalize only this supported enum value for the stale schema; validate every other field unchanged.
export const validateAction = (source: string) => {
  const document = parseDocument(source);
  if (document.errors.length > 0) return validateActionSchema(source);
  const action: unknown = document.toJS();
  return validateActionSchema(
    isRecord(action) && isRecord(action.runs) && action.runs.using === 'node24'
      ? stringify({ ...action, runs: { ...action.runs, using: 'node20' } })
      : source
  );
};
