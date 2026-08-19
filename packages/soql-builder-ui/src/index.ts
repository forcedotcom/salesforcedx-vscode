/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SoqlBuilderApp } from './soqlBuilderApp.js';

if (!customElements.get('soql-builder-app')) {
  customElements.define('soql-builder-app', SoqlBuilderApp);
}

export { SoqlBuilderApp } from './soqlBuilderApp.js';
export {
  createInitialSoqlBuilderState,
  defaultSoqlBuilderLabels,
  type SoqlBuilderHost,
  type SoqlBuilderLabels,
  type SoqlBuilderQuery,
  type SoqlBuilderState,
  type SoqlBuilderStateListener
} from './contracts.js';

declare global {
  interface HTMLElementTagNameMap {
    'soql-builder-app': SoqlBuilderApp;
  }
}
