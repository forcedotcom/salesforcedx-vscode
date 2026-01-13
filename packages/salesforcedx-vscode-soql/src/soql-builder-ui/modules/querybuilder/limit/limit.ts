/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api } from 'lwc';

export default class Limit extends LightningElement {
  @api public hasError = false;
  @api public limit;

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
  public handleLimitChange(e: Event): void {
    e.preventDefault();
    const limit = e.target.value;
    const sObjectSelected = new CustomEvent('limit__changed', {
      detail: { limit }
    });
    this.dispatchEvent(sObjectSelected);
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
}
