/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Schema from 'effect/Schema';
import type { HashableUri } from 'salesforcedx-vscode-services';
import { URI } from 'vscode-uri';

const isHashableUri = (u: unknown): u is HashableUri =>
  u instanceof URI && u.constructor.name === 'HashableUri';

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
