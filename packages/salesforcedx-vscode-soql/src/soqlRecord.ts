/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { AnyJson, JsonMap } from '@salesforce/ts-types';
import { isRecord } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const isAnyJson = (value: unknown): value is AnyJson =>
  value === null ||
  typeof value === 'boolean' ||
  typeof value === 'number' ||
  typeof value === 'string' ||
  (Array.isArray(value)
    ? value.every(isAnyJson)
    : isRecord(value) && Object.values(value).every(item => item === undefined || isAnyJson(item)));

const isSoqlRecord = (value: unknown): value is JsonMap => isRecord(value) && isAnyJson(value);

/** Dynamic SOQL row: keeps `attributes` and child relationships. */
export const SoqlRecord = Schema.Unknown.pipe(Schema.filter(isSoqlRecord));
