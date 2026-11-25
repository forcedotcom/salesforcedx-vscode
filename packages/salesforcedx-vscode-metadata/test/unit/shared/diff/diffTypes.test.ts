/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { HashableUri } from '@salesforce/vscode-services/v2';
import { URI } from 'vscode-uri';
import { createDiffFilePair, DiffFilePairSchema } from '../../../../src/shared/diff/diffTypes';

const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
const remotePath = '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';

describe('diffTypes', () => {
  it('createDiffFilePair produces pair accepted by DiffFilePairSchema', () => {
    const pair = createDiffFilePair({
      localUri: HashableUri.fromUri(URI.file(localPath)),
      remoteUri: HashableUri.fromUri(URI.file(remotePath)),
      fileName: 'ConflictsTest.cls'
    });

    expect(Schema.is(DiffFilePairSchema)(pair)).toBe(true);
  });
});
