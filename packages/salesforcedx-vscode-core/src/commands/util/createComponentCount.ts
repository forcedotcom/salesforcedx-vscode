/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MetadataComponent } from '@salesforce/source-deploy-retrieve';

export const createComponentCount = (components: Iterable<MetadataComponent>): { type: string; quantity: number }[] => {
  const grouped = Object.groupBy(components, (component: MetadataComponent) => component.type.name);

  return Object.entries(grouped).map(([type, items]) => ({
    type,
    quantity: items?.length ?? 0
  }));
};
