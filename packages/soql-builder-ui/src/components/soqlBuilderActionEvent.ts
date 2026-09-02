/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SOQL_BUILDER_ACTION_EVENT, type SoqlBuilderAction } from '../domain.js';

export class SoqlBuilderActionEvent extends CustomEvent<SoqlBuilderAction> {
  constructor(action: SoqlBuilderAction) {
    super(SOQL_BUILDER_ACTION_EVENT, {
      bubbles: true,
      composed: true,
      detail: action
    });
  }
}
