/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { HashableUri } from '@salesforce/vscode-services/v2';
import { isObject, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

/** Cross-bundle safe: HashableUri from services extension fails instanceof URI in metadata bundle. Use structural check. */
const isHashableUri = (u: unknown): u is HashableUri => {
  if (!isObject(u) || !('uri' in u)) return false;
  const inner = u.uri;
  return isObject(inner) && isString(inner.scheme);
};

const HashableUriSchema = Schema.declare<HashableUri>(isHashableUri);

const DiffFilePairSchema = Schema.Struct({
  localUri: HashableUriSchema,
  remoteUri: HashableUriSchema,
  fileName: Schema.String
});

export type DiffFilePair = Schema.Schema.Type<typeof DiffFilePairSchema>;

export const createDiffFilePair = (props: {
  localUri: HashableUri;
  remoteUri: HashableUri;
  fileName: string;
}): DiffFilePair => props;

export const isDiffFilePair = Schema.is(DiffFilePairSchema);
