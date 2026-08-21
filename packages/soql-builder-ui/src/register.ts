/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SoqlBuilderElement } from './components/soqlBuilderElement.js';

export const registerSoqlBuilderElements = (): void => {
  if (!customElements.get('soql-builder-app')) {
    customElements.define('soql-builder-app', SoqlBuilderElement);
  }
};
