/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Schema from 'effect/Schema';
import type { HashableUri } from 'salesforcedx-vscode-services';

/** Cross-bundle safe: HashableUri from services extension fails instanceof URI in metadata bundle. Use structural check. */
const isHashableUri = (u: unknown): u is HashableUri =>
  u !== null &&
  typeof u === 'object' &&
  'path' in u &&
  'scheme' in u &&
  typeof Object(u)['path'] === 'string' &&
  typeof Object(u)['scheme'] === 'string';

const HashableUriSchema = Schema.declare<HashableUri>(isHashableUri);

export const DiffFilePairSchema = Schema.Struct({
  localUri: HashableUriSchema,
  remoteUri: HashableUriSchema,
  fileName: Schema.String
});

export type DiffFilePair = Schema.Schema.Type<typeof DiffFilePairSchema>;

export const createDiffFilePair = (props: {
  localUri: HashableUri;
  remoteUri: HashableUri;
  fileName: string;
}): DiffFilePair => Data.struct(props);

export const isDiffFilePair = Schema.is(DiffFilePairSchema);
