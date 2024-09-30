/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { lwcTestIndexer } from '../testIndexer';

/**
 * Refresh the test explorer. This will clear the test results and clear the test index.
 * It will retrigger indexing from test indexer if test explorer view is open.
 */
export const lwcTestRefreshTestExplorer = () => {
  lwcTestIndexer.resetIndex();
};
