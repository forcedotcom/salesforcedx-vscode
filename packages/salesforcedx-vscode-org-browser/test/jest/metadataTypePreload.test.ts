/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalog } from 'salesforcedx-vscode-services';
import * as Effect from 'effect/Effect';
import { preloadMetadataTypes } from '../../src/services/metadataTypePreload';

describe('preloadMetadataTypes', () => {
  it('loads the configured metadata type inventories', async () => {
    const getChildren = jest.fn(() => Effect.succeed([]));

    await Effect.runPromise(preloadMetadataTypes({ getChildren } as unknown as OrgMetadataCatalog));

    expect(getChildren).toHaveBeenCalledTimes(1);
    expect(getChildren).toHaveBeenCalledWith({ type: 'ApexClass' });
  });
});
