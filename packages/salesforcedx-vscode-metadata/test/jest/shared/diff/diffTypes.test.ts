/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { createDiffFilePair, isDiffFilePair } from '../../../../src/shared/diff/diffTypes';

const localPath = '/workspace/force-app/main/default/classes/ConflictsTest.cls';
const remotePath = '/workspace/.sf/orgs/org123/remoteMetadata/pkg/main/default/classes/ConflictsTest.cls';

describe('diffTypes', () => {
  it('createDiffFilePair produces pair accepted by isDiffFilePair', () => {
    const pair = createDiffFilePair({
      localUri: HashableUri.file(localPath),
      remoteUri: HashableUri.file(remotePath),
      fileName: 'ConflictsTest.cls'
    });

    expect(isDiffFilePair(pair)).toBe(true);
  });
});
