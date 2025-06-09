/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as minSObjectsFromFile from '../../src/data/minSObjects.json';

export const getMinNames = () => minSObjectsFromFile.typeNames;
export const getMinObjects = () => ({
  standard: minSObjectsFromFile.standard,
  custom: []
});
