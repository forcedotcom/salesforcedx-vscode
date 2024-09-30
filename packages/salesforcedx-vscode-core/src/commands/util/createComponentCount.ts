/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '@salesforce/source-deploy-retrieve-bundle';

export const createComponentCount = (components: Iterable<MetadataComponent>) => {
  const quantities: { [type: string]: number } = {};
  for (const component of components) {
    const { name: typeName } = component.type;
    const typeCount = quantities[typeName];
    quantities[typeName] = typeCount ? typeCount + 1 : 1;
  }
  return Object.keys(quantities).map(type => ({
    type,
    quantity: quantities[type]
  }));
};
