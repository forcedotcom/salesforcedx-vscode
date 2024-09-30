/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RetrieveDescriber } from './retrieveDescriber';

/**
 * An object capable of triggering the force:source:retrieve metadata command
 */
export type RetrieveMetadataTrigger = {
  /**
   * The RetrieveDescriber to use for the retrieve execution
   */
  describer(): RetrieveDescriber;
};
